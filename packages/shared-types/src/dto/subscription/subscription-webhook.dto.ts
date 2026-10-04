export interface SubscriptionWebhookResultDto {
  received: boolean;
  eventId: string;
  eventType: string;
  subscriptionId?: string;
  status: "settled" | "already_processed" | "ignored" | "failed";
  message: string;
}
