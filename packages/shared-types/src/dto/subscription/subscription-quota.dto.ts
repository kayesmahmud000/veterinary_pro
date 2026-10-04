import { SubscriptionQuotaType, SubscriptionTier } from "../../enums/index.js";
import { SubscriptionPlanFeaturesDto } from "./subscription-plan.dto.js";

export interface SubscriptionQuotaUsageDto {
  quotaType: SubscriptionQuotaType;
  currentUsage: number;
  limit: number;
  remaining: number;
  isUnlimited: boolean;
  canAccommodate: boolean;
  planTier: SubscriptionTier;
  upgradeTier: SubscriptionTier | null;
}

export interface FarmQuotaSummaryDto {
  farmId: string;
  planTier: SubscriptionTier;
  planName: string;
  isSubscriptionActive: boolean;
  quotas: {
    animals: SubscriptionQuotaUsageDto;
    staff: SubscriptionQuotaUsageDto;
  };
  features: SubscriptionPlanFeaturesDto;
}

export interface QuotaExceededErrorPayloadDto {
  quotaType: SubscriptionQuotaType;
  currentUsage: number;
  limit: number;
  planTier: SubscriptionTier;
  upgradeTier: SubscriptionTier | null;
  message: string;
}
