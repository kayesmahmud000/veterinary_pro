import {
  DEFAULT_SUBSCRIPTION_PLANS,
  SubscriptionTier,
} from "@vetralink/shared-types";
import { EntityNotFoundException } from "../../../common/exceptions/domain.exception";
import { SubscriptionPlanEntity } from "../entities/subscription-plan.entity";
import { ISubscriptionPlanRepository } from "../repositories/subscription-plan.repository.interface";
import { SubscriptionPlanService } from "./subscription-plan.service";

describe("SubscriptionPlanService", () => {
  let service: SubscriptionPlanService;
  let mockRepo: jest.Mocked<ISubscriptionPlanRepository>;

  const mockEntity = SubscriptionPlanEntity.create({
    id: "b3b2ec62-9fa9-43c7-8bb3-dcf742f9a712",
    name: "Pro Farmer",
    tier: SubscriptionTier.PRO,
    priceMonthlyCents: 900,
    priceAnnualCents: 8900,
    maxAnimals: 30,
  });

  beforeEach(() => {
    mockRepo = {
      findAll: jest.fn(),
      findById: jest.fn(),
      findByTier: jest.fn(),
      save: jest.fn(),
      upsertDefaultPlans: jest.fn(),
    };

    service = new SubscriptionPlanService(mockRepo);
  });

  describe("onModuleInit()", () => {
    it("should seed default plans if existing plans are fewer than defaults", async () => {
      mockRepo.findAll.mockResolvedValue([]);
      mockRepo.upsertDefaultPlans.mockResolvedValue([mockEntity]);

      await service.onModuleInit();

      expect(mockRepo.findAll).toHaveBeenCalledWith(true);
      expect(mockRepo.upsertDefaultPlans).toHaveBeenCalledWith(DEFAULT_SUBSCRIPTION_PLANS);
    });

    it("should not seed if all default plans exist", async () => {
      mockRepo.findAll.mockResolvedValue([mockEntity, mockEntity, mockEntity]);

      await service.onModuleInit();

      expect(mockRepo.findAll).toHaveBeenCalledWith(true);
      expect(mockRepo.upsertDefaultPlans).not.toHaveBeenCalled();
    });
  });

  describe("getAvailablePlans()", () => {
    it("should return mapped response DTOs", async () => {
      mockRepo.findAll.mockResolvedValue([mockEntity]);

      const result = await service.getAvailablePlans(false);

      expect(mockRepo.findAll).toHaveBeenCalledWith(false);
      expect(result).toHaveLength(1);
      expect(result[0]?.tier).toBe(SubscriptionTier.PRO);
      expect(result[0]?.annualSavingsCents).toBe(1900);
    });
  });

  describe("getPlanByTier()", () => {
    it("should return plan DTO when tier exists", async () => {
      mockRepo.findByTier.mockResolvedValue(mockEntity);

      const result = await service.getPlanByTier(SubscriptionTier.PRO);

      expect(mockRepo.findByTier).toHaveBeenCalledWith(SubscriptionTier.PRO);
      expect(result.name).toBe("Pro Farmer");
      expect(result.tier).toBe(SubscriptionTier.PRO);
    });

    it("should throw EntityNotFoundException when tier does not exist", async () => {
      mockRepo.findByTier.mockResolvedValue(null);

      await expect(service.getPlanByTier(SubscriptionTier.ENTERPRISE)).rejects.toThrow(
        EntityNotFoundException,
      );
    });
  });

  describe("getPlanById()", () => {
    it("should return plan DTO when ID exists", async () => {
      mockRepo.findById.mockResolvedValue(mockEntity);

      const result = await service.getPlanById(mockEntity.id);

      expect(mockRepo.findById).toHaveBeenCalledWith(mockEntity.id);
      expect(result.id).toBe(mockEntity.id);
    });

    it("should throw EntityNotFoundException when ID does not exist", async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(service.getPlanById("non-existent")).rejects.toThrow(
        EntityNotFoundException,
      );
    });
  });

  describe("seedDefaultPlans()", () => {
    it("should upsert default plans and return DTOs", async () => {
      mockRepo.upsertDefaultPlans.mockResolvedValue([mockEntity]);

      const result = await service.seedDefaultPlans();

      expect(mockRepo.upsertDefaultPlans).toHaveBeenCalledWith(DEFAULT_SUBSCRIPTION_PLANS);
      expect(result).toHaveLength(1);
    });
  });

  describe("updatePlan()", () => {
    it("should update plan fields and save to repository", async () => {
      mockRepo.findById.mockResolvedValue(mockEntity);
      mockRepo.save.mockImplementation(async (plan) => plan);

      const result = await service.updatePlan(mockEntity.id, {
        name: "Pro Farmer Plus",
        priceMonthlyCents: 1000,
      });

      expect(mockRepo.findById).toHaveBeenCalledWith(mockEntity.id);
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.name).toBe("Pro Farmer Plus");
      expect(result.priceMonthlyCents).toBe(1000);
    });

    it("should throw EntityNotFoundException if plan to update does not exist", async () => {
      mockRepo.findById.mockResolvedValue(null);

      await expect(
        service.updatePlan("non-existent", { name: "New Name" }),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });
});
