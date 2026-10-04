import { Injectable, Logger } from "@nestjs/common";
import Stripe from "stripe";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import { EnvService } from "../../../config/env.service";
import {
  ConsultationAuthorizationHoldResult,
  ConsultationCaptureResult,
  ConsultationReleaseResult,
  IConsultationPaymentGateway,
} from "./consultation-payment-gateway.interface";

@Injectable()
export class ConsultationStripePaymentGateway
  implements IConsultationPaymentGateway
{
  private readonly logger = new Logger(ConsultationStripePaymentGateway.name);
  public readonly gatewayName = "stripe";
  private readonly stripeClient: Stripe | null = null;

  constructor(private readonly envService: EnvService) {
    const apiKey = this.envService.stripeSecretKey;
    if (apiKey) {
      this.stripeClient = new Stripe(apiKey, {
        typescript: true,
      });
      this.logger.log("Consultation Stripe payment gateway client initialized.");
    } else {
      this.logger.warn(
        "STRIPE_SECRET_KEY is not configured. Falling back to mock consultation payment gateway mode.",
      );
    }
  }

  public async createAuthorizationHold(
    consultationId: string,
    amountCents: number,
    currency: string,
    customerEmail?: string,
    metadata?: Record<string, string>,
  ): Promise<ConsultationAuthorizationHoldResult> {
    if (!this.stripeClient) {
      const cleanId = consultationId.replace(/-/g, "");
      const paymentIntentId = `pi_mock_hold_${cleanId}`;
      const clientSecret = `pi_mock_secret_${cleanId}`;
      this.logger.log(
        `[MockPaymentGateway] Created simulated authorization hold: ${paymentIntentId} for consultation ${consultationId} (${amountCents} ${currency})`,
      );
      return {
        paymentIntentId,
        clientSecret,
        amountCents,
        currency,
      };
    }

    try {
      const intent = await this.stripeClient.paymentIntents.create({
        amount: amountCents,
        currency: currency.toLowerCase(),
        capture_method: "manual",
        receipt_email: customerEmail,
        metadata: {
          consultationId,
          ...(metadata ?? {}),
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        paymentIntentId: intent.id,
        clientSecret: intent.client_secret ?? undefined,
        amountCents,
        currency,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown Stripe error";
      this.logger.error(
        `Failed to create Stripe authorization hold for consultation ${consultationId}: ${errorMessage}`,
      );
      throw new ValidationDomainException(
        `Consultation payment authorization failed: ${errorMessage}`,
      );
    }
  }

  public async captureHold(
    paymentIntentId: string,
    amountCents?: number,
  ): Promise<ConsultationCaptureResult> {
    if (!this.stripeClient || paymentIntentId.startsWith("pi_mock_")) {
      this.logger.log(
        `[MockPaymentGateway] Simulated capture for intent: ${paymentIntentId} (amount: ${amountCents ?? "full"})`,
      );
      return {
        paymentIntentId,
        amountCents: amountCents ?? 0,
        captured: true,
      };
    }

    try {
      const captureParams: Stripe.PaymentIntentCaptureParams = {};
      if (amountCents !== undefined && amountCents > 0) {
        captureParams.amount_to_capture = amountCents;
      }

      const intent = await this.stripeClient.paymentIntents.capture(
        paymentIntentId,
        captureParams,
      );

      return {
        paymentIntentId: intent.id,
        amountCents: intent.amount_received,
        captured: intent.status === "succeeded",
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown Stripe error";
      this.logger.error(
        `Failed to capture Stripe payment for intent ${paymentIntentId}: ${errorMessage}`,
      );
      throw new ValidationDomainException(
        `Consultation payment capture failed: ${errorMessage}`,
      );
    }
  }

  public async releaseHold(
    paymentIntentId: string,
  ): Promise<ConsultationReleaseResult> {
    if (!this.stripeClient || paymentIntentId.startsWith("pi_mock_")) {
      this.logger.log(
        `[MockPaymentGateway] Simulated hold release/void for intent: ${paymentIntentId}`,
      );
      return {
        paymentIntentId,
        released: true,
      };
    }

    try {
      const intent = await this.stripeClient.paymentIntents.cancel(
        paymentIntentId,
        {
          cancellation_reason: "abandoned",
        },
      );

      return {
        paymentIntentId: intent.id,
        released: intent.status === "canceled",
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown Stripe error";
      this.logger.error(
        `Failed to release Stripe authorization hold for intent ${paymentIntentId}: ${errorMessage}`,
      );
      throw new ValidationDomainException(
        `Consultation payment hold release failed: ${errorMessage}`,
      );
    }
  }
}
