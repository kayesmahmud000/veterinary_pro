import {
  ConsultationPayoutLedgerDto,
  FeeSplitCalculationDto,
  PayoutLedgerQueryDto,
  PlatformRevenueSummaryDto,
  ProcessPayoutDto,
  VetEarningsSummaryDto,
} from "@vetralink/shared-types";

export interface IVetPayoutLedgerService {
  calculateSplit(
    totalFeeCents: number,
    platformRate?: number,
  ): FeeSplitCalculationDto;

  recordConsultationSettlement(
    consultationId: string,
    customRate?: number,
    traceId?: string,
  ): Promise<ConsultationPayoutLedgerDto>;

  getVetPayoutLedger(
    vetId: string,
    query?: PayoutLedgerQueryDto,
  ): Promise<{ items: ConsultationPayoutLedgerDto[]; total: number }>;

  getVetEarningsSummary(vetId: string): Promise<VetEarningsSummaryDto>;

  getPlatformRevenueSummary(filter?: {
    startDate?: string;
    endDate?: string;
  }): Promise<PlatformRevenueSummaryDto>;

  processPayout(
    payoutId: string,
    dto: ProcessPayoutDto,
    actorUserId: string,
    traceId?: string,
  ): Promise<ConsultationPayoutLedgerDto>;

  bulkProcessPayouts(
    vetId: string,
    payoutIds: string[],
    dto: ProcessPayoutDto,
    actorUserId: string,
    traceId?: string,
  ): Promise<{ processedCount: number; totalPaidCents: number }>;
}

export const VET_PAYOUT_LEDGER_SERVICE = "VET_PAYOUT_LEDGER_SERVICE";
