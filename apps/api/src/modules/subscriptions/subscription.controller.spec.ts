import {
  FarmQuotaSummaryDto,
  JwtPayload,
  SubscriptionQuotaType,
  SubscriptionStatus,
  SubscriptionTier,
  UserRole,
  UserStatus,
} from "@vetralink/shared-types";
import { SubscriptionResponseDto } from "./dto";
import { ISubscriptionLifecycleService } from "./services/subscription-lifecycle.service.interface";
import { ISubscriptionQuotaService } from "./services/subscription-quota.service.interface";
import { SubscriptionController } from "./subscription.controller";

describe("SubscriptionController", () => {
  let controller: SubscriptionController;
  let mockService: jest.Mocked<ISubscriptionLifecycleService>;
  let mockQuotaService: jest.Mocked<ISubscriptionQuotaService>;

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

    controller = new SubscriptionController(mockService, mockQuotaService);
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
});
