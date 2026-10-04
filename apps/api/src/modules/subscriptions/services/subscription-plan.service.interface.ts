import { SubscriptionTier } from "@vetralink/shared-types";
import {
  SubscriptionPlanResponseDto,
  UpdateSubscriptionPlanDto,
} from "../dto";

export const SUBSCRIPTION_PLAN_SERVICE = Symbol("SUBSCRIPTION_PLAN_SERVICE");

export interface ISubscriptionPlanService {
  getAvailablePlans(includeInactive?: boolean): Promise<SubscriptionPlanResponseDto[]>;
  getPlanByTier(tier: SubscriptionTier): Promise<SubscriptionPlanResponseDto>;
  getPlanById(id: string): Promise<SubscriptionPlanResponseDto>;
  seedDefaultPlans(): Promise<SubscriptionPlanResponseDto[]>;
  updatePlan(
    id: string,
    dto: UpdateSubscriptionPlanDto,
  ): Promise<SubscriptionPlanResponseDto>;
}
