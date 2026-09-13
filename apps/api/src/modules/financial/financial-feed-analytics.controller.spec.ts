import { Reflector } from "@nestjs/core";
import { Test, TestingModule } from "@nestjs/testing";
import { ProfitLossInterval } from "@vetralink/shared-types";
import { TOKEN_SERVICE } from "../auth/services/token.service.interface";
import { FARM_MEMBER_REPOSITORY } from "../farms/repositories/farm-member.repository.interface";
import { FinancialFeedAnalyticsController } from "./financial-feed-analytics.controller";
import {
  FARM_FEED_ANALYTICS_SERVICE,
  IFarmFeedAnalyticsService,
} from "./services/farm-feed-analytics.service.interface";

describe("FinancialFeedAnalyticsController", () => {
  let controller: FinancialFeedAnalyticsController;
  let feedAnalyticsService: {
    computeCostPerLiter: jest.Mock;
    computeFeedConversion: jest.Mock;
  };

  const farmId = "11111111-1111-1111-1111-111111111111";

  beforeEach(async () => {
    feedAnalyticsService = {
      computeCostPerLiter: jest.fn(),
      computeFeedConversion: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinancialFeedAnalyticsController],
      providers: [
        {
          provide: FARM_FEED_ANALYTICS_SERVICE,
          useValue: feedAnalyticsService,
        },
        {
          provide: TOKEN_SERVICE,
          useValue: { verifyAccessToken: jest.fn() },
        },
        {
          provide: FARM_MEMBER_REPOSITORY,
          useValue: { findByFarmAndUser: jest.fn() },
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<FinancialFeedAnalyticsController>(
      FinancialFeedAnalyticsController
    );
  });

  describe("getCostPerLiter", () => {
    it("should delegate to computeCostPerLiter with farmId, query, and traceId", async () => {
      const mockResult = {
        farmId,
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        currency: "USD",
        interval: ProfitLossInterval.DAY,
        totalMilkYieldLiters: 10000,
        averageDailyYieldLiters: 333.333,
        daysCount: 30,
        totalFeedExpense: 3500,
        totalOperatingExpense: 5000,
        totalMilkRevenue: 6500,
        feedCostPerLiter: 0.35,
        operatingCostPerLiter: 0.5,
        revenuePerLiter: 0.65,
        netMarginPerLiter: 0.15,
        feedCostPercentage: 70.0,
        breakEvenMilkPrice: 0.5,
        isProfitablePerLiter: true,
        timeline: [],
      };

      feedAnalyticsService.computeCostPerLiter.mockResolvedValueOnce(
        mockResult
      );

      const query = {
        startDate: "2026-09-01",
        endDate: "2026-09-30",
      };

      const result = await controller.getCostPerLiter(
        farmId,
        query,
        "trace-abc"
      );

      expect(feedAnalyticsService.computeCostPerLiter).toHaveBeenCalledWith(
        farmId,
        query,
        "trace-abc"
      );
      expect(result).toBe(mockResult);
    });
  });

  describe("getFeedConversion", () => {
    it("should delegate to computeFeedConversion with farmId, query, and traceId", async () => {
      const mockResult = {
        farmId,
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        currency: "USD",
        totalFeedConsumedKg: 2000,
        totalFeedExpense: 800,
        averageFeedCostPerKg: 0.4,
        growthFcr: {
          totalWeightGainKg: 200,
          overallFcr: 10.0,
          feedCostPerKgGain: 4.0,
          animalsEvaluatedCount: 1,
          rating: "POOR",
          animals: [],
        },
        dairyFeedEfficiency: {
          totalMilkYieldLiters: 3000,
          feedToMilkRatioKgPerLiter: 0.67,
          milkPerKgFeedLiters: 1.5,
          rating: "EXCELLENT",
        },
      };

      feedAnalyticsService.computeFeedConversion.mockResolvedValueOnce(
        mockResult
      );

      const query = {
        startDate: "2026-09-01",
        endDate: "2026-09-30",
      };

      const result = await controller.getFeedConversion(
        farmId,
        query,
        "trace-def"
      );

      expect(feedAnalyticsService.computeFeedConversion).toHaveBeenCalledWith(
        farmId,
        query,
        "trace-def"
      );
      expect(result).toBe(mockResult);
    });
  });
});
