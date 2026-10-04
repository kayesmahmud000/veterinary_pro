import {
  SaasMetricsSummaryDto,
  SaasMetricsTrendDto,
  SubscriptionTier,
} from "@vetralink/shared-types";
import { ISubscriptionMetricsService } from "../services/subscription-metrics.service.interface";
import { SubscriptionMetricsController } from "./subscription-metrics.controller";

describe("SubscriptionMetricsController", () => {
  let controller: SubscriptionMetricsController;
  let mockMetricsService: jest.Mocked<ISubscriptionMetricsService>;

  const mockSummary: SaasMetricsSummaryDto = {
    asOfDate: "2026-09-20T00:00:00.000Z",
    mrrCents: 45000,
    arrCents: 540000,
    arpuCents: 3000,
    ltvCents: 72000,
    activeSubscriptionsCount: 15,
    activePayingSubscriptionsCount: 15,
    trialingSubscriptionsCount: 3,
    pastDueSubscriptionsCount: 2,
    canceledSubscriptionsCount: 1,
    expiredSubscriptionsCount: 0,
    totalSubscriptionsCount: 21,
    customerChurnRatePercent: 4.5,
    revenueChurnRatePercent: 3.2,
    tierBreakdown: [
      {
        tier: SubscriptionTier.STARTER,
        tierName: "Starter",
        count: 5,
        activePayingCount: 5,
        mrrCents: 4500,
        percentageOfMrr: 10,
      },
      {
        tier: SubscriptionTier.PRO,
        tierName: "Pro Farmer",
        count: 8,
        activePayingCount: 8,
        mrrCents: 23200,
        percentageOfMrr: 51.56,
      },
      {
        tier: SubscriptionTier.ENTERPRISE,
        tierName: "Enterprise",
        count: 2,
        activePayingCount: 2,
        mrrCents: 17300,
        percentageOfMrr: 38.44,
      },
    ],
    statusBreakdown: [],
    dunningExposure: {
      totalPastDueCount: 2,
      atRiskMrrCents: 5800,
      gracePeriodCount: 1,
      readOnlyCount: 1,
      suspendedCount: 0,
    },
  };

  const mockTrend: SaasMetricsTrendDto = {
    startDate: "2026-04-01T00:00:00.000Z",
    endDate: "2026-09-20T23:59:59.999Z",
    timeline: [
      {
        period: "2026-04",
        mrrCents: 30000,
        arrCents: 360000,
        activeCount: 10,
        newSubscriptionsCount: 3,
        churnedSubscriptionsCount: 0,
        netGrowthCount: 3,
      },
      {
        period: "2026-05",
        mrrCents: 35000,
        arrCents: 420000,
        activeCount: 12,
        newSubscriptionsCount: 2,
        churnedSubscriptionsCount: 0,
        netGrowthCount: 2,
      },
    ],
  };

  beforeEach(() => {
    mockMetricsService = {
      getSummary: jest.fn(),
      getTrends: jest.fn(),
    };

    controller = new SubscriptionMetricsController(mockMetricsService);
  });

  describe("getSummary()", () => {
    it("should return summary without asOfDate parameter", async () => {
      mockMetricsService.getSummary.mockResolvedValue(mockSummary);

      const result = await controller.getSummary();

      expect(mockMetricsService.getSummary).toHaveBeenCalledWith(undefined);
      expect(result).toEqual(mockSummary);
    });

    it("should parse and forward asOfDate query parameter", async () => {
      mockMetricsService.getSummary.mockResolvedValue(mockSummary);

      const result = await controller.getSummary("2026-09-15T00:00:00.000Z");

      expect(mockMetricsService.getSummary).toHaveBeenCalledWith(
        new Date("2026-09-15T00:00:00.000Z"),
      );
      expect(result).toEqual(mockSummary);
    });
  });

  describe("getTrends()", () => {
    it("should return monthly trends from service", async () => {
      mockMetricsService.getTrends.mockResolvedValue(mockTrend);

      const query = { months: 6 };
      const result = await controller.getTrends(query);

      expect(mockMetricsService.getTrends).toHaveBeenCalledWith(query);
      expect(result).toEqual(mockTrend);
    });
  });
});
