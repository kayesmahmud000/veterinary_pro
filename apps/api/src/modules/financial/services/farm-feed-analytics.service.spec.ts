import { Test, TestingModule } from "@nestjs/testing";
import { ProfitLossInterval } from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import {
  FARM_FEED_ANALYTICS_REPOSITORY,
  IFarmFeedAnalyticsRepository,
} from "../repositories/farm-feed-analytics.repository.interface";
import { FarmFeedAnalyticsService } from "./farm-feed-analytics.service";

describe("FarmFeedAnalyticsService", () => {
  let service: FarmFeedAnalyticsService;
  let feedRepo: {
    getCostPerLiterData: jest.Mock;
    getFeedConversionData: jest.Mock;
  };

  const farmId = "99999999-9999-9999-9999-999999999999";

  beforeEach(async () => {
    feedRepo = {
      getCostPerLiterData: jest.fn(),
      getFeedConversionData: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FarmFeedAnalyticsService,
        {
          provide: FARM_FEED_ANALYTICS_REPOSITORY,
          useValue: feedRepo,
        },
      ],
    }).compile();

    service = module.get<FarmFeedAnalyticsService>(FarmFeedAnalyticsService);
  });

  describe("computeCostPerLiter", () => {
    it("should compute cost per liter response from repository data", async () => {
      feedRepo.getCostPerLiterData.mockResolvedValueOnce({
        currency: "USD",
        totalMilkYieldLiters: 10000,
        totalFeedExpense: 3500,
        totalOperatingExpense: 5000,
        totalMilkRevenue: 6500,
        timeline: [],
      });

      const response = await service.computeCostPerLiter(
        farmId,
        {
          startDate: "2026-09-01",
          endDate: "2026-09-30",
          interval: ProfitLossInterval.DAY,
        },
        "trace-1"
      );

      expect(feedRepo.getCostPerLiterData).toHaveBeenCalledWith({
        farmId,
        startDate: new Date("2026-09-01T00:00:00.000Z"),
        endDate: new Date("2026-09-30T23:59:59.999Z"),
        animalId: undefined,
        currency: undefined,
        interval: ProfitLossInterval.DAY,
      });

      expect(response.farmId).toBe(farmId);
      expect(response.totalMilkYieldLiters).toBe(10000);
      expect(response.feedCostPerLiter).toBe(0.35);
      expect(response.operatingCostPerLiter).toBe(0.5);
      expect(response.revenuePerLiter).toBe(0.65);
      expect(response.netMarginPerLiter).toBe(0.15);
      expect(response.isProfitablePerLiter).toBe(true);
    });

    it("should throw if startDate is after endDate", async () => {
      await expect(
        service.computeCostPerLiter(farmId, {
          startDate: "2026-10-01",
          endDate: "2026-09-01",
        })
      ).rejects.toThrow(ValidationDomainException);
    });
  });

  describe("computeFeedConversion", () => {
    it("should compute feed conversion response from repository data", async () => {
      feedRepo.getFeedConversionData.mockResolvedValueOnce({
        currency: "USD",
        totalFeedConsumedKg: 2000,
        totalFeedExpense: 800,
        totalMilkYieldLiters: 3000,
        animalWeightData: [
          {
            animalId: "animal-1",
            initialWeightKg: 200,
            finalWeightKg: 250,
          },
        ],
      });

      const response = await service.computeFeedConversion(farmId, {
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        assumedFeedKg: 2000,
      });

      expect(feedRepo.getFeedConversionData).toHaveBeenCalledWith({
        farmId,
        startDate: new Date("2026-09-01T00:00:00.000Z"),
        endDate: new Date("2026-09-30T23:59:59.999Z"),
        animalId: undefined,
        assumedFeedKg: 2000,
        assumedFeedCostPerKg: undefined,
      });

      expect(response.farmId).toBe(farmId);
      expect(response.totalFeedConsumedKg).toBe(2000);
      expect(response.averageFeedCostPerKg).toBe(0.4);
      expect(response.growthFcr.totalWeightGainKg).toBe(50);
      expect(response.dairyFeedEfficiency.totalMilkYieldLiters).toBe(3000);
    });
  });
});
