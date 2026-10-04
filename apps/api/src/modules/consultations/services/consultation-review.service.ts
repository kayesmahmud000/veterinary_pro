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

    const existing = await this.reviewRepo.findByConsultationId(consultationId);
    if (existing) {
      throw new EntityConflictException(
        "A review has already been submitted for this consultation.",
      );
    }

    const entity = ConsultationReviewEntity.create({
      consultationId,
      farmerId: author.sub,
      vetId: consultation.vetId,
      rating: dto.rating,
      feedback: dto.feedback,
      tags: dto.tags,
      isPublic: dto.isPublic ?? true,
    });

    const saved = await this.reviewRepo.create(entity);

    // Update aggregate rating on vet profile
    await this.updateVetProfileAggregates(consultation.vetId);

    // Audit log
    await this.auditLogRepo.record({
      userId: author.sub,
      action: "CONSULTATION_REVIEW_SUBMITTED",
      entityType: "ConsultationReview",
      entityId: saved.id,
      newValues: {
        consultationId: saved.consultationId,
        vetId: saved.vetId,
        rating: saved.rating,
        tags: saved.tags,
        isPublic: saved.isPublic,
        moderationStatus: saved.moderationStatus,
      },
      traceId: activeTraceId,
    });

    this.logger.log(
      `Review '${saved.id}' submitted for consultation '${consultationId}' with rating ${saved.rating}/5`,
    );

    return saved.toDto();
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
      review.moderationStatus === ReviewModerationStatus.REJECTED &&
      !isSuperOrAdmin &&
      review.farmerId !== requestingUser.sub
    ) {
      return null;
    }

    return review.toDto();
  }

  public async getVetReviews(
    vetId: string,
    query?: ReviewQueryDto,
  ): Promise<{ items: ConsultationReviewDto[]; total: number }> {
    const effectiveQuery: ReviewQueryDto = {
      ...query,
      vetId,
      moderationStatus:
        query?.moderationStatus ?? ReviewModerationStatus.APPROVED,
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

    const review = await this.reviewRepo.findById(reviewId);
    if (!review) {
      throw new EntityNotFoundException("ConsultationReview", reviewId);
    }

    switch (dto.status) {
      case ReviewModerationStatus.APPROVED:
        review.approve(actorUser.sub, dto.reason);
        break;
      case ReviewModerationStatus.FLAGGED:
        review.flag(actorUser.sub, dto.reason);
        break;
      case ReviewModerationStatus.REJECTED:
        review.reject(actorUser.sub, dto.reason);
        break;
      default:
        break;
    }

    const saved = await this.reviewRepo.save(review);

    // Recalculate aggregates on the vet's profile
    await this.updateVetProfileAggregates(saved.vetId);

    // Audit log
    await this.auditLogRepo.record({
      userId: actorUser.sub,
      action: "CONSULTATION_REVIEW_MODERATED",
      entityType: "ConsultationReview",
      entityId: saved.id,
      newValues: {
        moderationStatus: saved.moderationStatus,
        moderationReason: saved.moderationReason,
        moderatedById: saved.moderatedById,
        moderatedAt: saved.moderatedAt?.toISOString(),
      },
      traceId: activeTraceId,
    });

    this.logger.log(
      `Review '${saved.id}' moderated to status '${saved.moderationStatus}'`,
    );

    return saved.toDto();
  }

  public async updateVetProfileAggregates(vetId: string): Promise<void> {
    try {
      const summary = await this.reviewRepo.findVetRatingSummary(vetId);
      await this.vetProfileRepo.updateRatingAggregates(
        vetId,
        summary.averageRating,
        summary.totalReviews,
      );
      this.logger.log(
        `Updated vet profile aggregates for vet '${vetId}': avg=${summary.averageRating}, total=${summary.totalReviews}`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to update aggregates for vet '${vetId}': ${(error as Error).message}`,
        (error as Error).stack,
      );
    }
  }
}
