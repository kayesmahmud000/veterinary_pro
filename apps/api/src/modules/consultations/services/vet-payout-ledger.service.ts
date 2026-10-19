import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  ConsultationPayoutLedgerDto,
  FeeSplitCalculationDto,
  PayoutLedgerQueryDto,
  PlatformRevenueSummaryDto,
  ProcessPayoutDto,
  VetEarningsSummaryDto,
} from "@vetralink/shared-types";
import {
  EntityNotFoundException,
  ValidationDomainException,
  ForbiddenOperationException,
  WorkflowException,
} from "../../../common/exceptions/domain.exception";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../../audit/repositories/audit-log.repository.interface";
import { Prisma } from "@prisma/client";
import {
  TRANSACTION_MANAGER,
  ITransactionManager,
} from "../../prisma/interfaces/transaction.interface";
import { z } from "zod";
import { validateWorkflow } from "../../../common/utils/validate-workflow";
import {
  PayoutLedgerEntity,
  settlementUnavailableReason,
} from "../entities/payout-ledger.entity";
import {
  IConsultationRepository,
  CONSULTATION_REPOSITORY,
} from "../repositories/consultation.repository.interface";
import {
  IPayoutLedgerRepository,
  PAYOUT_LEDGER_REPOSITORY,
} from "../repositories/payout-ledger.repository.interface";
import { IVetPayoutLedgerService } from "./vet-payout-ledger.service.interface";

