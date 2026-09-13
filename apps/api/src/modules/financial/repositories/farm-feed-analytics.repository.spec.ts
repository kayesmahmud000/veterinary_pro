import { Test, TestingModule } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { ProfitLossInterval } from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { FarmFeedAnalyticsRepository } from "./farm-feed-analytics.repository";

describe("FarmFeedAnalyticsRepository", () => {
  let repository: FarmFeedAnalyticsRepository;
  let prismaService: {
    milkLog: {
      findMany: jest.Mock;
    };
    farmTransaction: {
      findMany: jest.Mock;
    };
    animalWeightLog: {
      findMany: jest.Mock;
    };
  };

  const farmId = "11111111-1111-1111-1111-111111111111";
  const startDate = new Date("2026-09-01");
  const endDate = new Date("2026-09-30");

  beforeEach(async () => {
    prismaService = {
      milkLog: { findMany: jest.fn() },
      farmTransaction: { findMany: jest.fn() },
      animalWeightLog: { findMany: jest.fn() },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FarmFeedAnalyticsRepository,
        { provide: PrismaService, useValue: prismaService },
      ],
    }).compile();

    repository = module.get<FarmFeedAnalyticsRepository>(
      FarmFeedAnalyticsRepository
    );
  });

  describe("getCostPerLiterData", () => {
    it("should query milk logs and transactions to aggregate CPL metrics", async () => {
      prismaService.milkLog.findMany.mockResolvedValueOnce([
        {
          yieldLiters: new Prisma.Decimal(5000),
          loggedDate: new Date("2026-09-10T00:00:00Z"),
        },
      ]);

      prismaService.farmTransaction.findMany.mockResolvedValueOnce([
        {
          amount: new Prisma.Decimal(1500),
          type: "EXPENSE",
          category: "FEED",
          currency: "USD",
          txDate: new Date("2026-09-10T00:00:00Z"),
        },
        {
          amount: new Prisma.Decimal(1000),
          type: "EXPENSE",
          category: "LABOR",
          currency: "USD",
          txDate: new Date("2026-09-10T00:00:00Z"),
        },
        {
          amount: new Prisma.Decimal(3250),
          type: "INCOME",
          category: "MILK_SALES",
          currency: "USD",
          txDate: new Date("2026-09-10T00:00:00Z"),
        },
      ]);

      const result = await repository.getCostPerLiterData({
        farmId,
        startDate,
        endDate,
        interval: ProfitLossInterval.DAY,
      });

      expect(result.currency).toBe("USD");
      expect(result.totalMilkYieldLiters).toBe(5000);
      expect(result.totalFeedExpense).toBe(1500);
      expect(result.totalOperatingExpense).toBe(2500); // 1500 feed + 1000 labor
      expect(result.totalMilkRevenue).toBe(3250);
      expect(result.timeline).toHaveLength(1);
      expect(result.timeline[0]?.period).toBe("2026-09-10");
      expect(result.timeline[0]?.feedCost).toBe(1500);
      expect(result.timeline[0]?.operatingCost).toBe(2500);
      expect(result.timeline[0]?.milkRevenue).toBe(3250);
    });
  });

  describe("getFeedConversionData", () => {
    it("should query feed expenses, metadata kg, and animal weight logs", async () => {
      prismaService.farmTransaction.findMany.mockResolvedValueOnce([
        {
          amount: new Prisma.Decimal(400),
          currency: "USD",
          metadata: { quantityKg: 1000 },
        },
      ]);

      prismaService.milkLog.findMany.mockResolvedValueOnce([
        { yieldLiters: new Prisma.Decimal(1500) },
      ]);

      prismaService.animalWeightLog.findMany.mockResolvedValueOnce([
        {
          animalId: "animal-1",
          weightKg: new Prisma.Decimal(200),
          recordedAt: new Date("2026-09-01T00:00:00Z"),
          animal: { id: "animal-1", tagNumber: "COW-01", name: "Daisy" },
        },
        {
          animalId: "animal-1",
          weightKg: new Prisma.Decimal(250),
          recordedAt: new Date("2026-09-25T00:00:00Z"),
          animal: { id: "animal-1", tagNumber: "COW-01", name: "Daisy" },
        },
      ]);

      const result = await repository.getFeedConversionData({
        farmId,
        startDate,
        endDate,
      });

      expect(result.currency).toBe("USD");
      expect(result.totalFeedConsumedKg).toBe(1000);
      expect(result.totalFeedExpense).toBe(400);
      expect(result.totalMilkYieldLiters).toBe(1500);
      expect(result.animalWeightData).toHaveLength(1);
      expect(result.animalWeightData[0]?.animalId).toBe("animal-1");
      expect(result.animalWeightData[0]?.initialWeightKg).toBe(200);
      expect(result.animalWeightData[0]?.finalWeightKg).toBe(250);
    });
  });
});
