import { PayoutStatus } from "../../enums/index.js";

export interface FeeSplitCalculationDto {
  totalFeeCents: number;
  platformFeeRate: number;
  platformFeeCents: number;
  vetPayoutCents: number;
  currency: string;
}

export interface ConsultationPayoutLedgerDto {
  id: string;
  consultationId: string;
  vetId: string;
  totalFeeCents: number;
  platformFeeRate: number;
  platformFeeCents: number;
  vetPayoutCents: number;
  currency: string;
  status: PayoutStatus;
  payoutBatchId?: string | null;
  payoutReference?: string | null;
  processedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  vet?: {
    id: string;
    name: string;
    email: string;
  } | null;
  consultation?: {
    id: string;
    chiefComplaint: string;
    type: string;
    feeCents: number;
    farmId: string;
    farmerId: string;
  } | null;
}

export interface VetEarningsSummaryDto {
  vetId: string;
  lifetimeGrossCents: number;
  lifetimePlatformFeeCents: number;
  lifetimeVetEarningsCents: number;
  pendingPayoutCents: number;
  paidPayoutCents: number;
  totalSettledConsultations: number;
  currency: string;
}

export interface PlatformRevenueSummaryDto {
  totalGrossVolumeCents: number;
  totalPlatformFeesEarnedCents: number;
  totalVetPayoutsOwedCents: number;
  totalVetPayoutsPaidCents: number;
  totalSettledConsultations: number;
  currency: string;
}

export interface ProcessPayoutDto {
  payoutReference?: string;
  payoutBatchId?: string;
}

export interface BulkProcessPayoutDto {
  vetId: string;
  payoutIds: string[];
  payoutReference?: string;
  payoutBatchId?: string;
}

export interface PayoutLedgerQueryDto {
  vetId?: string;
  status?: PayoutStatus;
  payoutBatchId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}
