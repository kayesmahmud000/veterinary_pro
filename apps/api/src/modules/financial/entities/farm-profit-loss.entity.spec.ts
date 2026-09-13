import {
  ProfitLossInterval,
  TransactionCategory,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import { FarmProfitLossEntity } from "./farm-profit-loss.entity";

describe("FarmProfitLossEntity", () => {
  const farmId = "9f8a7b6c-5d4e-3f2a-1b0c-9d8e7f6a5b4c";
  const startDate = "2026-09-01";
  const endDate = "2026-09-30";

  describe("Profitable Scenario", () => {
    it("should compute positive net profit, margin %, operating ratio %, and category percentages", () => {
      const entity = new FarmProfitLossEntity({
        farmId,
        startDate,
        endDate,
        currency: "USD",
        interval: ProfitLossInterval.DAY,
        revenueAggregates: [
          {
            category: TransactionCategory.MILK_SALES,
            amount: 4000,
            transactionCount: 20,
          },
          {
            category: TransactionCategory.MANURE,
            amount: 1000,
            transactionCount: 5,
          },
        ],
        expenseAggregates: [
          {
            category: TransactionCategory.FEED,
            amount: 2000,
            transactionCount: 10,
          },
          {
            category: TransactionCategory.MEDICINE,
            amount: 1000,
            transactionCount: 4,
          },
        ],
        revenueTimeline: [
          { period: "2026-09-01", amount: 2000, transactionCount: 10 },
          { period: "2026-09-15", amount: 3000, transactionCount: 15 },
        ],
        expenseTimeline: [
          { period: "2026-09-01", amount: 1500, transactionCount: 7 },
          { period: "2026-09-15", amount: 1500, transactionCount: 7 },
        ],
      });

      expect(entity.farmId).toBe(farmId);
      expect(entity.startDate).toBe(startDate);
      expect(entity.endDate).toBe(endDate);
      expect(entity.currency).toBe("USD");
      expect(entity.totalRevenue).toBe(5000);
      expect(entity.totalExpense).toBe(3000);
      expect(entity.netProfit).toBe(2000);
      expect(entity.isProfitable).toBe(true);
      expect(entity.profitMarginPercentage).toBe(40.0);
      expect(entity.operatingExpenseRatio).toBe(60.0);
      expect(entity.revenueTransactionsCount).toBe(25);
      expect(entity.expenseTransactionsCount).toBe(14);

      // Revenue breakdown
      expect(entity.revenueBreakdown).toEqual([
        {
          category: TransactionCategory.MILK_SALES,
          amount: 4000,
          transactionCount: 20,
          percentage: 80.0,
        },
        {
          category: TransactionCategory.MANURE,
          amount: 1000,
          transactionCount: 5,
          percentage: 20.0,
        },
      ]);

      // Expense breakdown
      expect(entity.expenseBreakdown).toEqual([
        {
          category: TransactionCategory.FEED,
          amount: 2000,
          transactionCount: 10,
          percentage: 66.67,
        },
        {
          category: TransactionCategory.MEDICINE,
          amount: 1000,
          transactionCount: 4,
          percentage: 33.33,
        },
      ]);
    });
  });

  describe("Loss Scenario", () => {
    it("should compute negative net profit and negative margin", () => {
      const entity = new FarmProfitLossEntity({
        farmId,
        startDate,
        endDate,
        revenueAggregates: [
          {
            category: TransactionCategory.MILK_SALES,
            amount: 2000,
            transactionCount: 5,
          },
        ],
        expenseAggregates: [
          {
            category: TransactionCategory.FEED,
            amount: 3000,
            transactionCount: 8,
          },
        ],
        revenueTimeline: [],
        expenseTimeline: [],
      });

      expect(entity.totalRevenue).toBe(2000);
      expect(entity.totalExpense).toBe(3000);
      expect(entity.netProfit).toBe(-1000);
      expect(entity.isProfitable).toBe(false);
      expect(entity.profitMarginPercentage).toBe(-50.0);
      expect(entity.operatingExpenseRatio).toBe(150.0);
    });
  });

  describe("Zero Division Boundaries", () => {
    it("should handle zero revenue with positive expenses safely", () => {
      const entity = new FarmProfitLossEntity({
        farmId,
        startDate,
        endDate,
        revenueAggregates: [],
        expenseAggregates: [
          {
            category: TransactionCategory.FEED,
            amount: 1250,
            transactionCount: 3,
          },
        ],
        revenueTimeline: [],
        expenseTimeline: [],
      });

      expect(entity.totalRevenue).toBe(0);
      expect(entity.totalExpense).toBe(1250);
      expect(entity.netProfit).toBe(-1250);
      expect(entity.isProfitable).toBe(false);
      expect(entity.profitMarginPercentage).toBe(-100.0);
      expect(entity.operatingExpenseRatio).toBe(100.0);
    });

    it("should handle both zero revenue and zero expenses", () => {
      const entity = new FarmProfitLossEntity({
        farmId,
        startDate,
        endDate,
        revenueAggregates: [],
        expenseAggregates: [],
        revenueTimeline: [],
        expenseTimeline: [],
      });

      expect(entity.totalRevenue).toBe(0);
      expect(entity.totalExpense).toBe(0);
      expect(entity.netProfit).toBe(0);
      expect(entity.isProfitable).toBe(false);
      expect(entity.profitMarginPercentage).toBe(0.0);
      expect(entity.operatingExpenseRatio).toBe(0.0);
    });
  });

  describe("Timeline Synchronization", () => {
    it("should merge, sort, and calculate net profit across asynchronous timeline dates", () => {
      const entity = new FarmProfitLossEntity({
        farmId,
        startDate,
        endDate,
        revenueAggregates: [],
        expenseAggregates: [],
        revenueTimeline: [
          { period: "2026-09-01", amount: 1000, transactionCount: 2 },
          { period: "2026-09-05", amount: 2000, transactionCount: 3 },
        ],
        expenseTimeline: [
          { period: "2026-09-03", amount: 500, transactionCount: 1 },
          { period: "2026-09-05", amount: 800, transactionCount: 2 },
        ],
      });

      const timeline = entity.timeline;
      expect(timeline).toHaveLength(3);

      // 2026-09-01 (Only revenue)
      expect(timeline[0]).toEqual({
        period: "2026-09-01",
        revenue: 1000,
        expense: 0,
        netProfit: 1000,
        marginPercentage: 100.0,
      });

      // 2026-09-03 (Only expense)
      expect(timeline[1]).toEqual({
        period: "2026-09-03",
        revenue: 0,
        expense: 500,
        netProfit: -500,
        marginPercentage: -100.0,
      });

      // 2026-09-05 (Both)
      expect(timeline[2]).toEqual({
        period: "2026-09-05",
        revenue: 2000,
        expense: 800,
        netProfit: 1200,
        marginPercentage: 60.0,
      });
    });
  });

  describe("Previous Period Comparison", () => {
    it("should calculate growth rates when previous period is provided", () => {
      const entity = new FarmProfitLossEntity({
        farmId,
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        revenueAggregates: [
          {
            category: TransactionCategory.MILK_SALES,
            amount: 6000,
            transactionCount: 10,
          },
        ],
        expenseAggregates: [
          {
            category: TransactionCategory.FEED,
            amount: 3000,
            transactionCount: 5,
          },
        ],
        revenueTimeline: [],
        expenseTimeline: [],
        previousPeriod: {
          startDate: "2026-08-01",
          endDate: "2026-08-31",
          totalRevenue: 5000,
          totalExpense: 2000,
        },
      });

      expect(entity.comparison).toBeDefined();
      expect(entity.comparison?.previousRevenue).toBe(5000);
      expect(entity.comparison?.previousExpense).toBe(2000);
      expect(entity.comparison?.previousNetProfit).toBe(3000);
      // Revenue growth: (6000 - 5000) / 5000 = +20%
      expect(entity.comparison?.revenueGrowthPercentage).toBe(20.0);
      // Expense growth: (3000 - 2000) / 2000 = +50%
      expect(entity.comparison?.expenseGrowthPercentage).toBe(50.0);
      // Net profit growth: (3000 - 3000) / 3000 = 0%
      expect(entity.comparison?.netProfitGrowthPercentage).toBe(0.0);
    });

    it("should handle zero previous period values gracefully", () => {
      const entity = new FarmProfitLossEntity({
        farmId,
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        revenueAggregates: [
          {
            category: TransactionCategory.MILK_SALES,
            amount: 2000,
            transactionCount: 4,
          },
        ],
        expenseAggregates: [],
        revenueTimeline: [],
        expenseTimeline: [],
        previousPeriod: {
          startDate: "2026-08-01",
          endDate: "2026-08-31",
          totalRevenue: 0,
          totalExpense: 0,
        },
      });

      expect(entity.comparison?.revenueGrowthPercentage).toBeNull();
      expect(entity.comparison?.expenseGrowthPercentage).toBe(0.0);
    });
  });

  describe("Validation & Date Invariants", () => {
    it("should throw if startDate is missing or empty", () => {
      expect(() => {
        new FarmProfitLossEntity({
          farmId,
          startDate: "",
          endDate: "2026-09-30",
          revenueAggregates: [],
          expenseAggregates: [],
          revenueTimeline: [],
          expenseTimeline: [],
        });
      }).toThrow(ValidationDomainException);
    });

    it("should throw if startDate is after endDate", () => {
      expect(() => {
        new FarmProfitLossEntity({
          farmId,
          startDate: "2026-10-01",
          endDate: "2026-09-30",
          revenueAggregates: [],
          expenseAggregates: [],
          revenueTimeline: [],
          expenseTimeline: [],
        });
      }).toThrow(ValidationDomainException);
    });

    it("should throw if date span exceeds 5 years", () => {
      expect(() => {
        new FarmProfitLossEntity({
          farmId,
          startDate: "2020-01-01",
          endDate: "2026-01-01",
          revenueAggregates: [],
          expenseAggregates: [],
          revenueTimeline: [],
          expenseTimeline: [],
        });
      }).toThrow(ValidationDomainException);
    });
  });

  describe("DTO Serialization", () => {
    it("should convert correctly to response DTO and summary KPI DTO", () => {
      const entity = new FarmProfitLossEntity({
        farmId,
        startDate,
        endDate,
        currency: "USD",
        revenueAggregates: [
          {
            category: TransactionCategory.MILK_SALES,
            amount: 1000,
            transactionCount: 2,
          },
        ],
        expenseAggregates: [
          {
            category: TransactionCategory.FEED,
            amount: 400,
            transactionCount: 1,
          },
        ],
        revenueTimeline: [],
        expenseTimeline: [],
      });

      const responseDto = entity.toResponseDto();
      expect(responseDto.farmId).toBe(farmId);
      expect(responseDto.totalRevenue).toBe(1000);
      expect(responseDto.totalExpense).toBe(400);
      expect(responseDto.netProfit).toBe(600);
      expect(responseDto.isProfitable).toBe(true);
      expect(responseDto.profitMarginPercentage).toBe(60.0);

      const kpiDto = entity.toSummaryKpiDto();
      expect(kpiDto.totalRevenue).toBe(1000);
      expect(kpiDto.totalExpense).toBe(400);
      expect(kpiDto.netProfit).toBe(600);
      expect(kpiDto.profitMarginPercentage).toBe(60.0);
      expect(kpiDto.isProfitable).toBe(true);
    });
  });
});
