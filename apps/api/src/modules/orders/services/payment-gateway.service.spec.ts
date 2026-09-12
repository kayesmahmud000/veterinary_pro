import { MockPaymentGatewayService } from "./mock-payment-gateway.service";
import { StripePaymentService } from "./stripe-payment.service";
import { EnvService } from "../../../config/env.service";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

jest.mock("stripe", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return {
        paymentIntents: {
          create: jest.fn().mockImplementation(async (params: { amount: number }) => {
            if (params.amount <= 0) {
              throw new Error("Invalid amount");
            }
            return {
              id: "pi_stripe_mock_123",
              client_secret: "pi_stripe_mock_123_secret",
            };
          }),
        },
      };
    }),
  };
});

describe("Payment Gateway Services", () => {
  describe("MockPaymentGatewayService", () => {
    let mockService: MockPaymentGatewayService;

    beforeEach(() => {
      mockService = new MockPaymentGatewayService();
    });

    it("should have gatewayName 'mock'", () => {
      expect(mockService.gatewayName).toBe("mock");
    });

    it("should create deterministic simulated payment intent", async () => {
      const result = await mockService.createPaymentIntent(
        "order-uuid-1234",
        4900,
        "USD",
        "customer@vetralink.pro"
      );

      expect(result.gatewayTxId).toBe("pi_mock_orderuuid1234");
      expect(result.clientSecret).toBe("pi_mock_secret_orderuuid1234");
      expect(result.checkoutUrl).toBe(
        "https://checkout.vetralink.pro/mock-pay/order-uuid-1234"
      );
    });
  });

  describe("StripePaymentService", () => {
    let mockEnvService: jest.Mocked<EnvService>;

    beforeEach(() => {
      mockEnvService = {
        stripeSecretKey: "sk_test_1234567890",
      } as unknown as jest.Mocked<EnvService>;
    });

    it("should have gatewayName 'stripe'", () => {
      const stripeService = new StripePaymentService(mockEnvService);
      expect(stripeService.gatewayName).toBe("stripe");
    });

    it("should create Stripe payment intent when configured", async () => {
      const stripeService = new StripePaymentService(mockEnvService);
      const result = await stripeService.createPaymentIntent(
        "order-123",
        5000,
        "USD",
        "customer@vetralink.pro"
      );

      expect(result.gatewayTxId).toBe("pi_stripe_mock_123");
      expect(result.clientSecret).toBe("pi_stripe_mock_123_secret");
    });

    it("should throw ValidationDomainException when STRIPE_SECRET_KEY is absent", async () => {
      const unconfiguredEnv = {
        stripeSecretKey: undefined,
      } as unknown as jest.Mocked<EnvService>;

      const stripeService = new StripePaymentService(unconfiguredEnv);

      await expect(
        stripeService.createPaymentIntent("order-123", 5000, "USD")
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException when Stripe API throws an error", async () => {
      const stripeService = new StripePaymentService(mockEnvService);

      await expect(
        stripeService.createPaymentIntent("order-123", -10, "USD")
      ).rejects.toThrow(ValidationDomainException);
    });
  });
});
