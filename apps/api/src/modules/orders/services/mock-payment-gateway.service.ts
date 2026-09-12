import { Injectable, Logger } from "@nestjs/common";
import {
  IPaymentGatewayService,
  PaymentIntentResult,
} from "./payment-gateway.service.interface";

@Injectable()
export class MockPaymentGatewayService implements IPaymentGatewayService {
  private readonly logger = new Logger(MockPaymentGatewayService.name);
  public readonly gatewayName = "mock";

  public async createPaymentIntent(
    orderId: string,
    amountCents: number,
    currency: string,
    customerEmail?: string,
    metadata?: Record<string, string>
  ): Promise<PaymentIntentResult> {
    const cleanId = orderId.replace(/-/g, "");
    const gatewayTxId = `pi_mock_${cleanId}`;
    const clientSecret = `pi_mock_secret_${cleanId}`;
    const checkoutUrl = `https://checkout.vetralink.pro/mock-pay/${orderId}`;

    this.logger.log(
      `[MockPaymentGateway] Created simulated intent: ${gatewayTxId} for order ${orderId} (${amountCents} ${currency})`
    );

    return {
      gatewayTxId,
      clientSecret,
      checkoutUrl,
    };
  }
}
