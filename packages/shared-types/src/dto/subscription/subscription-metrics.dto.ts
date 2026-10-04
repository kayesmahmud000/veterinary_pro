import { SubscriptionStatus, SubscriptionTier } from "../../enums/index.js";

export interface SubscriptionTierBreakdownDto {
  tier: SubscriptionTier;
  tierName: string;
  count: number;
  activePayingCount: number;
  mrrCents: number;
  percentageOfMrr: number;
}

export interface SubscriptionStatusBreakdownDto {
  status: SubscriptionStatus;
  count: number;
  percentageOfTotal: number;
}

export interface DunningExposureDto {
  totalPastDueCount: number;
  atRiskMrrCents: number;
  gracePeriodCount: number;
  readOnlyCount: number;
  suspendedCount: number;
}

export interface SaasMetricsSummaryDto {
  asOfDate: string;
  mrrCents: number;
  arrCents: number;
  arpuCents: number;
  ltvCents: number;
  activeSubscriptionsCount: number;
  activePayingSubscriptionsCount: number;
  trialingSubscriptionsCount: number;
  pastDueSubscriptionsCount: number;
  canceledSubscriptionsCount: number;
  expiredSubscriptionsCount: number;
  totalSubscriptionsCount: number;
  customerChurnRatePercent: number;
  revenueChurnRatePercent: number;
  tierBreakdown: SubscriptionTierBreakdownDto[];
  statusBreakdown: SubscriptionStatusBreakdownDto[];
  dunningExposure: DunningExposureDto;
}

export interface MonthlyTrendPointDto {
  period: string; // e.g. "2026-08"
  mrrCents: number;
  arrCents: number;
  activeCount: number;
  newSubscriptionsCount: number;
  churnedSubscriptionsCount: number;
  netGrowthCount: number;
}

export interface SaasMetricsTrendDto {
  startDate: string;
  endDate: string;
  timeline: MonthlyTrendPointDto[];
}

export interface QuerySaasMetricsDto {
  startDate?: string;
  endDate?: string;
  months?: number;
}
