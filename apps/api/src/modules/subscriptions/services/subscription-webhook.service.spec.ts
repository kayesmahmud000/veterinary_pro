import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { SubscriptionStatus } from "@vetralink/shared-types";
import {
  IDEMPOTENCY_SERVICE,
  IIdempotencyService,
} from "../../../common/idempotency";
import { EnvService } from "../../../config/env.service";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../../audit/repositories/audit-log.repository.interface";
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from "../../prisma/interfaces/transaction.interface";
import { SubscriptionEntity } from "../entities/subscription.entity";
import {
  ISubscriptionRepository,
  SUBSCRIPTION_REPOSITORY,
} from "../repositories/subscription.repository.interface";
import { SubscriptionWebhookService } from "./subscription-webhook.service";

const mockConstructEvent = jest.fn();

jest.mock("stripe", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return {
        webhooks: {
          constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
        },
      };
    }),
  };
});

describe("SubscriptionWebhookService", () => {
  let service: SubscriptionWebhookService;
  let subRepo: jest.Mocked<ISubscriptionRepository>;
  let auditLogRepo: jest.Mocked<IAuditLogRepository>;
  let txManager: jest.Mocked<ITransactionManager>;
  let envService: jest.Mocked<EnvService>;
  let idempotencyService: jest.Mocked<IIdempotencyService>;

  const mockSubId = "sub-uuid-1111";
  const mockUserId = "user-uuid-2222";
  const mockPlanId = "plan-pro";
  const mockGatewaySubId = "sub_stripe_12345";

  const createMockSubscription = (
    status: SubscriptionStatus = SubscriptionStatus.ACTIVE,
  ) => {
    return SubscriptionEntity.fromPersistence({
      id: mockSubId,
      userId: mockUserId,
      farmId: "farm-1",
      planId: mockPlanId,
      status,
      currentPeriodStart: new Date("2026-09-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-10-01T00:00:00.000Z"),
      gatewaySubId: mockGatewaySubId,
      cancelAtPeriodEnd: false,
      createdAt: new Date("2026-09-01T00:00:00.000Z"),
      updatedAt: new Date("2026-09-01T00:00:00.000Z"),
    });
  };

  beforeEach(async () => {
    mockConstructEvent.mockReset();

    envService = {
      stripeSecretKey: "sk_test_123456",
      stripeWebhookSecret: "whsec_test_secret",
      nodeEnv: "test",
    } as unknown as jest.Mocked<EnvService>;

    subRepo = {
      findById: jest.fn(),
      findByFarmId: jest.fn(),
      findByUserId: jest.fn(),
      findByGatewaySubId: jest.fn(),
      save: jest.fn(),
      findExpiredSubscriptions: jest.fn(),
    };

    auditLogRepo = {
      record: jest.fn(),
      findByEntity: jest.fn(),
      findByTraceId: jest.fn(),
      query: jest.fn(),
    };

    txManager = {
      run: jest.fn().mockImplementation(async (callback) => {
        return callback({} as never);
      }),
    };

    idempotencyService = {
      execute: jest
        .fn()
        .mockImplementation(async (_key, _params, _ttl, fn) => fn()),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionWebhookService,
        {
          provide: EnvService,
          useValue: envService,
        },
        {
          provide: SUBSCRIPTION_REPOSITORY,
          useValue: subRepo,
        },
        {
          provide: AUDIT_LOG_REPOSITORY,
          useValue: auditLogRepo,
        },
        {
          provide: TRANSACTION_MANAGER,
          useValue: txManager,
        },
        {
          provide: IDEMPOTENCY_SERVICE,
          useValue: idempotencyService,
        },
      ],
    }).compile();

    service = module.get<SubscriptionWebhookService>(
      SubscriptionWebhookService,
    );
  });

  describe("processWebhook - Signature Verification", () => {
    it("should throw BadRequestException if Stripe constructEvent fails signature check", async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error("Invalid signature");
      });

      const rawBody = Buffer.from(JSON.stringify({ id: "evt_1" }));

      await expect(
        service.processWebhook(rawBody, "invalid_sig"),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("processWebhook - invoice.payment_failed", () => {
    it("should transition subscription from ACTIVE to PAST_DUE and record audit log", async () => {
      const mockEvent = {
        id: "evt_payment_failed_1",
        type: "invoice.payment_failed",
        data: {
          object: {
            id: "in_12345",
            subscription: mockGatewaySubId,
            attempt_count: 1,
            next_payment_attempt: 1726600000,
            amount_due: 4900,
            currency: "usd",
            hosted_invoice_url: "https://invoice.stripe.com/12345",
          },
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);
      const subscription = createMockSubscription(SubscriptionStatus.ACTIVE);
      subRepo.findByGatewaySubId.mockResolvedValue(subscription);

      const rawBody = Buffer.from(JSON.stringify(mockEvent));
      const result = await service.processWebhook(
        rawBody,
        "valid_sig",
        "trace-1",
      );

      expect(subRepo.findByGatewaySubId).toHaveBeenCalledWith(mockGatewaySubId);
      expect(subscription.status).toBe(SubscriptionStatus.PAST_DUE);
      expect(subRepo.save).toHaveBeenCalledWith(subscription, expect.anything());
      expect(auditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          action: "SUBSCRIPTION_PAYMENT_FAILED",
          entityType: "Subscription",
          entityId: mockSubId,
          newValues: expect.objectContaining({
            status: SubscriptionStatus.PAST_DUE,
            gatewaySubId: mockGatewaySubId,
            invoiceId: "in_12345",
            attemptCount: 1,
          }),
          traceId: "trace-1",
        }),
        expect.anything(),
      );

      expect(result).toEqual({
        received: true,
        eventId: "evt_payment_failed_1",
        eventType: "invoice.payment_failed",
        subscriptionId: mockSubId,
        status: "settled",
        message: expect.stringContaining("marked PAST_DUE"),
      });
    });

    it("should handle already PAST_DUE subscription gracefully on subsequent retries", async () => {
      const mockEvent = {
        id: "evt_payment_failed_retry",
        type: "invoice.payment_failed",
        data: {
          object: {
            id: "in_12345",
            subscription: mockGatewaySubId,
            attempt_count: 2,
            next_payment_attempt: null,
            amount_due: 4900,
            currency: "usd",
          },
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);
      const subscription = createMockSubscription(SubscriptionStatus.PAST_DUE);
      subRepo.findByGatewaySubId.mockResolvedValue(subscription);

      const rawBody = Buffer.from(JSON.stringify(mockEvent));
      const result = await service.processWebhook(rawBody, "valid_sig");

      expect(subscription.status).toBe(SubscriptionStatus.PAST_DUE);
      expect(subRepo.save).toHaveBeenCalled();
      expect(auditLogRepo.record).toHaveBeenCalled();
      expect(result.status).toBe("settled");
    });

    it("should return ignored if invoice has no subscription identifier", async () => {
      const mockEvent = {
        id: "evt_no_sub",
        type: "invoice.payment_failed",
        data: {
          object: {
            id: "in_one_off",
            subscription: null,
            lines: { data: [] },
          },
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);

      const rawBody = Buffer.from(JSON.stringify(mockEvent));
      const result = await service.processWebhook(rawBody, "valid_sig");

      expect(result.status).toBe("ignored");
      expect(result.message).toBe("Invoice is not tied to a subscription.");
      expect(subRepo.save).not.toHaveBeenCalled();
    });

    it("should return ignored if subscription is not found in database", async () => {
      const mockEvent = {
        id: "evt_sub_not_found",
        type: "invoice.payment_failed",
        data: {
          object: {
            id: "in_unknown",
            subscription: "sub_nonexistent",
          },
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);
      subRepo.findByGatewaySubId.mockResolvedValue(null);

      const rawBody = Buffer.from(JSON.stringify(mockEvent));
      const result = await service.processWebhook(rawBody, "valid_sig");

      expect(result.status).toBe("ignored");
      expect(result.message).toContain("not found");
      expect(subRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("processWebhook - invoice.payment_succeeded", () => {
    it("should reactivate/renew subscription to ACTIVE and record audit log", async () => {
      const futureEndSeconds = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;
      const mockEvent = {
        id: "evt_payment_succeeded_1",
        type: "invoice.payment_succeeded",
        data: {
          object: {
            id: "in_renewal_99",
            subscription: mockGatewaySubId,
            amount_paid: 4900,
            currency: "usd",
            lines: {
              data: [
                {
                  period: {
                    end: futureEndSeconds,
                  },
                },
              ],
            },
          },
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);
      const subscription = createMockSubscription(SubscriptionStatus.PAST_DUE);
      subRepo.findByGatewaySubId.mockResolvedValue(subscription);

      const rawBody = Buffer.from(JSON.stringify(mockEvent));
      const result = await service.processWebhook(rawBody, "valid_sig");

      expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
      expect(subRepo.save).toHaveBeenCalledWith(subscription, expect.anything());
      expect(auditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          action: "SUBSCRIPTION_PAYMENT_SUCCEEDED",
          entityType: "Subscription",
          entityId: mockSubId,
          newValues: expect.objectContaining({
            status: SubscriptionStatus.ACTIVE,
            gatewaySubId: mockGatewaySubId,
            invoiceId: "in_renewal_99",
            amountPaid: 4900,
          }),
        }),
        expect.anything(),
      );
      expect(result.status).toBe("settled");
    });

    it("should return ignored if invoice has no subscription identifier", async () => {
      const mockEvent = {
        id: "evt_success_no_sub",
        type: "invoice.payment_succeeded",
        data: {
          object: {
            id: "in_standalone",
            subscription: null,
          },
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);

      const rawBody = Buffer.from(JSON.stringify(mockEvent));
      const result = await service.processWebhook(rawBody, "valid_sig");

      expect(result.status).toBe("ignored");
      expect(subRepo.save).not.toHaveBeenCalled();
    });

    it("should return ignored if subscription matching gatewaySubId not found", async () => {
      const mockEvent = {
        id: "evt_success_unmatched",
        type: "invoice.payment_succeeded",
        data: {
          object: {
            id: "in_standalone",
            subscription: "sub_ghost",
          },
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);
      subRepo.findByGatewaySubId.mockResolvedValue(null);

      const rawBody = Buffer.from(JSON.stringify(mockEvent));
      const result = await service.processWebhook(rawBody, "valid_sig");

      expect(result.status).toBe("ignored");
      expect(subRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("processWebhook - customer.subscription.deleted", () => {
    it("should cancel subscription immediately and record audit log", async () => {
      const mockEvent = {
        id: "evt_sub_deleted_1",
        type: "customer.subscription.deleted",
        data: {
          object: {
            id: mockGatewaySubId,
          },
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);
      const subscription = createMockSubscription(SubscriptionStatus.ACTIVE);
      subRepo.findByGatewaySubId.mockResolvedValue(subscription);

      const rawBody = Buffer.from(JSON.stringify(mockEvent));
      const result = await service.processWebhook(rawBody, "valid_sig");

      expect(subscription.status).toBe(SubscriptionStatus.CANCELED);
      expect(subRepo.save).toHaveBeenCalledWith(subscription, expect.anything());
      expect(auditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          action: "SUBSCRIPTION_CANCELED_BY_STRIPE",
          entityType: "Subscription",
          entityId: mockSubId,
        }),
        expect.anything(),
      );
      expect(result.status).toBe("settled");
    });

    it("should return ignored if subscription to delete is not found", async () => {
      const mockEvent = {
        id: "evt_sub_deleted_not_found",
        type: "customer.subscription.deleted",
        data: {
          object: {
            id: "sub_not_found",
          },
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);
      subRepo.findByGatewaySubId.mockResolvedValue(null);

      const rawBody = Buffer.from(JSON.stringify(mockEvent));
      const result = await service.processWebhook(rawBody, "valid_sig");

      expect(result.status).toBe("ignored");
      expect(subRepo.save).not.toHaveBeenCalled();
    });
  });

  describe("processWebhook - Unhandled Event", () => {
    it("should safely ignore unhandled event types", async () => {
      const mockEvent = {
        id: "evt_unhandled_type",
        type: "customer.created",
        data: {
          object: {
            id: "cus_123",
          },
        },
      };

      mockConstructEvent.mockReturnValue(mockEvent);

      const rawBody = Buffer.from(JSON.stringify(mockEvent));
      const result = await service.processWebhook(rawBody, "valid_sig");

      expect(result).toEqual({
        received: true,
        eventId: "evt_unhandled_type",
        eventType: "customer.created",
        status: "ignored",
        message: "Unhandled event type: customer.created",
      });
      expect(subRepo.save).not.toHaveBeenCalled();
    });
  });
});
