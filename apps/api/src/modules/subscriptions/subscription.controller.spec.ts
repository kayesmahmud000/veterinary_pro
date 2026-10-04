import {
  FarmQuotaSummaryDto,
  JwtPayload,
  SubscriptionAccessMode,
  SubscriptionAccessStatusDto,
  SubscriptionBillingInterval,
  SubscriptionChangeResultDto,
  SubscriptionPlanChangeType,
  SubscriptionProrationPreviewDto,
  SubscriptionQuotaType,
  SubscriptionStatus,
  SubscriptionTier,
  UserRole,
  UserStatus,
} from "@vetralink/shared-types";
import { SubscriptionResponseDto } from "./dto";
import { ISubscriptionLifecycleService } from "./services/subscription-lifecycle.service.interface";
import { ISubscriptionPlanChangeService } from "./services/subscription-plan-change.service.interface";
import { ISubscriptionQuotaService } from "./services/subscription-quota.service.interface";
import { ISubscriptionGracePeriodService } from "./services/subscription-grace-period.service.interface";
import { IStripePortalService } from "./services/stripe-portal.service.interface";
import { SubscriptionController } from "./subscription.controller";

describe("SubscriptionController", () => {
  let controller: SubscriptionController;
  let mockService: jest.Mocked<ISubscriptionLifecycleService>;
  let mockQuotaService: jest.Mocked<ISubscriptionQuotaService>;
  let mockPlanChangeService: jest.Mocked<ISubscriptionPlanChangeService>;
  let mockPortalService: jest.Mocked<IStripePortalService>;
  let mockGracePeriodService: jest.Mocked<ISubscriptionGracePeriodService>;

  const mockUser: JwtPayload = {
    sub: "user-123",
    email: "farmer@vetralink.pro",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const mockResponse: SubscriptionResponseDto = {
    id: "sub-123",
    userId: "user-123",
    farmId: "farm-123",
    planId: "plan-123",
    status: SubscriptionStatus.ACTIVE,
    currentPeriodStart: "2026-09-01T00:00:00.000Z",
    currentPeriodEnd: "2026-10-01T00:00:00.000Z",
    gatewaySubId: "sub_123",
    cancelAtPeriodEnd: false,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-01T00:00:00.000Z",
    isActive: true,
    isTrial: false,
    isPastDue: false,
    daysRemaining: 18,
  };

  beforeEach(() => {
    mockService = {
      createTrialSubscription: jest.fn(),
      getFarmSubscription: jest.fn(),
      getUserSubscription: jest.fn(),
      activateSubscription: jest.fn(),
      markSubscriptionPastDue: jest.fn(),
      cancelSubscription: jest.fn(),
      reactivateSubscription: jest.fn(),
      processExpiredSubscriptions: jest.fn(),
    };

    mockQuotaService = {
      checkQuota: jest.fn(),
      assertQuotaAvailable: jest.fn(),
      getFarmQuotaUsage: jest.fn(),
    };

    mockPlanChangeService = {
      previewPlanChange: jest.fn(),
      changePlan: jest.fn(),
    };

    mockPortalService = {
      createCustomerPortalSession: jest.fn(),
    };

    mockGracePeriodService = {
      getAccessStatus: jest.fn(),
      assertWriteAccess: jest.fn(),
      assertReadAccess: jest.fn(),
      processSuspensions: jest.fn(),
    };

    controller = new SubscriptionController(
      mockService,
      mockQuotaService,
      mockPlanChangeService,
      mockPortalService,
      mockGracePeriodService,
    );
  });

  describe("getFarmAccessStatus()", () => {
    it("should return farm access status from grace period service", async () => {
      const mockAccessStatus: SubscriptionAccessStatusDto = {
        farmId: "farm-123",
        subscriptionId: "sub-123",
        status: SubscriptionStatus.PAST_DUE,
        accessMode: SubscriptionAccessMode.READ_ONLY,
        canRead: true,
        canWrite: false,
        daysPastDue: 5,
        gracePeriodDaysRemaining: 2,
        gracePeriodEnd: "2026-09-22T00:00:00.000Z",
        suspensionDate: "2026-09-22T00:00:00.000Z",
        message:
          "Account is in read-only mode due to overdue payment. Please update payment method to restore write access.",
      };

      mockGracePeriodService.getAccessStatus.mockResolvedValue(mockAccessStatus);

      const result = await controller.getFarmAccessStatus("farm-123");

      expect(mockGracePeriodService.getAccessStatus).toHaveBeenCalledWith("farm-123");
      expect(result).toEqual(mockAccessStatus);
    });
  });

  describe("getFarmQuota()", () => {
    it("should return farm quota summary from quota service", async () => {
      const mockSummary: FarmQuotaSummaryDto = {
        farmId: "farm-123",
        planTier: SubscriptionTier.STARTER,
        planName: "Starter",
        isSubscriptionActive: true,
        quotas: {
          animals: {
            quotaType: SubscriptionQuotaType.ANIMALS,
            currentUsage: 2,
            limit: 5,
            remaining: 3,
            isUnlimited: false,
            canAccommodate: true,
            planTier: SubscriptionTier.STARTER,
            upgradeTier: SubscriptionTier.PRO,
          },
          staff: {
            quotaType: SubscriptionQuotaType.STAFF,
            currentUsage: 1,
            limit: 1,
            remaining: 0,
            isUnlimited: false,
            canAccommodate: false,
            planTier: SubscriptionTier.STARTER,
            upgradeTier: SubscriptionTier.PRO,
          },
        },
        features: {
          maxAnimals: 5,
          maxStaff: 1,
          bulkImportExport: false,
          advancedAnalytics: false,
          customReports: false,
          teleVetPriority: "STANDARD",
        },
      };

      mockQuotaService.getFarmQuotaUsage.mockResolvedValue(mockSummary);

      const result = await controller.getFarmQuota("farm-123");

      expect(mockQuotaService.getFarmQuotaUsage).toHaveBeenCalledWith("farm-123");
      expect(result).toEqual(mockSummary);
    });
  });

  describe("getCurrentSubscription()", () => {
    it("should return user subscription", async () => {
      mockService.getUserSubscription.mockResolvedValue(mockResponse);

      const result = await controller.getCurrentSubscription(mockUser, "farm-123");

      expect(mockService.getUserSubscription).toHaveBeenCalledWith("user-123", "farm-123");
      expect(result).toEqual(mockResponse);
    });
  });

  describe("startTrial()", () => {
    it("should provision trial subscription", async () => {
      mockService.createTrialSubscription.mockResolvedValue(mockResponse);

      const result = await controller.startTrial(mockUser, {
        planTier: SubscriptionTier.PRO,
        trialDays: 14,
      });

      expect(mockService.createTrialSubscription).toHaveBeenCalledWith("user-123", {
        planTier: SubscriptionTier.PRO,
        trialDays: 14,
      });
      expect(result).toEqual(mockResponse);
    });
  });

  describe("cancelSubscription()", () => {
    it("should cancel subscription", async () => {
      mockService.cancelSubscription.mockResolvedValue({
        ...mockResponse,
        cancelAtPeriodEnd: true,
      });

      const result = await controller.cancelSubscription(mockResponse.id, {
        immediate: false,
      });

      expect(mockService.cancelSubscription).toHaveBeenCalledWith(mockResponse.id, {
        immediate: false,
      });
      expect(result.cancelAtPeriodEnd).toBe(true);
    });
  });

  describe("reactivateSubscription()", () => {
    it("should revoke cancellation", async () => {
      mockService.reactivateSubscription.mockResolvedValue(mockResponse);

      const result = await controller.reactivateSubscription(mockResponse.id);

      expect(mockService.reactivateSubscription).toHaveBeenCalledWith(mockResponse.id);
      expect(result.cancelAtPeriodEnd).toBe(false);
    });
  });

  describe("updateStatus()", () => {
    it("should activate subscription when status is ACTIVE", async () => {
      mockService.activateSubscription.mockResolvedValue(mockResponse);

      const result = await controller.updateStatus(mockResponse.id, {
        status: SubscriptionStatus.ACTIVE,
        gatewaySubId: "sub_new_gateway",
      });

      expect(mockService.activateSubscription).toHaveBeenCalledWith(mockResponse.id, {
        gatewaySubId: "sub_new_gateway",
        periodEnd: undefined,
      });
      expect(result).toEqual(mockResponse);
    });

    it("should mark subscription as PAST_DUE when status is PAST_DUE", async () => {
      mockService.markSubscriptionPastDue.mockResolvedValue({
        ...mockResponse,
        status: SubscriptionStatus.PAST_DUE,
      });

      const result = await controller.updateStatus(mockResponse.id, {
        status: SubscriptionStatus.PAST_DUE,
      });

      expect(mockService.markSubscriptionPastDue).toHaveBeenCalledWith(mockResponse.id);
      expect(result.status).toBe(SubscriptionStatus.PAST_DUE);
    });

    it("should immediately cancel subscription when status is CANCELED", async () => {
      mockService.cancelSubscription.mockResolvedValue({
        ...mockResponse,
        status: SubscriptionStatus.CANCELED,
      });

      const result = await controller.updateStatus(mockResponse.id, {
        status: SubscriptionStatus.CANCELED,
      });

      expect(mockService.cancelSubscription).toHaveBeenCalledWith(mockResponse.id, {
        immediate: true,
      });
      expect(result.status).toBe(SubscriptionStatus.CANCELED);
    });
  });

  describe("previewPlanChange()", () => {
    it("should return preview from planChangeService", async () => {
      const mockPreview: SubscriptionProrationPreviewDto = {
        subscriptionId: "sub-123",
        farmId: "farm-123",
        canProceed: true,
        quotaViolations: [],
        proration: {
          currentPlanTier: SubscriptionTier.PRO,
          currentPlanName: "Pro Farmer",
          currentInterval: SubscriptionBillingInterval.MONTHLY,
          currentPeriodStart: "2026-09-01T00:00:00.000Z",
          currentPeriodEnd: "2026-10-01T00:00:00.000Z",
          targetPlanTier: SubscriptionTier.ENTERPRISE,
          targetPlanName: "Commercial Enterprise",
          targetInterval: SubscriptionBillingInterval.MONTHLY,
          changeType: SubscriptionPlanChangeType.UPGRADE,
          effectiveDate: "2026-09-10T00:00:00.000Z",
          totalPeriodDays: 30,
          usedDays: 9,
          remainingDays: 21,
          unusedRatio: 0.7,
          currentPlanPriceCents: 900,
          unusedCreditCents: 630,
          targetPlanPriceCents: 2900,
          netAmountDueCents: 2270,
          creditBalanceCents: 0,
        },
      };

      mockPlanChangeService.previewPlanChange.mockResolvedValue(mockPreview);

      const result = await controller.previewPlanChange(
        "sub-123",
        {
          targetTier: SubscriptionTier.ENTERPRISE,
          billingInterval: SubscriptionBillingInterval.MONTHLY,
        },
        mockUser,
      );

      expect(mockPlanChangeService.previewPlanChange).toHaveBeenCalledWith(
        "sub-123",
        expect.objectContaining({
          targetTier: SubscriptionTier.ENTERPRISE,
        }),
        mockUser.sub,
      );
      expect(result.canProceed).toBe(true);
      expect(result.proration.netAmountDueCents).toBe(2270);
    });
  });

  describe("changePlan()", () => {
    it("should execute plan change via planChangeService", async () => {
      const mockChangeResult: SubscriptionChangeResultDto = {
        subscription: {
          ...mockResponse,
          planId: "plan-enterprise",
        },
        proration: {
          currentPlanTier: SubscriptionTier.PRO,
          currentPlanName: "Pro Farmer",
          currentInterval: SubscriptionBillingInterval.MONTHLY,
          currentPeriodStart: "2026-09-01T00:00:00.000Z",
          currentPeriodEnd: "2026-10-01T00:00:00.000Z",
          targetPlanTier: SubscriptionTier.ENTERPRISE,
          targetPlanName: "Commercial Enterprise",
          targetInterval: SubscriptionBillingInterval.MONTHLY,
          changeType: SubscriptionPlanChangeType.UPGRADE,
          effectiveDate: "2026-09-10T00:00:00.000Z",
          totalPeriodDays: 30,
          usedDays: 9,
          remainingDays: 21,
          unusedRatio: 0.7,
          currentPlanPriceCents: 900,
          unusedCreditCents: 630,
          targetPlanPriceCents: 2900,
          netAmountDueCents: 2270,
          creditBalanceCents: 0,
        },
        transactionId: "trace-xyz",
      };

      mockPlanChangeService.changePlan.mockResolvedValue(mockChangeResult);

      const result = await controller.changePlan(
        "sub-123",
        {
          targetTier: SubscriptionTier.ENTERPRISE,
          billingInterval: SubscriptionBillingInterval.MONTHLY,
        },
        mockUser,
      );

      expect(mockPlanChangeService.changePlan).toHaveBeenCalledWith(
        "sub-123",
        mockUser.sub,
        expect.objectContaining({
          targetTier: SubscriptionTier.ENTERPRISE,
        }),
      );
      expect(result.subscription.planId).toBe("plan-enterprise");
      expect(result.transactionId).toBe("trace-xyz");
    });
  });

  describe("createCustomerPortalSession()", () => {
    it("should return portal session URL from portalService for current user", async () => {
      mockPortalService.createCustomerPortalSession.mockResolvedValue({
        url: "https://billing.stripe.com/p/session/portal_123",
        customerId: "cus_123",
      });

      const result = await controller.createCustomerPortalSession(mockUser, {
        returnUrl: "https://app.vetralink.pro/settings/billing",
      });

      expect(mockPortalService.createCustomerPortalSession).toHaveBeenCalledWith(
        mockUser.sub,
        expect.objectContaining({
          returnUrl: "https://app.vetralink.pro/settings/billing",
        }),
      );
      expect(result.url).toBe("https://billing.stripe.com/p/session/portal_123");
      expect(result.customerId).toBe("cus_123");
    });
  });

  describe("createSubscriptionPortalSession()", () => {
    it("should return portal session URL for a specific subscription ID", async () => {
      mockPortalService.createCustomerPortalSession.mockResolvedValue({
        url: "https://billing.stripe.com/p/session/portal_sub_123",
        customerId: "cus_sub_123",
      });

      const result = await controller.createSubscriptionPortalSession(
        "sub-123",
        mockUser,
        {
          returnUrl: "https://app.vetralink.pro/settings/billing",
        },
      );

      expect(mockPortalService.createCustomerPortalSession).toHaveBeenCalledWith(
        mockUser.sub,
        expect.objectContaining({
          subscriptionId: "sub-123",
          returnUrl: "https://app.vetralink.pro/settings/billing",
        }),
      );
      expect(result.url).toBe("https://billing.stripe.com/p/session/portal_sub_123");
      expect(result.customerId).toBe("cus_sub_123");
    });
  });
});


