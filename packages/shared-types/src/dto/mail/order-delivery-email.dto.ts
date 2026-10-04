export interface OrderDeliveryEmailJobData {
  orderId: string;
  recipientEmail: string;
  recipientName?: string;
  traceId?: string;
}

export interface OrderItemEmailDetail {
  itemId: string;
  productId: string;
  productTitle: string;
  productType: string;
  priceCents: number;
  downloadUrl: string;
  maxDownloads: number;
  remainingDownloads: number;
}

export interface EmailDispatchResultDto {
  success: boolean;
  messageId?: string;
  provider: string;
  recipient: string;
  dispatchedAt: string;
}
