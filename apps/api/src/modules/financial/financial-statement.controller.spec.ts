import { Reflector } from "@nestjs/core";
import { Test, TestingModule } from "@nestjs/testing";
import { Response } from "express";
import { TOKEN_SERVICE } from "../auth/services/token.service.interface";
import { FARM_MEMBER_REPOSITORY } from "../farms/repositories/farm-member.repository.interface";
import { FinancialStatementController } from "./financial-statement.controller";
import {
  FARM_PERFORMANCE_STATEMENT_SERVICE,
  IFarmPerformanceStatementService,
} from "./services/farm-performance-statement.service.interface";

describe("FinancialStatementController", () => {
  let controller: FinancialStatementController;
  let statementService: {
    generateMonthlyPdf: jest.Mock;
    getMonthlyStatementData: jest.Mock;
  };

  const farmId = "11111111-1111-1111-1111-111111111111";

  beforeEach(async () => {
    statementService = {
      generateMonthlyPdf: jest.fn(),
      getMonthlyStatementData: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [FinancialStatementController],
      providers: [
        {
          provide: FARM_PERFORMANCE_STATEMENT_SERVICE,
          useValue: statementService,
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

    controller = module.get<FinancialStatementController>(
      FinancialStatementController
    );
  });

  describe("downloadMonthlyPdf", () => {
    it("should set streaming headers and send PDF buffer to express response", async () => {
      const fakePdfBuffer = Buffer.from("%PDF-1.4 test");
      const filename = "farm-statement-green-valley-2026-09.pdf";

      statementService.generateMonthlyPdf.mockResolvedValueOnce({
        pdfBuffer: fakePdfBuffer,
        filename,
      });

      const mockRes = {
        setHeader: jest.fn(),
        end: jest.fn(),
      } as unknown as Response;

      const query = { year: 2026, month: 9 };

      await controller.downloadMonthlyPdf(
        farmId,
        query,
        mockRes,
        "trace-xyz"
      );

      expect(statementService.generateMonthlyPdf).toHaveBeenCalledWith(
        farmId,
        query,
        "trace-xyz"
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "application/pdf"
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        `attachment; filename="${filename}"`
      );
      expect(mockRes.setHeader).toHaveBeenCalledWith(
        "Content-Length",
        fakePdfBuffer.length
      );
      expect(mockRes.end).toHaveBeenCalledWith(fakePdfBuffer);
    });
  });

  describe("getMonthlySummary", () => {
    it("should return monthly statement structured data", async () => {
      const mockData = {
        farm: { id: farmId, name: "Green Valley" },
        period: { year: 2026, month: 9 },
      };

      statementService.getMonthlyStatementData.mockResolvedValueOnce(
        mockData as any
      );

      const query = { year: 2026, month: 9 };
      const result = await controller.getMonthlySummary(
        farmId,
        query,
        "trace-abc"
      );

      expect(statementService.getMonthlyStatementData).toHaveBeenCalledWith(
        farmId,
        query,
        "trace-abc"
      );
      expect(result).toBe(mockData);
    });
  });
});
