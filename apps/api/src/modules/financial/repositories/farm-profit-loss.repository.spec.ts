import { Test, TestingModule } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import {
  ProfitLossInterval,
  TransactionCategory,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { FarmProfitLossRepository } from "./farm-profit-loss.repository";

describe("FarmProfitLossRepository", () => {
  let repository: FarmProfitLossRepository;
  let prismaService: {
    farmTransaction: {
      findMany: jest.Mock;
    };
  };

  const farmId = "11111111-1111-1111-1111-111111111111";
  const startDate = new Date("2026-09-01");
  const endDate = new Date("2026-09-30");

  beforeEach(async () => {
    prismaService = {
      farmTransaction: {
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FarmProfitLossRepository,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    repository = module.get<FarmProfitLossRepository>(
      FarmProfitLossRepository
    );
  });

  describe("getProfitLossData", () => {
    it("should aggregate revenues and expenses by category and timeline (DAY interval)", async () => {
      const mockRecords = [
        {
          amount: new Prisma.Decimal(3000.0),
          type: "INCOME",
          category: "MILK_SALES",
          currency: "USD",
          txDate: new Date("2026-09-05T00:00:00Z"),
        },
        {
          amount: new Prisma.Decimal(1000.0),
          type: "INCOME",
          category: "MANURE",
          currency: "USD",
          txDate: new Date("2026-09-15T00:00:00Z"),
        },
        {
          amount: new Prisma.Decimal(1500.0),
          type: "EXPENSE",
          category: "FEED",
          currency: "USD",
          txDate: new Date("2026-09-05T00:00:00Z"),
        },
        {
          amount: new Prisma.Decimal(500.0),
          type: "EXPENSE",
          category: "MEDICINE",
          currency: "USD",
          txDate: new Date("2026-09-10T00:00:00Z"),
        },
      ];

      prismaService.farmTransaction.findMany.mockResolvedValueOnce(mockRecords);

      const result = await repository.getProfitLossData({
        farmId,
        startDate,
        endDate,
        interval: ProfitLossInterval.DAY,
      });

      expect(prismaService.farmTransaction.findMany).toHaveBeenCalledWith({
        where: {
          farmId,
          deletedAt: null,
          txDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          amount: true,
          type: true,
          category: true,
          currency: true,
          txDate: true,
        },
        orderBy: {
          txDate: "asc",
        },
      });

      expect(result.currency).toBe("USD");
      expect(result.revenueAggregates).toEqual([
        {
          category: TransactionCategory.MILK_SALES,
          amount: 3000,
          transactionCount: 1,
        },
        {
          category: TransactionCategory.MANURE,
          amount: 1000,
          transactionCount: 1,
        },
      ]);
      expect(result.expenseAggregates).toEqual([
        {
          category: TransactionCategory.FEED,
          amount: 1500,
          transactionCount: 1,
        },
        {
          category: TransactionCategory.MEDICINE,
          amount: 500,
          transactionCount: 1,
        },
      ]);
      expect(result.revenueTimeline).toEqual([
        { period: "2026-09-05", amount: 3000, transactionCount: 1 },
        { period: "2026-09-15", amount: 1000, transactionCount: 1 },
      ]);
      expect(result.expenseTimeline).toEqual([
        { period: "2026-09-05", amount: 1500, transactionCount: 1 },
        { period: "2026-09-10", amount: 500, transactionCount: 1 },
      ]);
      expect(result.previousPeriod).toBeNull();
    });

    it("should format timeline intervals for MONTH and YEAR correctly", async () => {
      const mockRecords = [
        {
          amount: new Prisma.Decimal(5000.0),
          type: "INCOME",
          category: "MILK_SALES",
          currency: "USD",
          txDate: new Date("2026-09-05T00:00:00Z"),
        },
      ];

      prismaService.farmTransaction.findMany.mockResolvedValueOnce(mockRecords);

      const resultMonth = await repository.getProfitLossData({
        farmId,
        startDate,
        endDate,
        interval: ProfitLossInterval.MONTH,
      });

      expect(resultMonth.revenueTimeline).toEqual([
        { period: "2026-09", amount: 5000, transactionCount: 1 },
      ]);
    });

    it("should include animalId in query when filtered by animal", async () => {
      const animalId = "33333333-3333-3333-3333-333333333333";
      prismaService.farmTransaction.findMany.mockResolvedValueOnce([]);

      await repository.getProfitLossData({
        farmId,
        startDate,
        endDate,
        animalId,
      });

      expect(prismaService.farmTransaction.findMany).toHaveBeenCalledWith({
        where: {
          farmId,
          animalId,
          deletedAt: null,
          txDate: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: expect.any(Object),
        orderBy: expect.any(Object),
      });
    });

    it("should query and aggregate previous period when dates are provided", async () => {
      const previousStartDate = new Date("2026-08-01");
      const previousEndDate = new Date("2026-08-31");

      // First call for primary range
      prismaService.farmTransaction.findMany.mockResolvedValueOnce([
        {
          amount: new Prisma.Decimal(5000.0),
          type: "INCOME",
          category: "MILK_SALES",
          currency: "USD",
          txDate: new Date("2026-09-10T00:00:00Z"),
        },
      ]);

      // Second call for previous period
      prismaService.farmTransaction.findMany.mockResolvedValueOnce([
        {
          amount: new Prisma.Decimal(4000.0),
          type: "INCOME",
        },
        {
          amount: new Prisma.Decimal(2500.0),
          type: "EXPENSE",
        },
      ]);

      const result = await repository.getProfitLossData({
        farmId,
        startDate,
        endDate,
        previousStartDate,
        previousEndDate,
      });

      expect(prismaService.farmTransaction.findMany).toHaveBeenCalledTimes(2);
      expect(result.previousPeriod).toEqual({
        startDate: "2026-08-01",
        endDate: "2026-08-31",
        totalRevenue: 4000,
        totalExpense: 2500,
      });
    });
  });
});
