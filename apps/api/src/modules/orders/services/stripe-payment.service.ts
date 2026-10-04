import { Injectable, Logger } from "@nestjs/common";
import Stripe from "stripe";
import { EnvService } from "../../../config/env.service";
import {
  IPaymentGatewayService,
  PaymentIntentResult,
} from "./payment-gateway.service.interface";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

@Injectable()
export class StripePaymentService implements IPaymentGatewayService {
  private readonly logger = new Logger(StripePaymentService.name);
  public readonly gatewayName = "stripe";
  private readonly stripeClient: Stripe | null = null;

  constructor(private readonly envService: EnvService) {
    const apiKey = this.envService.stripeSecretKey;
    if (apiKey) {
      this.stripeClient = new Stripe(apiKey, {
        typescript: true,
      });
      this.logger.log("Stripe payment gateway client initialized.");
    } else {
      this.logger.warn(
        "STRIPE_SECRET_KEY is not configured. Stripe operations will be rejected."
      );
    }
  }

  public async createPaymentIntent(
    orderId: string,
    amountCents: number,
    currency: string,
    customerEmail?: string,
    metadata?: Record<string, string>
  ): Promise<PaymentIntentResult> {
    if (!this.stripeClient) {
      throw new ValidationDomainException(
        "Stripe payment provider is not configured on this environment."
      );
    }

    try {
      const intent = await this.stripeClient.paymentIntents.create({
        amount: amountCents,
        currency: currency.toLowerCase(),
        receipt_email: customerEmail,
        metadata: {
          orderId,
          ...(metadata ?? {}),
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      return {
        gatewayTxId: intent.id,
        clientSecret: intent.client_secret ?? undefined,
      };
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown Stripe error";
      this.logger.error(
        `Failed to create Stripe PaymentIntent for order ${orderId}: ${errorMessage}`
      );
      throw new ValidationDomainException(
        `Payment gateway initialization failed: ${errorMessage}`
      );
    }
  }
}
