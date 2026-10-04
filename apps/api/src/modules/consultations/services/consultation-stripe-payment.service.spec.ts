import { EnvService } from "../../../config/env.service";
import { ConsultationStripePaymentGateway } from "./consultation-stripe-payment.service";

describe("ConsultationStripePaymentGateway", () => {
  describe("Mock fallback mode (no STRIPE_SECRET_KEY)", () => {
    let gateway: ConsultationStripePaymentGateway;
    let mockEnvService: Partial<EnvService>;

    beforeEach(() => {
      mockEnvService = {
        stripeSecretKey: undefined,
      };
      gateway = new ConsultationStripePaymentGateway(
        mockEnvService as EnvService,
      );
    });

    it("should create simulated authorization hold", async () => {
      const result = await gateway.createAuthorizationHold(
        "consult-12345",
        2500,
        "USD",
        "farmer@example.com",
      );

      expect(result.paymentIntentId).toBe("pi_mock_hold_consult12345");
      expect(result.clientSecret).toBe("pi_mock_secret_consult12345");
      expect(result.amountCents).toBe(2500);
      expect(result.currency).toBe("USD");
    });

    it("should simulate capture for mock intent", async () => {
      const result = await gateway.captureHold("pi_mock_hold_consult12345", 2500);

      expect(result.paymentIntentId).toBe("pi_mock_hold_consult12345");
      expect(result.amountCents).toBe(2500);
      expect(result.captured).toBe(true);
    });

    it("should simulate release for mock intent", async () => {
      const result = await gateway.releaseHold("pi_mock_hold_consult12345");

      expect(result.paymentIntentId).toBe("pi_mock_hold_consult12345");
      expect(result.released).toBe(true);
    });
  });
});
