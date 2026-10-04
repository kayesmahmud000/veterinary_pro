import { SubscriptionTier } from "@vetralink/shared-types";
import {
  CancelSubscriptionDto,
  CreateTrialSubscriptionDto,
  SubscriptionResponseDto,
} from "../dto";

export const SUBSCRIPTION_LIFECYCLE_SERVICE = Symbol("SUBSCRIPTION_LIFECYCLE_SERVICE");

export interface ISubscriptionLifecycleService {
  createTrialSubscription(
    userId: string,
    dto: CreateTrialSubscriptionDto,
  ): Promise<SubscriptionResponseDto>;

  getFarmSubscription(farmId: string): Promise<SubscriptionResponseDto>;

  getUserSubscription(
    userId: string,
    farmId?: string,
  ): Promise<SubscriptionResponseDto>;

  activateSubscription(
    id: string,
    params?: { periodEnd?: Date; gatewaySubId?: string },
  ): Promise<SubscriptionResponseDto>;

  markSubscriptionPastDue(id: string): Promise<SubscriptionResponseDto>;

  cancelSubscription(
    id: string,
    dto?: CancelSubscriptionDto,
  ): Promise<SubscriptionResponseDto>;

  reactivateSubscription(id: string): Promise<SubscriptionResponseDto>;

  processExpiredSubscriptions(): Promise<{ processedCount: number }>;
}
