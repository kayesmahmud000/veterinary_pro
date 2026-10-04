import {
  SubscriptionBillingInterval,
  SubscriptionPlanChangeType,
  SubscriptionTier,
} from "../../enums/index.js";
import { SubscriptionResponseDto } from "./subscription-lifecycle.dto.js";

export interface PreviewSubscriptionPlanChangeDto {
  targetPlanId?: string;
  targetTier?: SubscriptionTier;
  billingInterval?: SubscriptionBillingInterval;
}

export interface ChangeSubscriptionPlanDto {
  targetPlanId?: string;
  targetTier?: SubscriptionTier;
  billingInterval?: SubscriptionBillingInterval;
  immediate?: boolean;
}

export interface QuotaViolationDetailDto {
  resource: "ANIMALS" | "STAFF";
  currentUsage: number;
  targetLimit: number;
  message: string;
}

export interface SubscriptionProrationBreakdownDto {
  currentPlanTier: SubscriptionTier;
  currentPlanName: string;
  currentInterval: SubscriptionBillingInterval;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  targetPlanTier: SubscriptionTier;
  targetPlanName: string;
  targetInterval: SubscriptionBillingInterval;
  changeType: SubscriptionPlanChangeType;
  effectiveDate: string;
  totalPeriodDays: number;
  usedDays: number;
  remainingDays: number;
  unusedRatio: number;
  currentPlanPriceCents: number;
  unusedCreditCents: number;
  targetPlanPriceCents: number;
  netAmountDueCents: number;
  creditBalanceCents: number;
}

export interface SubscriptionProrationPreviewDto {
  subscriptionId: string;
  farmId: string | null;
  proration: SubscriptionProrationBreakdownDto;
  canProceed: boolean;
  quotaViolations: QuotaViolationDetailDto[];
}

export interface SubscriptionChangeResultDto {
  subscription: SubscriptionResponseDto;
  proration: SubscriptionProrationBreakdownDto;
  transactionId?: string;
}
