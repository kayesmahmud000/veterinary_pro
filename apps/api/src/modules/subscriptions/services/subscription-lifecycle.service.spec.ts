import { SubscriptionStatus, SubscriptionTier } from "@vetralink/shared-types";
import { EntityNotFoundException } from "../../../common/exceptions/domain.exception";
import { SubscriptionPlanEntity } from "../entities/subscription-plan.entity";
import { SubscriptionEntity } from "../entities/subscription.entity";
import { ISubscriptionPlanRepository } from "../repositories/subscription-plan.repository.interface";
import { ISubscriptionRepository } from "../repositories/subscription.repository.interface";
import { SubscriptionLifecycleService } from "./subscription-lifecycle.service";

describe("SubscriptionLifecycleService", () => {
  let service: SubscriptionLifecycleService;
  let mockSubRepo: jest.Mocked<ISubscriptionRepository>;
  let mockPlanRepo: jest.Mocked<ISubscriptionPlanRepository>;

  const mockPlan = SubscriptionPlanEntity.create({
    id: "plan-123",
    name: "Pro Farmer",
    tier: SubscriptionTier.PRO,
    priceMonthlyCents: 900,
    priceAnnualCents: 8900,
    maxAnimals: 30,
  });

  let mockSub: SubscriptionEntity;

  beforeEach(() => {
    mockSub = SubscriptionEntity.createTrial({
      id: "sub-123",
      userId: "user-123",
      farmId: "farm-123",
      planId: mockPlan.id,
      plan: mockPlan,
      trialDays: 14,
    });

    mockSubRepo = {
      findById: jest.fn(),
      findByFarmId: jest.fn(),
      findByUserId: jest.fn(),
      findByGatewaySubId: jest.fn(),
      save: jest.fn(),
      findExpiredSubscriptions: jest.fn(),
    };

    mockPlanRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByTier: jest.fn(),
      save: jest.fn(),
      upsertDefaultPlans: jest.fn(),
    };

    service = new SubscriptionLifecycleService(mockSubRepo, mockPlanRepo);
  });

  describe("createTrialSubscription()", () => {
    it("should provision a new trial subscription if no active one exists for the farm", async () => {
      mockPlanRepo.findByTier.mockResolvedValue(mockPlan);
      mockSubRepo.findByFarmId.mockResolvedValue(null);
      mockSubRepo.save.mockImplementation(async (sub) => sub);

      const result = await service.createTrialSubscription("user-123", {
        farmId: "farm-123",
        planTier: SubscriptionTier.PRO,
        trialDays: 14,
      });

      expect(mockPlanRepo.findByTier).toHaveBeenCalledWith(SubscriptionTier.PRO);
      expect(mockSubRepo.save).toHaveBeenCalled();
      expect(result.status).toBe(SubscriptionStatus.TRIALING);
      expect(result.isTrial).toBe(true);
      expect(result.userId).toBe("user-123");
    });

    it("should return existing subscription if farm already has an active subscription", async () => {
      mockPlanRepo.findByTier.mockResolvedValue(mockPlan);
      mockSubRepo.findByFarmId.mockResolvedValue(mockSub);

      const result = await service.createTrialSubscription("user-123", {
        farmId: "farm-123",
        planTier: SubscriptionTier.PRO,
      });

      expect(mockSubRepo.save).not.toHaveBeenCalled();
      expect(result.id).toBe(mockSub.id);
    });

    it("should throw EntityNotFoundException if requested tier is not in database", async () => {
      mockPlanRepo.findByTier.mockResolvedValue(null);

      await expect(
        service.createTrialSubscription("user-123", {
          planTier: SubscriptionTier.ENTERPRISE,
        }),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe("getFarmSubscription()", () => {
    it("should return existing farm subscription with plan attached", async () => {
      mockSubRepo.findByFarmId.mockResolvedValue(mockSub);

      const result = await service.getFarmSubscription("farm-123");

      expect(result.id).toBe(mockSub.id);
      expect(result.plan?.name).toBe("Pro Farmer");
    });

    it("should throw EntityNotFoundException if no subscription exists for farm", async () => {
      mockSubRepo.findByFarmId.mockResolvedValue(null);

      await expect(service.getFarmSubscription("farm-999")).rejects.toThrow(
        EntityNotFoundException,
      );
    });
  });

  describe("getUserSubscription()", () => {
    it("should return user subscription", async () => {
      mockSubRepo.findByUserId.mockResolvedValue([mockSub]);

      const result = await service.getUserSubscription("user-123");

      expect(result.id).toBe(mockSub.id);
    });

    it("should throw EntityNotFoundException if user has no subscriptions", async () => {
      mockSubRepo.findByUserId.mockResolvedValue([]);

      await expect(service.getUserSubscription("user-999")).rejects.toThrow(
        EntityNotFoundException,
      );
    });
  });

  describe("activateSubscription()", () => {
    it("should transition subscription to ACTIVE status and record gateway sub ID", async () => {
      mockSubRepo.findById.mockResolvedValue(mockSub);
      mockSubRepo.save.mockImplementation(async (sub) => sub);

      const result = await service.activateSubscription(mockSub.id, {
        gatewaySubId: "sub_stripe_abc",
      });

      expect(result.status).toBe(SubscriptionStatus.ACTIVE);
      expect(result.gatewaySubId).toBe("sub_stripe_abc");
    });
  });

  describe("markSubscriptionPastDue()", () => {
    it("should mark subscription as PAST_DUE", async () => {
      mockSubRepo.findById.mockResolvedValue(mockSub);
      mockSubRepo.save.mockImplementation(async (sub) => sub);

      const result = await service.markSubscriptionPastDue(mockSub.id);

      expect(result.status).toBe(SubscriptionStatus.PAST_DUE);
      expect(result.isPastDue).toBe(true);
    });
  });

  describe("cancelSubscription()", () => {
    it("should set cancelAtPeriodEnd by default", async () => {
      mockSubRepo.findById.mockResolvedValue(mockSub);
      mockSubRepo.save.mockImplementation(async (sub) => sub);

      const result = await service.cancelSubscription(mockSub.id, {
        immediate: false,
      });

      expect(result.cancelAtPeriodEnd).toBe(true);
    });

    it("should immediately cancel when requested", async () => {
      mockSubRepo.findById.mockResolvedValue(mockSub);
      mockSubRepo.save.mockImplementation(async (sub) => sub);

      const result = await service.cancelSubscription(mockSub.id, {
        immediate: true,
      });

      expect(result.status).toBe(SubscriptionStatus.CANCELED);
      expect(result.cancelAtPeriodEnd).toBe(false);
    });
  });

  describe("reactivateSubscription()", () => {
    it("should revoke pending cancellation", async () => {
      mockSub.requestCancellation({ immediate: false });
      mockSubRepo.findById.mockResolvedValue(mockSub);
      mockSubRepo.save.mockImplementation(async (sub) => sub);

      const result = await service.reactivateSubscription(mockSub.id);

      expect(result.cancelAtPeriodEnd).toBe(false);
    });
  });

  describe("processExpiredSubscriptions()", () => {
    it("should transition overdue subscriptions to EXPIRED", async () => {
      mockSubRepo.findExpiredSubscriptions.mockResolvedValue([mockSub]);
      mockSubRepo.save.mockImplementation(async (sub) => sub);

      const result = await service.processExpiredSubscriptions();

      expect(result.processedCount).toBe(1);
      expect(mockSub.status).toBe(SubscriptionStatus.EXPIRED);
    });
  });
});
