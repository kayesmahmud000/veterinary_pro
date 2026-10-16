import { Prisma } from "@prisma/client";
import {TRANSACTION_MANAGER, ITransactionManager} from "../../prisma/interfaces/transaction.interface";
import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  ConsultationReviewDto,
  ConsultationStatus,
  JwtPayload,
  ModerateReviewDto,
  ReviewModerationStatus,
  ReviewQueryDto,
  SubmitConsultationReviewDto,
  UserRole,
  VetRatingSummaryDto,
} from "@vetralink/shared-types";
import {
  EntityConflictException,
  EntityNotFoundException,
  ForbiddenOperationException,
  ValidationDomainException,
  WorkflowException,
} from "../../../common/exceptions/domain.exception";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../../audit/repositories/audit-log.repository.interface";
import { ConsultationReviewEntity } from "../entities/consultation-review.entity";
import {
  IConsultationReviewRepository,
  CONSULTATION_REVIEW_REPOSITORY,
} from "../repositories/consultation-review.repository.interface";
import {
  IConsultationRepository,
  CONSULTATION_REPOSITORY,
} from "../repositories/consultation.repository.interface";
import {
  IVetProfileRepository,
  VET_PROFILE_REPOSITORY,
} from "../repositories/vet-profile.repository.interface";
import { IConsultationReviewService } from "./consultation-review.service.interface";

@Injectable()
export class ConsultationReviewService implements IConsultationReviewService {
  private readonly logger = new Logger(ConsultationReviewService.name);

  constructor(
    @Inject(CONSULTATION_REVIEW_REPOSITORY)
    private readonly reviewRepo: IConsultationReviewRepository,
    @Inject(CONSULTATION_REPOSITORY)
    private readonly consultationRepo: IConsultationRepository,
    @Inject(VET_PROFILE_REPOSITORY)
    private readonly vetProfileRepo: IVetProfileRepository,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepo: IAuditLogRepository,
    @Inject(TRANSACTION_MANAGER) private readonly transactions: ITransactionManager,
  ) {}

