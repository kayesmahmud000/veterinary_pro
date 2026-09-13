import { Reflector } from "@nestjs/core";
import { Test, TestingModule } from "@nestjs/testing";
import { ProfitLossInterval } from "@vetralink/shared-types";
import { TOKEN_SERVICE } from "../auth/services/token.service.interface";
import { FARM_MEMBER_REPOSITORY } from "../farms/repositories/farm-member.repository.interface";
import { FinancialProfitLossController } from "./financial-profit-loss.controller";
import {
  FARM_PROFIT_LOSS_SERVICE,
  IFarmProfitLossService,
} from "./services/farm-profit-loss.service.interface";

describe("FinancialProfitLossController", () => {
  let controller: FinancialProfitLossController;
  let profitLossService: {
    generateProfitLoss: jest.Mock;
    getSummaryKpi: jest.Mock;
  };

  const farmId = "11111111-1111-1111-1111-111111111111";

  beforeEach(async () => {
    profitLossService = {
      generateProfitLoss: jest.fn(),
      getSummaryKpi: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinancialProfitLossController],
      providers: [
        {
          provide: FARM_PROFIT_LOSS_SERVICE,
          useValue: profitLossService,
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

    controller = module.get<FinancialProfitLossController>(
      FinancialProfitLossController
    );
  });

  describe("generateProfitLoss", () => {
    it("should delegate to service with farmId, query, and traceId", async () => {
      const mockStatement = {
        farmId,
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        currency: "USD",
        interval: ProfitLossInterval.DAY,
        totalRevenue: 12000,
        totalExpense: 7500,
        netProfit: 4500,
        isProfitable: true,
        profitMarginPercentage: 37.5,
        operatingExpenseRatio: 62.5,
        revenueTransactionsCount: 30,
        expenseTransactionsCount: 20,
        revenueBreakdown: [],
        expenseBreakdown: [],
        timeline: [],
      };

      profitLossService.generateProfitLoss.mockResolvedValueOnce(mockStatement);

      const query = {
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        interval: ProfitLossInterval.DAY,
      };

      const result = await controller.generateProfitLoss(
        farmId,
        query,
        "trace-xyz"
      );

      expect(profitLossService.generateProfitLoss).toHaveBeenCalledWith(
        farmId,
        query,
        "trace-xyz"
      );
      expect(result).toBe(mockStatement);
    });
  });

  describe("getSummaryKpi", () => {
    it("should delegate to service with farmId and query", async () => {
      const mockKpi = {
        farmId,
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        currency: "USD",
        totalRevenue: 12000,
        totalExpense: 7500,
        netProfit: 4500,
        profitMarginPercentage: 37.5,
        operatingExpenseRatio: 62.5,
        isProfitable: true,
      };

      profitLossService.getSummaryKpi.mockResolvedValueOnce(mockKpi);

      const query = {
        startDate: "2026-09-01",
        endDate: "2026-09-30",
      };

      const result = await controller.getSummaryKpi(farmId, query);

      expect(profitLossService.getSummaryKpi).toHaveBeenCalledWith(
        farmId,
        query
      );
      expect(result).toBe(mockKpi);
    });
  });
});
