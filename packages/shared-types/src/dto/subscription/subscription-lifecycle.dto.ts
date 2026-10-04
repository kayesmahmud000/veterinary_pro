import { SubscriptionStatus, SubscriptionTier } from "../../enums/index.js";
import { SubscriptionPlanDto } from "./subscription-plan.dto.js";

export interface SubscriptionResponseDto {
  id: string;
  userId: string;
  farmId: string | null;
  planId: string;
  plan?: SubscriptionPlanDto;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  gatewaySubId: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  isTrial: boolean;
  isPastDue: boolean;
  daysRemaining: number;
}

export interface CreateTrialSubscriptionDto {
  farmId?: string;
  planTier?: SubscriptionTier;
  trialDays?: number;
}

export interface CancelSubscriptionRequestDto {
  immediate?: boolean;
  reason?: string;
}

export interface UpdateSubscriptionStatusDto {
  status: SubscriptionStatus;
  gatewaySubId?: string;
  currentPeriodEnd?: string;
}