  public async submitReview(
    consultationId: string,
    author: JwtPayload,
    dto: SubmitConsultationReviewDto,
    traceId?: string,
  ): Promise<ConsultationReviewDto> {
    const activeTraceId = traceId ?? crypto.randomUUID();
    this.logger.log(
      `[${activeTraceId}] Submitting review for consultation '${consultationId}' by user '${author.sub}'`,
    );

    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    if (consultation.status !== ConsultationStatus.COMPLETED) {
      throw new ValidationDomainException(
        "Reviews can only be submitted for completed consultations.",
      );
    }

    if (consultation.farmerId !== author.sub) {
      throw new ForbiddenOperationException(
        "Only the farmer who participated in the consultation can submit a review.",
      );
    }

    if (!consultation.vetId) {
      throw new ValidationDomainException(
        "Consultation does not have an assigned veterinarian to review.",
      );
    }

    return this.transactions.run(async tx => {
      await this.vetProfileRepo.lockReviewFence(consultation.vetId!,tx);
      const locked = await this.reviewRepo.lockConsultation(consultationId,tx);
      if (!locked) throw new EntityNotFoundException("Consultation",consultationId);
      if (locked.farmerId!==author.sub) throw new ForbiddenOperationException();
      if (locked.status!==ConsultationStatus.COMPLETED || locked.vetId!==consultation.vetId)
        throw new EntityConflictException("Consultation changed. Reload and review.");
      const existing=await this.reviewRepo.findByConsultationId(consultationId,tx);
      if(existing) throw new EntityConflictException("A review has already been submitted for this consultation.");
      const saved=await this.reviewRepo.create(ConsultationReviewEntity.create({consultationId,farmerId:author.sub,vetId:locked.vetId!,rating:dto.rating,feedback:dto.feedback,tags:dto.tags,isPublic:dto.isPublic??true}),tx);
      await this.vetProfileRepo.recomputeRatingAggregates(saved.vetId,tx);
      await this.auditLogRepo.record({userId:author.sub,action:"CONSULTATION_REVIEW_SUBMITTED",entityType:"ConsultationReview",entityId:saved.id,newValues:{consultationId:saved.consultationId,vetId:saved.vetId,rating:saved.rating,tags:saved.tags,isPublic:saved.isPublic,moderationStatus:saved.moderationStatus},traceId:activeTraceId},tx);
      return saved.toDto();
    },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
  }

  public async getConsultationReview(
    consultationId: string,
    requestingUser: JwtPayload,
  ): Promise<ConsultationReviewDto | null> {
    const review = await this.reviewRepo.findByConsultationId(consultationId);
    if (!review) {
      return null;
    }

    const isSuperOrAdmin =
      requestingUser.role === UserRole.ADMIN ||
      requestingUser.role === UserRole.SUPER_ADMIN;

    // If review is rejected, only admins or the author farmer can view it
    if (
      (!review.isPublic || review.moderationStatus !== ReviewModerationStatus.APPROVED) &&
      !isSuperOrAdmin &&
      review.farmerId !== requestingUser.sub &&
      review.vetId !== requestingUser.sub
    ) {
      return null;
    }

    return review.toDto();
  }

  public async getVetReviews(
    vetId: string,
    query?: ReviewQueryDto,
  ): Promise<{ items: ConsultationReviewDto[]; total: number }> {
    const effectiveQuery: ReviewQueryDto & {isPublic:true} = {
      ...query,
      vetId,
      moderationStatus: ReviewModerationStatus.APPROVED,
      isPublic: true,
    };

    const result = await this.reviewRepo.findMany(effectiveQuery);

    return {
      items: result.items.map((item) => item.toDto()),
      total: result.total,
    };
  }

  public async getModerationReviews(
    query?: ReviewQueryDto,
  ): Promise<{ items: ConsultationReviewDto[]; total: number }> {
    const result = await this.reviewRepo.findMany(query ?? {});

    return {
      items: result.items.map((item) => item.toDto()),
      total: result.total,
    };
  }

  public async getVetRatingSummary(
    vetId: string,
  ): Promise<VetRatingSummaryDto> {
    return this.reviewRepo.findVetRatingSummary(vetId);
  }

  public async moderateReview(
    reviewId: string,
    dto: ModerateReviewDto,
    actorUser: JwtPayload,
    traceId?: string,
  ): Promise<ConsultationReviewDto> {
    const activeTraceId = traceId ?? crypto.randomUUID();
    this.logger.log(
      `[${activeTraceId}] Moderating review '${reviewId}' to status '${dto.status}' by user '${actorUser.sub}'`,
    );

    if (![UserRole.ADMIN,UserRole.SUPER_ADMIN].includes(actorUser.role)) throw new ForbiddenOperationException();
    if (![ReviewModerationStatus.APPROVED,ReviewModerationStatus.FLAGGED,ReviewModerationStatus.REJECTED].includes(dto.status)) throw new ValidationDomainException("Invalid moderation status.");
    const initial=await this.reviewRepo.findById(reviewId);
    if(!initial) throw new EntityNotFoundException("ConsultationReview",reviewId);
    return this.transactions.run(async tx => {
      await this.vetProfileRepo.lockReviewFence(initial.vetId,tx);
      await this.reviewRepo.lock(reviewId,tx);
      const review=await this.reviewRepo.findById(reviewId,tx);
      if(!review) throw new EntityNotFoundException("ConsultationReview",reviewId);
      if(review.moderationStatus===dto.status) throw new WorkflowException("REVIEW_ACTION_UNAVAILABLE","Review status is already selected.");
      switch(dto.status) {
        case ReviewModerationStatus.APPROVED: review.approve(actorUser.sub,dto.reason);break;
        case ReviewModerationStatus.FLAGGED: review.flag(actorUser.sub,dto.reason);break;
        case ReviewModerationStatus.REJECTED: review.reject(actorUser.sub,dto.reason);break;
      }
      const saved=await this.reviewRepo.save(review,tx);
      await this.vetProfileRepo.recomputeRatingAggregates(saved.vetId,tx);
      await this.auditLogRepo.record({userId:actorUser.sub,action:"CONSULTATION_REVIEW_MODERATED",entityType:"ConsultationReview",entityId:saved.id,newValues:{moderationStatus:saved.moderationStatus,moderationReason:saved.moderationReason,moderatedById:saved.moderatedById,moderatedAt:saved.moderatedAt?.toISOString()},traceId:activeTraceId},tx);
      return saved.toDto();
    },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
  }

  public async updateVetProfileAggregates(vetId: string): Promise<void> {
    await this.transactions.run(async tx => {
      await this.vetProfileRepo.lockReviewFence(vetId,tx);
      await this.vetProfileRepo.recomputeRatingAggregates(vetId,tx);
    },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
  }
}
