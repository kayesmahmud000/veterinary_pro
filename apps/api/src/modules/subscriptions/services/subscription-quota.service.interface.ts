import {
  FarmQuotaSummaryDto,
  SubscriptionQuotaType,
  SubscriptionTier,
} from "@vetralink/shared-types";

export interface SubscriptionQuotaCheckResult {
  allowed: boolean;
  quotaType: SubscriptionQuotaType;
  currentUsage: number;
  limit: number;
  remaining: number;
  planTier: SubscriptionTier;
  upgradeTier: SubscriptionTier | null;
}

export interface ISubscriptionQuotaService {
  checkQuota(
    farmId: string,
    quotaType: SubscriptionQuotaType,
    increment?: number,
  ): Promise<SubscriptionQuotaCheckResult>;

  assertQuotaAvailable(
    farmId: string,
    quotaType: SubscriptionQuotaType,
    increment?: number,
  ): Promise<SubscriptionQuotaCheckResult>;

  getFarmQuotaUsage(farmId: string): Promise<FarmQuotaSummaryDto>;
}

export const SUBSCRIPTION_QUOTA_SERVICE = "SUBSCRIPTION_QUOTA_SERVICE";
