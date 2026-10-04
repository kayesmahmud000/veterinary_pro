export interface MfsIpnPayload {
  readonly provider?: string;
  readonly transactionId: string;
  readonly gatewayTxId: string;
  readonly amountCents: number;
  readonly currency?: string;
  readonly status: "VALID" | "FAILED" | "CANCELLED" | "SUCCESS";
  readonly signature?: string;
  readonly rawPayload?: Record<string, unknown>;
}

export interface MfsWebhookResult {
  readonly received: boolean;
  readonly provider: string;
  readonly orderId?: string;
  readonly gatewayTxId: string;
  readonly status: "processed" | "already_processed" | "ignored" | "failed";
  readonly message: string;
}

export interface IMfsWebhookService {
  processIpn(
    payload: MfsIpnPayload,
    signatureHeader?: string,
    traceId?: string
  ): Promise<MfsWebhookResult>;

  processSslCommerz(
    payload: Record<string, unknown>,
    signatureHeader?: string,
    traceId?: string
  ): Promise<MfsWebhookResult>;

  processBkash(
    payload: Record<string, unknown>,
    signatureHeader?: string,
    traceId?: string
  ): Promise<MfsWebhookResult>;
}

export const MFS_WEBHOOK_SERVICE = "MFS_WEBHOOK_SERVICE";
