export interface PaymentIntentResult {
  gatewayTxId: string;
  clientSecret?: string;
  checkoutUrl?: string;
}

export interface IPaymentGatewayService {
  readonly gatewayName: string;

  createPaymentIntent(
    orderId: string,
    amountCents: number,
    currency: string,
    customerEmail?: string,
    metadata?: Record<string, string>
  ): Promise<PaymentIntentResult>;
}

export const PAYMENT_GATEWAY_SERVICE = "PAYMENT_GATEWAY_SERVICE";
