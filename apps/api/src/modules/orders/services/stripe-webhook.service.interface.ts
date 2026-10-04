export interface WebhookProcessingResult {
  readonly received: boolean;
  readonly eventId: string;
  readonly eventType: string;
  readonly orderId?: string;
  readonly status: "processed" | "already_processed" | "ignored" | "failed";
  readonly message: string;
}

export interface IStripeWebhookService {
  processWebhook(
    rawBody: Buffer,
    signature: string,
    traceId?: string
  ): Promise<WebhookProcessingResult>;
}

export const STRIPE_WEBHOOK_SERVICE = "STRIPE_WEBHOOK_SERVICE";
