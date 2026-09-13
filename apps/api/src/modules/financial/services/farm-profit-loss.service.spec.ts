import { Test, TestingModule } from "@nestjs/testing";
import {
  ProfitLossInterval,
  TransactionCategory,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import {
  FARM_PROFIT_LOSS_REPOSITORY,
  IFarmProfitLossRepository,
} from "../repositories/farm-profit-loss.repository.interface";
import { FarmProfitLossService } from "./farm-profit-loss.service";

describe("FarmProfitLossService", () => {
  let service: FarmProfitLossService;
  let profitLossRepo: {
    getProfitLossData: jest.Mock;
  };

  const farmId = "99999999-9999-9999-9999-999999999999";

  beforeEach(async () => {
    profitLossRepo = {
      getProfitLossData: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FarmProfitLossService,
        {
          provide: FARM_PROFIT_LOSS_REPOSITORY,
          useValue: profitLossRepo,
        },
      ],
    }).compile();

    service = module.get<FarmProfitLossService>(FarmProfitLossService);
  });

  describe("generateProfitLoss", () => {
    it("should generate a complete P&L statement with custom date range and previous period", async () => {
      profitLossRepo.getProfitLossData.mockResolvedValueOnce({
        currency: "USD",
        revenueAggregates: [
          {
            category: TransactionCategory.MILK_SALES,
            amount: 8000,
            transactionCount: 20,
          },
        ],
        expenseAggregates: [
          {
            category: TransactionCategory.FEED,
            amount: 5000,
            transactionCount: 15,
          },
        ],
        revenueTimeline: [
          { period: "2026-09-01", amount: 4000, transactionCount: 10 },
          { period: "2026-09-15", amount: 4000, transactionCount: 10 },
        ],
        expenseTimeline: [
          { period: "2026-09-01", amount: 2500, transactionCount: 7 },
          { period: "2026-09-15", amount: 2500, transactionCount: 8 },
        ],
        previousPeriod: {
          startDate: "2026-08-02",
          endDate: "2026-08-31",
          totalRevenue: 7000,
          totalExpense: 4500,
        },
      });

      const response = await service.generateProfitLoss(
        farmId,
        {
          startDate: "2026-09-01",
          endDate: "2026-09-30",
          interval: ProfitLossInterval.DAY,
          includePreviousPeriod: true,
        },
        "trace-123"
      );

      expect(profitLossRepo.getProfitLossData).toHaveBeenCalledWith({
        farmId,
        startDate: new Date("2026-09-01T00:00:00.000Z"),
        endDate: new Date("2026-09-30T23:59:59.999Z"),
        interval: ProfitLossInterval.DAY,
        animalId: undefined,
        currency: undefined,
        previousStartDate: expect.any(Date),
        previousEndDate: expect.any(Date),
      });

      expect(response.farmId).toBe(farmId);
      expect(response.totalRevenue).toBe(8000);
      expect(response.totalExpense).toBe(5000);
      expect(response.netProfit).toBe(3000);
      expect(response.isProfitable).toBe(true);
      expect(response.profitMarginPercentage).toBe(37.5);
      expect(response.operatingExpenseRatio).toBe(62.5);
      expect(response.comparison).toBeDefined();
      expect(response.comparison?.previousRevenue).toBe(7000);
      expect(response.comparison?.revenueGrowthPercentage).toBe(14.29);
    });

    it("should default to current month dates if query dates are omitted", async () => {
      profitLossRepo.getProfitLossData.mockResolvedValueOnce({
        currency: "USD",
        revenueAggregates: [],
        expenseAggregates: [],
        revenueTimeline: [],
        expenseTimeline: [],
        previousPeriod: null,
      });

      const response = await service.generateProfitLoss(farmId, {});

      expect(response.farmId).toBe(farmId);
      expect(response.totalRevenue).toBe(0);
      expect(response.totalExpense).toBe(0);
      expect(profitLossRepo.getProfitLossData).toHaveBeenCalled();
    });

    it("should select WEEK interval when date range is between 32 and 180 days", async () => {
      profitLossRepo.getProfitLossData.mockResolvedValueOnce({
        currency: "USD",
        revenueAggregates: [],
        expenseAggregates: [],
        revenueTimeline: [],
        expenseTimeline: [],
        previousPeriod: null,
      });

      const response = await service.generateProfitLoss(farmId, {
        startDate: "2026-06-01",
        endDate: "2026-08-31", // ~91 days
      });

      expect(response.interval).toBe(ProfitLossInterval.WEEK);
    });

    it("should select MONTH interval when date range exceeds 180 days", async () => {
      profitLossRepo.getProfitLossData.mockResolvedValueOnce({
        currency: "USD",
        revenueAggregates: [],
        expenseAggregates: [],
        revenueTimeline: [],
        expenseTimeline: [],
        previousPeriod: null,
      });

      const response = await service.generateProfitLoss(farmId, {
        startDate: "2026-01-01",
        endDate: "2026-09-30", // ~272 days
      });

      expect(response.interval).toBe(ProfitLossInterval.MONTH);
    });

    it("should throw ValidationDomainException if startDate is after endDate", async () => {
      await expect(
        service.generateProfitLoss(farmId, {
          startDate: "2026-10-01",
          endDate: "2026-09-01",
        })
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if date string is invalid", async () => {
      await expect(
        service.generateProfitLoss(farmId, {
          startDate: "invalid-date",
          endDate: "2026-09-01",
        })
      ).rejects.toThrow(ValidationDomainException);
    });
  });

  describe("getSummaryKpi", () => {
    it("should return concise KPI metrics", async () => {
      profitLossRepo.getProfitLossData.mockResolvedValueOnce({
        currency: "USD",
        revenueAggregates: [
          {
            category: TransactionCategory.MILK_SALES,
            amount: 10000,
            transactionCount: 30,
          },
        ],
        expenseAggregates: [
          {
            category: TransactionCategory.FEED,
            amount: 4000,
            transactionCount: 12,
          },
        ],
        revenueTimeline: [],
        expenseTimeline: [],
      });

      const kpi = await service.getSummaryKpi(farmId, {
        startDate: "2026-09-01",
        endDate: "2026-09-30",
      });

      expect(kpi.farmId).toBe(farmId);
      expect(kpi.totalRevenue).toBe(10000);
      expect(kpi.totalExpense).toBe(4000);
      expect(kpi.netProfit).toBe(6000);
      expect(kpi.profitMarginPercentage).toBe(60.0);
      expect(kpi.operatingExpenseRatio).toBe(40.0);
      expect(kpi.isProfitable).toBe(true);
    });
  });
});
