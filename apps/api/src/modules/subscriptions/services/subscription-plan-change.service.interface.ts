import {
  ChangeSubscriptionPlanDto,
  PreviewSubscriptionPlanChangeDto,
  SubscriptionChangeResultDto,
  SubscriptionProrationPreviewDto,
} from "@vetralink/shared-types";

export const SUBSCRIPTION_PLAN_CHANGE_SERVICE = Symbol(
  "SUBSCRIPTION_PLAN_CHANGE_SERVICE",
);

export interface ISubscriptionPlanChangeService {
  previewPlanChange(
    subscriptionId: string,
    dto: PreviewSubscriptionPlanChangeDto,
    userId?: string,
  ): Promise<SubscriptionProrationPreviewDto>;

  changePlan(
    subscriptionId: string,
    userId: string,
    dto: ChangeSubscriptionPlanDto,
  ): Promise<SubscriptionChangeResultDto>;
}
