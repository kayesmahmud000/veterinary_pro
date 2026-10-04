import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  ConsultationPayoutLedgerDto,
  FeeSplitCalculationDto,
  PayoutLedgerQueryDto,
  PayoutStatus,
  PlatformRevenueSummaryDto,
  ProcessPayoutDto,
  VetEarningsSummaryDto,
} from "@vetralink/shared-types";
import {
  EntityNotFoundException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../../audit/repositories/audit-log.repository.interface";
import { PayoutLedgerEntity } from "../entities/payout-ledger.entity";
import {
  IConsultationRepository,
  CONSULTATION_REPOSITORY,
} from "../repositories/consultation.repository.interface";
import {
  IPayoutLedgerRepository,
  PAYOUT_LEDGER_REPOSITORY,
} from "../repositories/payout-ledger.repository.interface";
import { IVetPayoutLedgerService } from "./vet-payout-ledger.service.interface";

@Injectable()
export class VetPayoutLedgerService implements IVetPayoutLedgerService {
  private readonly logger = new Logger(VetPayoutLedgerService.name);

  constructor(
    @Inject(PAYOUT_LEDGER_REPOSITORY)
    private readonly payoutLedgerRepo: IPayoutLedgerRepository,
    @Inject(CONSULTATION_REPOSITORY)
    private readonly consultationRepo: IConsultationRepository,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepo: IAuditLogRepository,
  ) {}

  public calculateSplit(
    totalFeeCents: number,
    platformRate = 0.2,
  ): FeeSplitCalculationDto {
    if (totalFeeCents < 0) {
      throw new ValidationDomainException(
        "Total fee cents cannot be negative.",
      );
    }
    if (platformRate < 0 || platformRate > 1) {
      throw new ValidationDomainException(
        "Platform fee rate must be between 0 and 1.",
      );
    }

    const platformFeeCents = Math.round(totalFeeCents * platformRate);
    const vetPayoutCents = totalFeeCents - platformFeeCents;

    return {
      totalFeeCents,
      platformFeeRate: platformRate,
      platformFeeCents,
      vetPayoutCents,
      currency: "USD",
    };
  }

  public async recordConsultationSettlement(
    consultationId: string,
    customRate?: number,
    traceId?: string,
  ): Promise<ConsultationPayoutLedgerDto> {
    const activeTraceId = traceId ?? crypto.randomUUID();
    this.logger.log(
      `[${activeTraceId}] Recording payout settlement for consultation '${consultationId}'`,
    );

    const consultation = await this.consultationRepo.findById(consultationId);
    if (!consultation) {
      throw new EntityNotFoundException("Consultation", consultationId);
    }

    if (!consultation.vetId) {
      throw new ValidationDomainException(
        "Cannot settle consultation without an assigned veterinarian.",
      );
    }

    // Check for existing ledger entry (idempotency)
    const existing =
      await this.payoutLedgerRepo.findByConsultationId(consultationId);
    if (existing) {
      this.logger.log(
        `Settlement ledger already exists for consultation '${consultationId}' (Ledger ID: '${existing.id}')`,
      );
      return existing.toDto();
    }

    const split = this.calculateSplit(consultation.feeCents, customRate);

    const entity = PayoutLedgerEntity.create({
      consultationId: consultation.id,
      vetId: consultation.vetId,
      totalFeeCents: split.totalFeeCents,
      platformFeeRate: split.platformFeeRate,
      currency: consultation.currency,
      metadata: {
        settledBy: "SYSTEM_CAPTURE",
        farmerId: consultation.farmerId,
        farmId: consultation.farmId,
        consultationType: consultation.type,
      },
    });

    const saved = await this.payoutLedgerRepo.create(entity);

    await this.auditLogRepo.record({
      userId: consultation.vetId,
      action: "VET_CONSULTATION_SETTLED",
      entityType: "ConsultationPayoutLedger",
      entityId: saved.id,
      newValues: {
        consultationId: saved.consultationId,
        vetId: saved.vetId,
        totalFeeCents: saved.totalFeeCents,
        platformFeeCents: saved.platformFeeCents,
        vetPayoutCents: saved.vetPayoutCents,
        platformFeeRate: saved.platformFeeRate,
        status: saved.status,
      },
      traceId: activeTraceId,
    });

    this.logger.log(
      `Settlement recorded for consultation '${consultationId}': Vet Payout: $${(saved.vetPayoutCents / 100).toFixed(2)}, Platform Fee: $${(saved.platformFeeCents / 100).toFixed(2)} (Ledger ID: '${saved.id}')`,
    );

    return saved.toDto();
  }

  public async getVetPayoutLedger(
    vetId: string,
    query?: PayoutLedgerQueryDto,
  ): Promise<{ items: ConsultationPayoutLedgerDto[]; total: number }> {
    const result = await this.payoutLedgerRepo.findMany({
      ...query,
      vetId,
    });

    return {
      items: result.items.map((item) => item.toDto()),
      total: result.total,
    };
  }

  public async getVetEarningsSummary(
    vetId: string,
  ): Promise<VetEarningsSummaryDto> {
    return this.payoutLedgerRepo.findEarningsSummary(vetId);
  }

  public async getPlatformRevenueSummary(filter?: {
    startDate?: string;
    endDate?: string;
  }): Promise<PlatformRevenueSummaryDto> {
    return this.payoutLedgerRepo.findPlatformRevenueSummary(filter);
  }

  public async processPayout(
    payoutId: string,
    dto: ProcessPayoutDto,
    actorUserId: string,
    traceId?: string,
  ): Promise<ConsultationPayoutLedgerDto> {
    const activeTraceId = traceId ?? crypto.randomUUID();
    const ledger = await this.payoutLedgerRepo.findById(payoutId);
    if (!ledger) {
      throw new EntityNotFoundException("ConsultationPayoutLedger", payoutId);
    }

    ledger.markPaid(dto.payoutReference, dto.payoutBatchId);
    const saved = await this.payoutLedgerRepo.save(ledger);

    await this.auditLogRepo.record({
      userId: actorUserId,
      action: "VET_PAYOUT_PROCESSED",
      entityType: "ConsultationPayoutLedger",
      entityId: saved.id,
      newValues: {
        status: saved.status,
        payoutReference: saved.payoutReference,
        payoutBatchId: saved.payoutBatchId,
        processedAt: saved.processedAt?.toISOString(),
        vetPayoutCents: saved.vetPayoutCents,
      },
      traceId: activeTraceId,
    });

    this.logger.log(
      `Payout '${saved.id}' processed by user '${actorUserId}' for vet '${saved.vetId}': $${(saved.vetPayoutCents / 100).toFixed(2)}`,
    );

    return saved.toDto();
  }

  public async bulkProcessPayouts(
    vetId: string,
    payoutIds: string[],
    dto: ProcessPayoutDto,
    actorUserId: string,
    traceId?: string,
  ): Promise<{ processedCount: number; totalPaidCents: number }> {
    const activeTraceId = traceId ?? crypto.randomUUID();
    let processedCount = 0;
    let totalPaidCents = 0;

    for (const id of payoutIds) {
      const ledger = await this.payoutLedgerRepo.findById(id);
      if (
        ledger &&
        ledger.vetId === vetId &&
        ledger.status !== PayoutStatus.PAID &&
        ledger.status !== PayoutStatus.REVERSED
      ) {
        ledger.markPaid(dto.payoutReference, dto.payoutBatchId);
        await this.payoutLedgerRepo.save(ledger);
        processedCount++;
        totalPaidCents += ledger.vetPayoutCents;
      }
    }

    await this.auditLogRepo.record({
      userId: actorUserId,
      action: "VET_PAYOUT_BULK_PROCESSED",
      entityType: "ConsultationPayoutLedger",
      entityId: vetId,
      newValues: {
        vetId,
        processedCount,
        totalPaidCents,
        payoutBatchId: dto.payoutBatchId,
        payoutReference: dto.payoutReference,
      },
      traceId: activeTraceId,
    });

    this.logger.log(
      `Bulk processed ${processedCount} payouts for vet '${vetId}', total paid: $${(totalPaidCents / 100).toFixed(2)}`,
    );

    return { processedCount, totalPaidCents };
  }
}
