import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import {
  ConsultationPaymentStatus,
  ConsultationResponseDto,
  CreateConsultationRequestDto,
  QueryFarmerConsultationsDto,
  QueryTriageQueueDto,
  TriageCaseDetailDto,
  TriageMetricsDto,
  TriageQueueItemDto,
  UserRole,
} from "@vetralink/shared-types";
import {
  EntityNotFoundException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../../audit/repositories/audit-log.repository.interface";
import { PrismaService } from "../../prisma/prisma.service";
import { ConsultationEntity } from "../entities/consultation.entity";
import {
  CONSULTATION_REPOSITORY,
  IConsultationRepository,
} from "../repositories/consultation.repository.interface";
import {
  CONSULTATION_PAYMENT_GATEWAY,
  IConsultationPaymentGateway,
} from "./consultation-payment-gateway.interface";
import { IConsultationService } from "./consultation.service.interface";

@Injectable()
export class ConsultationService implements IConsultationService {
  private readonly logger = new Logger(ConsultationService.name);

  constructor(
    @Inject(CONSULTATION_REPOSITORY)
    private readonly consultationRepo: IConsultationRepository,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepo: IAuditLogRepository,
    private readonly prisma: PrismaService,
    @Optional()
    @Inject(CONSULTATION_PAYMENT_GATEWAY)
    private readonly paymentGateway?: IConsultationPaymentGateway,
  ) {}

  public async createConsultation(
    farmerId: string,
    dto: CreateConsultationRequestDto,
    traceId?: string,
  ): Promise<ConsultationResponseDto> {
    this.logger.log(
      `[${traceId ?? "NO-TRACE"}] Farmer '${farmerId}' submitting consultation request for farm '${dto.farmId}' (type: ${dto.type ?? "ASYNC_TICKET"})`,
    );

    if (!dto.farmId) {
      throw new ValidationDomainException(
        "Farm ID is required to request a consultation.",
      );
    }

    // Verify animal belongs to target farm if animalId is provided
    if (dto.animalId) {
      const animal = await this.prisma.animal.findFirst({
        where: {
          id: dto.animalId,
          farmId: dto.farmId,
          deletedAt: null,
        },
      });

      if (!animal) {
        throw new EntityNotFoundException("Animal", dto.animalId);
      }
    }

    const entity = ConsultationEntity.create({
      farmerId,
      farmId: dto.farmId,
      animalId: dto.animalId ?? null,
      chiefComplaint: dto.chiefComplaint,
      mediaUrls: dto.mediaUrls ?? [],
      type: dto.type,
    });

    const created = await this.consultationRepo.create(entity);

    await this.auditLogRepo.record({
      userId: farmerId,
      action: "CONSULTATION_REQUEST_SUBMITTED",
      entityType: "Consultation",
      entityId: created.id,
      newValues: {
        farmId: created.farmId,
        animalId: created.animalId,
        type: created.type,
        status: created.status,
      },
      traceId: traceId ?? crypto.randomUUID(),
    });

    this.logger.log(
      `Consultation request '${created.id}' submitted successfully for farm '${created.farmId}'`,
    );

    return created.toResponseDto();
  }

  public async getConsultationById(
    id: string,
    farmId: string,
    userId: string,
    userRole?: UserRole,
  ): Promise<ConsultationResponseDto> {
    const consultation = await this.consultationRepo.findById(id, farmId);

    if (!consultation) {
      throw new EntityNotFoundException("Consultation", id);
    }

    return consultation.toResponseDto();
  }

  public async getFarmerConsultations(
    farmerId: string,
    farmId: string,
    query: QueryFarmerConsultationsDto,
  ): Promise<{ items: ConsultationResponseDto[]; total: number }> {
    const result = await this.consultationRepo.findByFarm(farmId, query);

    return {
      items: result.items.map((c) => c.toResponseDto()),
      total: result.total,
    };
  }

  public async getTriageQueue(
    query?: QueryTriageQueueDto,
  ): Promise<{
    items: TriageQueueItemDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = query?.page ?? 1;
    const limit = query?.limit ?? 20;

    const result = await this.consultationRepo.findTriageQueue(query);
    const now = new Date();

    const items: TriageQueueItemDto[] = result.items.map((c) => {
      const resp = c.toResponseDto();
      const waitTimeMinutes = Math.max(
        0,
        Math.round((now.getTime() - c.createdAt.getTime()) / 60000),
      );
      return {
        ...resp,
        waitTimeMinutes,
      };
    });

    const totalPages = Math.ceil(result.total / limit);

    return {
      items,
      total: result.total,
      page,
      limit,
      totalPages,
    };
  }

  public async getTriageMetrics(now = new Date()): Promise<TriageMetricsDto> {
    return this.consultationRepo.getTriageMetrics(now);
  }

  public async getTriageCaseDetail(id: string): Promise<TriageCaseDetailDto> {
    const detail = await this.consultationRepo.findTriageCaseDetail(id);

    if (!detail) {
      throw new EntityNotFoundException("Consultation", id);
    }

    return detail;
  }

  public async cancelTriageCase(
    id: string,
    reason: string,
    cancelledByUserId: string,
    traceId?: string,
  ): Promise<ConsultationResponseDto> {
    if (!reason || reason.trim().length < 5) {
      throw new ValidationDomainException(
        "Cancellation reason must be at least 5 characters long",
      );
    }

    const consultation = await this.consultationRepo.findById(id);

    if (!consultation) {
      throw new EntityNotFoundException("Consultation", id);
    }

    if (!consultation.canBeCancelled()) {
      throw new ValidationDomainException(
        `Cannot cancel consultation in status '${consultation.status}'. Completed or already cancelled consultations cannot be cancelled.`,
      );
    }

    const oldStatus = consultation.status;
    const oldPaymentStatus = consultation.paymentStatus;
    const paymentIntentId = consultation.paymentIntentId;

    consultation.cancel();

    const saved = await this.consultationRepo.save(consultation);

    if (
      oldPaymentStatus === ConsultationPaymentStatus.AUTHORIZED &&
      paymentIntentId &&
      paymentIntentId !== "fee_waived_zero" &&
      this.paymentGateway
    ) {
      try {
        await this.paymentGateway.releaseHold(paymentIntentId);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error(
          `Failed to release payment hold '${paymentIntentId}' on cancelled consultation '${saved.id}': ${msg}`,
        );
      }
    }

    await this.auditLogRepo.record({
      userId: cancelledByUserId,
      action: "CONSULTATION_CANCELLED_BY_TRIAGE",
      entityType: "Consultation",
      entityId: saved.id,
      oldValues: { status: oldStatus },
      newValues: { status: saved.status, reason: reason.trim() },
      traceId: traceId ?? crypto.randomUUID(),
    });

    this.logger.log(
      `Consultation '${saved.id}' cancelled by triage user '${cancelledByUserId}'. Reason: ${reason.trim()}`,
    );

    return saved.toResponseDto();
  }
}