const processSchema = z
  .object({
    payoutReference: z.string().trim().min(3).max(255),
    payoutBatchId: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

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
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: ITransactionManager,
  ) {}

  public async getConsultationSettlement(
    consultationId: string,
  ): Promise<ConsultationPayoutLedgerDto> {
    const ledger =
      await this.payoutLedgerRepo.findByConsultationId(consultationId);
    if (!ledger)
      throw new EntityNotFoundException("Settlement", consultationId);
    return ledger.toDto();
  }

  public calculateSplit(
    totalFeeCents: number,
    platformRate = 0.2,
  ): FeeSplitCalculationDto {
    if (!Number.isSafeInteger(totalFeeCents) || totalFeeCents < 0) {
      throw new ValidationDomainException(
        "Total fee cents cannot be negative.",
      );
    }
    if (
      !Number.isFinite(platformRate) ||
      platformRate < 0 ||
      platformRate > 1
    ) {
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

    return this.transactions.run(async (tx) => {
      await this.payoutLedgerRepo.lockConsultations([consultationId], tx);
      const current = await this.payoutLedgerRepo.findConsultationForSettlement(
        consultationId,
        tx,
      );
      if (!current)
        throw new EntityNotFoundException("Consultation", consultationId);
      if (!current.vetId)
        throw new ValidationDomainException(
          "Cannot settle consultation without an assigned veterinarian.",
        );
      // Check for existing ledger entry (idempotency)
      const existing = await this.payoutLedgerRepo.findByConsultationId(
        consultationId,
        tx,
      );
      if (existing) {
        this.logger.log(
          `Settlement ledger already exists for consultation '${consultationId}' (Ledger ID: '${existing.id}')`,
        );
        return existing.toDto();
      }

      const split = this.calculateSplit(current.feeCents, customRate);

      const entity = PayoutLedgerEntity.create({
        consultationId: current.id,
        vetId: current.vetId,
        totalFeeCents: split.totalFeeCents,
        platformFeeRate: split.platformFeeRate,
        currency: current.currency,
        metadata: {
          settledBy: "SYSTEM_CAPTURE",
          farmerId: current.farmerId,
          farmId: current.farmId,
          consultationType: current.type,
        },
      });

      const saved = await this.payoutLedgerRepo.create(entity, tx);

      await this.auditLogRepo.record(
        {
          userId: current.vetId,
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
        },
        tx,
      );

      this.logger.log(
        `Settlement recorded for consultation '${consultationId}': Vet Payout: $${(saved.vetPayoutCents / 100).toFixed(2)}, Platform Fee: $${(saved.platformFeeCents / 100).toFixed(2)} (Ledger ID: '${saved.id}')`,
      );

      return saved.toDto();
    });
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
    const input = validateWorkflow(processSchema, dto);
    const rows = await this.processLocked(
      [payoutId],
      input,
      actorUserId,
      traceId,
      false,
    );
    return rows[0].toDto();
  }

  public async bulkProcessPayouts(
    vetId: string,
    payoutIds: string[],
    dto: ProcessPayoutDto,
    actorUserId: string,
    traceId?: string,
  ): Promise<{ processedCount: number; totalPaidCents: number }> {
    const input = validateWorkflow(processSchema, dto);
    if (
      !Array.isArray(payoutIds) ||
      payoutIds.length < 1 ||
      payoutIds.length > 20 ||
      payoutIds.some((id) => typeof id !== "string" || !id) ||
      new Set(payoutIds.map((id) => id.toLowerCase())).size !== payoutIds.length
    ) {
      throw new ValidationDomainException("Select 1 to 20 unique payout IDs.");
    }
    const rows = await this.processLocked(
      payoutIds,
      input,
      actorUserId,
      traceId,
      true,
      vetId,
    );
    const totalPaidCents = rows.reduce(
      (sum, row) => sum + row.vetPayoutCents,
      0,
    );
    return { processedCount: rows.length, totalPaidCents };
  }

  private async processLocked(
    ids: string[],
    input: z.infer<typeof processSchema>,
    actorUserId: string,
    traceId: string | undefined,
    bulk: boolean,
    vetId?: string,
  ): Promise<PayoutLedgerEntity[]> {
    try {
      return await this.transactions.run(async (tx) => {
        if (
          !(await this.payoutLedgerRepo.lockProcessingActor(actorUserId, tx))
        ) {
          throw new ForbiddenOperationException(
            "Current administrative identity required.",
          );
        }
        const ordered = [...ids].sort();
        await this.payoutLedgerRepo.lockForProcessing(ordered, tx);
        const ledgers: PayoutLedgerEntity[] = [];
        for (const id of ordered) {
          const ledger = await this.payoutLedgerRepo.findById(id, tx);
          if (!ledger) throw new EntityNotFoundException("Settlement", id);
          const consultation =
            await this.payoutLedgerRepo.findConsultationForSettlement(
              ledger.consultationId,
              tx,
            );
          if (
            settlementUnavailableReason({ ...ledger.toDto(), consultation }) ||
            (vetId !== undefined && ledger.vetId !== vetId) ||
            (ledgers.length &&
              (ledger.currency !== ledgers[0].currency ||
                ledger.vetId !== ledgers[0].vetId))
          ) {
            throw new WorkflowException(
              "SETTLEMENT_ACTION_UNAVAILABLE",
              "Settlement is unavailable for local reconciliation.",
            );
          }
          ledgers.push(ledger);
        }
        if (
          !Number.isSafeInteger(
            ledgers.reduce((sum, row) => sum + row.vetPayoutCents, 0),
          )
        ) {
          throw new WorkflowException(
            "SETTLEMENT_ACTION_UNAVAILABLE",
            "Payout total exceeds safe minor units.",
          );
        }
        const result: PayoutLedgerEntity[] = [];
        const activeTraceId = traceId ?? crypto.randomUUID();
        for (const ledger of ledgers) {
          ledger.markPaid(input.payoutReference, input.payoutBatchId);
          const saved = await this.payoutLedgerRepo.save(ledger, tx);
          await this.auditLogRepo.record(
            {
              userId: actorUserId,
              action: bulk
                ? "VET_PAYOUT_BULK_PROCESSED"
                : "VET_PAYOUT_PROCESSED",
              entityType: "ConsultationPayoutLedger",
              entityId: saved.id,
              traceId: activeTraceId,
              newValues: {
                status: saved.status,
                payoutReference: saved.payoutReference,
                payoutBatchId: saved.payoutBatchId,
                processedAt: saved.processedAt?.toISOString(),
                vetPayoutCents: saved.vetPayoutCents,
              },
            },
            tx,
          );
          result.push(saved);
        }
        return result;
      });
    } catch (error) {
      const conflict =
        error &&
        typeof error === "object" &&
        (("code" in error &&
          ["P2034", "40001", "40P01"].includes(String(error.code))) ||
          ("meta" in error &&
            error.meta &&
            typeof error.meta === "object" &&
            "code" in error.meta &&
            ["40001", "40P01"].includes(String(error.meta.code))));
      if (conflict) {
        throw new WorkflowException(
          "SETTLEMENT_VERSION_CONFLICT",
          "Settlement changed. Reload and review.",
        );
      }
      throw error;
    }
  }
}
