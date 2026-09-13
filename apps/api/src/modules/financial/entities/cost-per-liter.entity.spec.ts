import { ProfitLossInterval } from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import { CostPerLiterEntity } from "./cost-per-liter.entity";

describe("CostPerLiterEntity", () => {
  const farmId = "11111111-1111-1111-1111-111111111111";
  const startDate = "2026-09-01";
  const endDate = "2026-09-30";

  describe("Normal Profitable Operation", () => {
    it("should compute accurate cost per liter, operating cost per liter, revenue per liter, and net margin", () => {
      const entity = new CostPerLiterEntity({
        farmId,
        startDate,
        endDate,
        currency: "USD",
        interval: ProfitLossInterval.DAY,
        totalMilkYieldLiters: 10000,
        totalFeedExpense: 3500,
        totalOperatingExpense: 5000,
        totalMilkRevenue: 6500,
        timeline: [
          {
            period: "2026-09-01",
            milkYieldLiters: 5000,
            feedCost: 1750,
            operatingCost: 2500,
            milkRevenue: 3250,
          },
          {
            period: "2026-09-15",
            milkYieldLiters: 5000,
            feedCost: 1750,
            operatingCost: 2500,
            milkRevenue: 3250,
          },
        ],
      });

      expect(entity.farmId).toBe(farmId);
      expect(entity.startDate).toBe(startDate);
      expect(entity.endDate).toBe(endDate);
      expect(entity.currency).toBe("USD");
      expect(entity.daysCount).toBe(30);
      expect(entity.totalMilkYieldLiters).toBe(10000);
      expect(entity.averageDailyYieldLiters).toBe(333.333);

      // Feed cost per liter = 3500 / 10000 = 0.35
      expect(entity.feedCostPerLiter).toBe(0.35);

      // Operating cost per liter = 5000 / 10000 = 0.50
      expect(entity.operatingCostPerLiter).toBe(0.5);

      // Revenue per liter = 6500 / 10000 = 0.65
      expect(entity.revenuePerLiter).toBe(0.65);

      // Net margin per liter = 0.65 - 0.50 = +0.15
      expect(entity.netMarginPerLiter).toBe(0.15);
      expect(entity.isProfitablePerLiter).toBe(true);
      expect(entity.breakEvenMilkPrice).toBe(0.5);

      // Feed cost percentage of OPEX = 3500 / 5000 * 100 = 70.0%
      expect(entity.feedCostPercentage).toBe(70.0);

      // Timeline check
      expect(entity.timeline).toHaveLength(2);
      expect(entity.timeline[0]?.feedCostPerLiter).toBe(0.35);
      expect(entity.timeline[0]?.operatingCostPerLiter).toBe(0.5);
      expect(entity.timeline[0]?.netMarginPerLiter).toBe(0.15);
    });
  });

  describe("Zero Yield Safeguards", () => {
    it("should guard against zero milk yield without NaN or Infinity", () => {
      const entity = new CostPerLiterEntity({
        farmId,
        startDate,
        endDate,
        totalMilkYieldLiters: 0,
        totalFeedExpense: 2000,
        totalOperatingExpense: 3000,
        totalMilkRevenue: 0,
      });

      expect(entity.feedCostPerLiter).toBe(0);
      expect(entity.operatingCostPerLiter).toBe(0);
      expect(entity.revenuePerLiter).toBe(0);
      expect(entity.netMarginPerLiter).toBe(0);
      expect(entity.isProfitablePerLiter).toBe(false);
      expect(entity.averageDailyYieldLiters).toBe(0);
      expect(entity.feedCostPercentage).toBe(66.67);
    });
  });

  describe("Validation & Date Invariants", () => {
    it("should throw if startDate is after endDate", () => {
      expect(() => {
        new CostPerLiterEntity({
          farmId,
          startDate: "2026-10-01",
          endDate: "2026-09-01",
          totalMilkYieldLiters: 1000,
          totalFeedExpense: 300,
          totalOperatingExpense: 400,
          totalMilkRevenue: 500,
        });
      }).toThrow(ValidationDomainException);
    });
  });
});
