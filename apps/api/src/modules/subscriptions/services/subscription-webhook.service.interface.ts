import { SubscriptionWebhookResultDto } from "@vetralink/shared-types";

export const SUBSCRIPTION_WEBHOOK_SERVICE = Symbol(
  "SUBSCRIPTION_WEBHOOK_SERVICE",
);

export interface ISubscriptionWebhookService {
  processWebhook(
    rawBody: Buffer,
    signature: string,
    traceId?: string,
  ): Promise<SubscriptionWebhookResultDto>;
}
