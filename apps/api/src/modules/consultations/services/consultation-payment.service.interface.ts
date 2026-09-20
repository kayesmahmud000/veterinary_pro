import {
  CaptureConsultationPaymentResultDto,
  ConsultationPaymentHoldResultDto,
  ReleaseConsultationHoldResultDto,
} from "@vetralink/shared-types";

export interface IConsultationPaymentService {
  createHold(
    consultationId: string,
    farmId: string,
    userId: string,
    traceId?: string,
  ): Promise<ConsultationPaymentHoldResultDto>;

  confirmHold(
    consultationId: string,
    paymentIntentId: string,
    userId: string,
    traceId?: string,
  ): Promise<ConsultationPaymentHoldResultDto>;

  capturePayment(
    consultationId: string,
    userId: string,
    traceId?: string,
  ): Promise<CaptureConsultationPaymentResultDto>;

  releaseHold(
    consultationId: string,
    reason: string,
    userId: string,
    traceId?: string,
  ): Promise<ReleaseConsultationHoldResultDto>;
}

export const CONSULTATION_PAYMENT_SERVICE = "CONSULTATION_PAYMENT_SERVICE";
