import { SetMetadata } from "@nestjs/common";
import { SubscriptionQuotaType } from "@vetralink/shared-types";

export const CHECK_QUOTA_KEY = "CHECK_QUOTA_KEY";

export interface CheckQuotaOptions {
  type: SubscriptionQuotaType;
  increment?: number;
}

export const CheckQuota = (
  type: SubscriptionQuotaType,
  increment = 1,
) => SetMetadata(CHECK_QUOTA_KEY, { type, increment } as CheckQuotaOptions);
