import { Test, TestingModule } from "@nestjs/testing";
import {
  FeedEfficiencyRating,
  ProfitLossInterval,
  TransactionCategory,
} from "@vetralink/shared-types";
import {
  EntityNotFoundException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import { PrismaService } from "../../prisma/prisma.service";
import { FarmPerformancePdfGenerator } from "../pdf/farm-performance-pdf.generator";
import {
  FARM_FEED_ANALYTICS_SERVICE,
  IFarmFeedAnalyticsService,
} from "./farm-feed-analytics.service.interface";
import { FarmPerformanceStatementService } from "./farm-performance-statement.service";
import {
  FARM_PROFIT_LOSS_SERVICE,
  IFarmProfitLossService,
} from "./farm-profit-loss.service.interface";

describe("FarmPerformanceStatementService", () => {
  let service: FarmPerformanceStatementService;
  let prismaService: {
    farm: { findUnique: jest.Mock };
  };
  let profitLossService: {
    generateProfitLoss: jest.Mock;
  };
  let feedAnalyticsService: {
    computeCostPerLiter: jest.Mock;
    computeFeedConversion: jest.Mock;
  };
  let pdfGenerator: {
    generatePdf: jest.Mock;
  };

  const farmId = "11111111-1111-1111-1111-111111111111";

  beforeEach(async () => {
    prismaService = {
      farm: { findUnique: jest.fn() },
    };
    profitLossService = {
      generateProfitLoss: jest.fn(),
    };
    feedAnalyticsService = {
      computeCostPerLiter: jest.fn(),
      computeFeedConversion: jest.fn(),
    };
    pdfGenerator = {
      generatePdf: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FarmPerformanceStatementService,
        { provide: PrismaService, useValue: prismaService },
        { provide: FARM_PROFIT_LOSS_SERVICE, useValue: profitLossService },
        {
          provide: FARM_FEED_ANALYTICS_SERVICE,
          useValue: feedAnalyticsService,
        },
        { provide: FarmPerformancePdfGenerator, useValue: pdfGenerator },
      ],
    }).compile();

    service = module.get<FarmPerformanceStatementService>(
      FarmPerformanceStatementService
    );
  });

  describe("getMonthlyStatementData", () => {
    it("should synthesize farm details, P&L, CPL, and FCR into a structured statement", async () => {
      prismaService.farm.findUnique.mockResolvedValueOnce({
        id: farmId,
        name: "Green Valley Farm",
        slug: "green-valley",
        farmType: "DAIRY",
        country: "USA",
        settings: { currency: "USD" },
      });

      profitLossService.generateProfitLoss.mockResolvedValueOnce({
        farmId,
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        currency: "USD",
        interval: ProfitLossInterval.MONTH,
        totalRevenue: 20000,
        totalExpense: 12000,
        netProfit: 8000,
        isProfitable: true,
        profitMarginPercentage: 40.0,
        operatingExpenseRatio: 60.0,
        revenueTransactionsCount: 25,
        expenseTransactionsCount: 15,
        revenueBreakdown: [
          {
            category: TransactionCategory.MILK_SALES,
            amount: 20000,
            transactionCount: 25,
            percentage: 100.0,
          },
        ],
        expenseBreakdown: [
          {
            category: TransactionCategory.FEED,
            amount: 7000,
            transactionCount: 10,
            percentage: 58.33,
          },
        ],
        timeline: [],
      });

      feedAnalyticsService.computeCostPerLiter.mockResolvedValueOnce({
        farmId,
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        currency: "USD",
        interval: ProfitLossInterval.MONTH,
        totalMilkYieldLiters: 25000,
        averageDailyYieldLiters: 833.333,
        daysCount: 30,
        totalFeedExpense: 7000,
        totalOperatingExpense: 12000,
        totalMilkRevenue: 20000,
        feedCostPerLiter: 0.28,
        operatingCostPerLiter: 0.48,
        revenuePerLiter: 0.8,
        netMarginPerLiter: 0.32,
        feedCostPercentage: 58.33,
        breakEvenMilkPrice: 0.48,
        isProfitablePerLiter: true,
        timeline: [],
      });

      feedAnalyticsService.computeFeedConversion.mockResolvedValueOnce({
        farmId,
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        currency: "USD",
        totalFeedConsumedKg: 18000,
        totalFeedExpense: 7000,
        averageFeedCostPerKg: 0.39,
        growthFcr: {
          totalWeightGainKg: 2000,
          overallFcr: 6.0,
          feedCostPerKgGain: 2.34,
          animalsEvaluatedCount: 10,
          rating: FeedEfficiencyRating.GOOD,
          animals: [],
        },
        dairyFeedEfficiency: {
          totalMilkYieldLiters: 25000,
          feedToMilkRatioKgPerLiter: 0.72,
          milkPerKgFeedLiters: 1.39,
          rating: FeedEfficiencyRating.GOOD,
        },
      });

      const statement = await service.getMonthlyStatementData(farmId, {
        year: 2026,
        month: 9,
      });

      expect(statement.farm.name).toBe("Green Valley Farm");
      expect(statement.period.year).toBe(2026);
      expect(statement.period.month).toBe(9);
      expect(statement.period.startDate).toBe("2026-09-01");
      expect(statement.period.endDate).toBe("2026-09-30");
      expect(statement.financialSummary.totalRevenue).toBe(20000);
      expect(statement.financialSummary.netProfit).toBe(8000);
      expect(statement.dairyMetrics.totalMilkYieldLiters).toBe(25000);
      expect(statement.dairyMetrics.netMarginPerLiter).toBe(0.32);
      expect(statement.feedEfficiencyMetrics.totalFeedConsumedKg).toBe(18000);
      expect(statement.statementMetadata.statementHash).toBeDefined();
    });

    it("should throw EntityNotFoundException if farm does not exist", async () => {
      prismaService.farm.findUnique.mockResolvedValueOnce(null);

      await expect(
        service.getMonthlyStatementData(farmId, { year: 2026, month: 9 })
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw ValidationDomainException if month is invalid", async () => {
      await expect(
        service.getMonthlyStatementData(farmId, { year: 2026, month: 13 })
      ).rejects.toThrow(ValidationDomainException);
    });
  });

  describe("generateMonthlyPdf", () => {
    it("should generate and return binary PDF buffer with appropriate filename", async () => {
      prismaService.farm.findUnique.mockResolvedValueOnce({
        id: farmId,
        name: "Green Valley Farm",
        slug: "green-valley",
        farmType: "DAIRY",
        country: "USA",
        settings: { currency: "USD" },
      });

      profitLossService.generateProfitLoss.mockResolvedValueOnce({
        totalRevenue: 1000,
        totalExpense: 500,
        netProfit: 500,
        profitMarginPercentage: 50,
        operatingExpenseRatio: 50,
        isProfitable: true,
        revenueBreakdown: [],
        expenseBreakdown: [],
      });

      feedAnalyticsService.computeCostPerLiter.mockResolvedValueOnce({
        totalMilkYieldLiters: 1000,
        averageDailyYieldLiters: 33.333,
        feedCostPerLiter: 0.2,
        operatingCostPerLiter: 0.5,
        revenuePerLiter: 1.0,
        netMarginPerLiter: 0.5,
        breakEvenMilkPrice: 0.5,
        isProfitablePerLiter: true,
      });

      feedAnalyticsService.computeFeedConversion.mockResolvedValueOnce({
        totalFeedConsumedKg: 500,
        totalFeedExpense: 200,
        averageFeedCostPerKg: 0.4,
        growthFcr: { overallFcr: null, rating: "AVERAGE" },
        dairyFeedEfficiency: {
          feedToMilkRatioKgPerLiter: 0.5,
          rating: "EXCELLENT",
        },
      });

      const fakePdfBuffer = Buffer.from("%PDF-1.4 test content");
      pdfGenerator.generatePdf.mockResolvedValueOnce(fakePdfBuffer);

      const result = await service.generateMonthlyPdf(farmId, {
        year: 2026,
        month: 9,
      });

      expect(result.pdfBuffer).toBe(fakePdfBuffer);
      expect(result.filename).toBe("farm-statement-green-valley-2026-09.pdf");
    });
  });
});
