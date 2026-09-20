import {
  SubscriptionAccessStatusDto,
  SubscriptionSuspensionResultDto,
} from "@vetralink/shared-types";

export const SUBSCRIPTION_GRACE_PERIOD_SERVICE = Symbol(
  "SUBSCRIPTION_GRACE_PERIOD_SERVICE",
);

export interface ISubscriptionGracePeriodService {
  getAccessStatus(
    farmId: string,
    now?: Date,
  ): Promise<SubscriptionAccessStatusDto>;

  assertWriteAccess(farmId: string, now?: Date): Promise<void>;

  assertReadAccess(farmId: string, now?: Date): Promise<void>;

  processSuspensions(
    asOfDate?: Date,
    traceId?: string,
  ): Promise<SubscriptionSuspensionResultDto>;
}
