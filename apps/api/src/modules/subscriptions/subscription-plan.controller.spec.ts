import { SubscriptionTier } from "@vetralink/shared-types";
import { SubscriptionPlanResponseDto } from "./dto";
import { ISubscriptionPlanService } from "./services/subscription-plan.service.interface";
import { SubscriptionPlanController } from "./subscription-plan.controller";

describe("SubscriptionPlanController", () => {
  let controller: SubscriptionPlanController;
  let mockService: jest.Mocked<ISubscriptionPlanService>;

  const mockPlanResponse: SubscriptionPlanResponseDto = {
    id: "b3b2ec62-9fa9-43c7-8bb3-dcf742f9a712",
    name: "Pro Farmer",
    tier: SubscriptionTier.PRO,
    priceMonthlyCents: 900,
    priceAnnualCents: 8900,
    maxAnimals: 30,
    features: {
      maxAnimals: 30,
      maxStaff: 3,
      teleVetPriority: "EXPEDITED",
      advancedAnalytics: true,
      bulkImportExport: true,
      customReports: false,
    },
    isActive: true,
    createdAt: "2026-09-01T00:00:00.000Z",
    annualSavingsCents: 1900,
    isUnlimitedAnimals: false,
  };

  beforeEach(() => {
    mockService = {
      getAvailablePlans: jest.fn(),
      getPlanByTier: jest.fn(),
      getPlanById: jest.fn(),
      seedDefaultPlans: jest.fn(),
      updatePlan: jest.fn(),
    };

    controller = new SubscriptionPlanController(mockService);
  });

  describe("getPlans()", () => {
    it("should return active plans", async () => {
      mockService.getAvailablePlans.mockResolvedValue([mockPlanResponse]);

      const result = await controller.getPlans({ includeInactive: false });

      expect(mockService.getAvailablePlans).toHaveBeenCalledWith(false);
      expect(result).toEqual([mockPlanResponse]);
    });
  });

  describe("getPlanByTier()", () => {
    it("should return plan for requested tier", async () => {
      mockService.getPlanByTier.mockResolvedValue(mockPlanResponse);

      const result = await controller.getPlanByTier(SubscriptionTier.PRO);

      expect(mockService.getPlanByTier).toHaveBeenCalledWith(SubscriptionTier.PRO);
      expect(result).toEqual(mockPlanResponse);
    });
  });

  describe("seedDefaultPlans()", () => {
    it("should invoke service to seed default plans", async () => {
      mockService.seedDefaultPlans.mockResolvedValue([mockPlanResponse]);

      const result = await controller.seedDefaultPlans();

      expect(mockService.seedDefaultPlans).toHaveBeenCalled();
      expect(result).toEqual([mockPlanResponse]);
    });
  });

  describe("updatePlan()", () => {
    it("should invoke service to update plan", async () => {
      mockService.updatePlan.mockResolvedValue(mockPlanResponse);

      const result = await controller.updatePlan(mockPlanResponse.id, {
        name: "Pro Farmer Plus",
      });

      expect(mockService.updatePlan).toHaveBeenCalledWith(mockPlanResponse.id, {
        name: "Pro Farmer Plus",
      });
      expect(result).toEqual(mockPlanResponse);
    });
  });
});
