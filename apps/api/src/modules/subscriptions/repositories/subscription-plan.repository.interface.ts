import { SubscriptionTier, DefaultSubscriptionPlanConfig } from "@vetralink/shared-types";
import { SubscriptionPlanEntity } from "../entities/subscription-plan.entity";

export const SUBSCRIPTION_PLAN_REPOSITORY = Symbol("SUBSCRIPTION_PLAN_REPOSITORY");

export interface ISubscriptionPlanRepository {
  findAll(includeInactive?: boolean): Promise<SubscriptionPlanEntity[]>;
  findById(id: string): Promise<SubscriptionPlanEntity | null>;
  findByTier(tier: SubscriptionTier): Promise<SubscriptionPlanEntity | null>;
  save(plan: SubscriptionPlanEntity): Promise<SubscriptionPlanEntity>;
  upsertDefaultPlans(
    defaultPlans: readonly DefaultSubscriptionPlanConfig[],
  ): Promise<SubscriptionPlanEntity[]>;
}
