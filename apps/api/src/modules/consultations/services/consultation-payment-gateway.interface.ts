export interface ConsultationAuthorizationHoldResult {
  paymentIntentId: string;
  clientSecret?: string;
  amountCents: number;
  currency: string;
}

export interface ConsultationCaptureResult {
  paymentIntentId: string;
  amountCents: number;
  captured: boolean;
}

export interface ConsultationReleaseResult {
  paymentIntentId: string;
  released: boolean;
}

export interface IConsultationPaymentGateway {
  readonly gatewayName: string;

  createAuthorizationHold(
    consultationId: string,
    amountCents: number,
    currency: string,
    customerEmail?: string,
    metadata?: Record<string, string>,
  ): Promise<ConsultationAuthorizationHoldResult>;

  captureHold(
    paymentIntentId: string,
    amountCents?: number,
  ): Promise<ConsultationCaptureResult>;

  releaseHold(paymentIntentId: string): Promise<ConsultationReleaseResult>;
}

export const CONSULTATION_PAYMENT_GATEWAY = "CONSULTATION_PAYMENT_GATEWAY";
