import { UserRole, UserStatus } from "@vetralink/shared-types";
import {
  EntityNotFoundException,
  ForbiddenOperationException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import { EnvService } from "../../../config/env.service";
import { IAuditLogRepository } from "../../audit/repositories/audit-log.repository.interface";
import { UserEntity } from "../../users/entities/user.entity";
import { IUserRepository } from "../../users/repositories/user.repository.interface";
import { SubscriptionEntity } from "../entities/subscription.entity";
import { ISubscriptionRepository } from "../repositories/subscription.repository.interface";
import { StripePortalService } from "./stripe-portal.service";

const mockRetrieve = jest.fn();
const mockCustomersList = jest.fn();
const mockCustomersCreate = jest.fn();
const mockPortalSessionsCreate = jest.fn();

jest.mock("stripe", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return {
        subscriptions: {
          retrieve: (...args: unknown[]) => mockRetrieve(...args),
        },
        customers: {
          list: (...args: unknown[]) => mockCustomersList(...args),
          create: (...args: unknown[]) => mockCustomersCreate(...args),
        },
        billingPortal: {
          sessions: {
            create: (...args: unknown[]) => mockPortalSessionsCreate(...args),
          },
        },
      };
    }),
  };
});

describe("StripePortalService", () => {
  let service: StripePortalService;
  let mockEnvService: jest.Mocked<EnvService>;
  let mockUserRepo: jest.Mocked<IUserRepository>;
  let mockSubRepo: jest.Mocked<ISubscriptionRepository>;
  let mockAuditLogRepo: jest.Mocked<IAuditLogRepository>;

  const mockUser = UserEntity.create({
    id: "user-123",
    email: "farmer@vetralink.pro",
    name: "John Farmer",
    passwordHash: "hash",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  });

  const mockSubscription = SubscriptionEntity.fromPersistence({
    id: "sub-123",
    userId: "user-123",
    farmId: "farm-123",
    planId: "plan-pro",
    status: "ACTIVE",
    currentPeriodStart: new Date("2026-09-01"),
    currentPeriodEnd: new Date("2026-10-01"),
    gatewaySubId: "sub_stripe_real_123",
    cancelAtPeriodEnd: false,
    createdAt: new Date("2026-09-01"),
    updatedAt: new Date("2026-09-01"),
  });

  beforeEach(() => {
    mockRetrieve.mockReset();
    mockCustomersList.mockReset();
    mockCustomersCreate.mockReset();
    mockPortalSessionsCreate.mockReset();

    mockEnvService = {
      get stripeSecretKey() {
        return "";
      },
    } as any;

    mockUserRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByPhoneHash: jest.fn(),
      update: jest.fn(),
      softDelete: jest.fn(),
      count: jest.fn(),
    } as any;

    mockSubRepo = {
      findById: jest.fn(),
      findByFarmId: jest.fn(),
      findByUserId: jest.fn(),
      findByGatewaySubId: jest.fn(),
      save: jest.fn(),
      findExpiredSubscriptions: jest.fn(),
    };

    mockAuditLogRepo = {
      record: jest.fn().mockResolvedValue({} as any),
      findByEntity: jest.fn(),
      findByTraceId: jest.fn(),
      query: jest.fn(),
    };
  });

  describe("Unconfigured / Mock Mode (Local / Test)", () => {
    beforeEach(() => {
      mockEnvService = {
        get stripeSecretKey() {
          return "";
        },
      } as any;
      service = new StripePortalService(
        mockEnvService,
        mockUserRepo,
        mockSubRepo,
        mockAuditLogRepo,
      );
    });

    it("should return simulated mock customer portal URL when STRIPE_SECRET_KEY is empty", async () => {
      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockSubRepo.findByUserId.mockResolvedValue([mockSubscription]);

      const result = await service.createCustomerPortalSession("user-123");

      expect(result.url).toContain("https://billing.stripe.com/p/session/test_mock_");
      expect(result.customerId).toContain("cus_mock_");
      expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "CREATE_CUSTOMER_PORTAL_SESSION",
          userId: "user-123",
        }),
      );
    });

    it("should throw EntityNotFoundException if user does not exist", async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(
        service.createCustomerPortalSession("non-existent"),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw ForbiddenOperationException if user tries to access another user's subscription", async () => {
      mockUserRepo.findById.mockResolvedValue(mockUser);
      const otherUserSub = SubscriptionEntity.fromPersistence({
        ...mockSubscription,
        id: "sub-other",
        userId: "other-user",
      } as any);

      mockSubRepo.findById.mockResolvedValue(otherUserSub);

      await expect(
        service.createCustomerPortalSession("user-123", {
          subscriptionId: "sub-other",
        }),
      ).rejects.toThrow(ForbiddenOperationException);
    });
  });

  describe("Configured Stripe Client Mode", () => {
    beforeEach(() => {
      mockEnvService = {
        get stripeSecretKey() {
          return "sk_test_mock_key_12345";
        },
      } as any;
      service = new StripePortalService(
        mockEnvService,
        mockUserRepo,
        mockSubRepo,
        mockAuditLogRepo,
      );
    });

    it("should retrieve existing customer from Stripe subscription and create session", async () => {
      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockSubRepo.findByUserId.mockResolvedValue([mockSubscription]);

      mockRetrieve.mockResolvedValue({
        id: "sub_stripe_real_123",
        customer: "cus_existing_999",
      });

      mockPortalSessionsCreate.mockResolvedValue({
        url: "https://billing.stripe.com/p/session/live_session_123",
      });

      const result = await service.createCustomerPortalSession("user-123");

      expect(mockRetrieve).toHaveBeenCalledWith("sub_stripe_real_123");
      expect(mockPortalSessionsCreate).toHaveBeenCalledWith({
        customer: "cus_existing_999",
        return_url: "https://app.vetralink.pro/settings/billing",
      });
      expect(result.url).toBe("https://billing.stripe.com/p/session/live_session_123");
      expect(result.customerId).toBe("cus_existing_999");
    });

    it("should fallback to searching Stripe customers by email when subscription has no gatewaySubId", async () => {
      const subWithoutGateway = SubscriptionEntity.fromPersistence({
        ...mockSubscription,
        gatewaySubId: null,
      } as any);

      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockSubRepo.findByUserId.mockResolvedValue([subWithoutGateway]);

      mockCustomersList.mockResolvedValue({
        data: [{ id: "cus_found_by_email" }],
      });

      mockPortalSessionsCreate.mockResolvedValue({
        url: "https://billing.stripe.com/p/session/live_email_session",
      });

      const result = await service.createCustomerPortalSession("user-123");

      expect(mockCustomersList).toHaveBeenCalledWith({
        email: "farmer@vetralink.pro",
        limit: 1,
      });
      expect(result.customerId).toBe("cus_found_by_email");
      expect(result.url).toBe("https://billing.stripe.com/p/session/live_email_session");
    });

    it("should provision a new Stripe customer if not found and generate session", async () => {
      const subWithoutGateway = SubscriptionEntity.fromPersistence({
        ...mockSubscription,
        gatewaySubId: null,
      } as any);

      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockSubRepo.findByUserId.mockResolvedValue([subWithoutGateway]);

      mockCustomersList.mockResolvedValue({ data: [] });
      mockCustomersCreate.mockResolvedValue({
        id: "cus_newly_provisioned",
      });

      mockPortalSessionsCreate.mockResolvedValue({
        url: "https://billing.stripe.com/p/session/live_new_session",
      });

      const result = await service.createCustomerPortalSession("user-123");

      expect(mockCustomersCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "farmer@vetralink.pro",
          name: "John Farmer",
        }),
      );
      expect(result.customerId).toBe("cus_newly_provisioned");
    });

    it("should throw ValidationDomainException if Stripe billingPortal.sessions.create fails", async () => {
      mockUserRepo.findById.mockResolvedValue(mockUser);
      mockSubRepo.findByUserId.mockResolvedValue([mockSubscription]);

      mockRetrieve.mockResolvedValue({
        id: "sub_stripe_real_123",
        customer: "cus_existing_999",
      });

      mockPortalSessionsCreate.mockRejectedValue(new Error("Stripe API down"));

      await expect(
        service.createCustomerPortalSession("user-123"),
      ).rejects.toThrow(ValidationDomainException);
    });
  });
});
