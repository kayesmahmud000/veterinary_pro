import { Test, TestingModule } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import { StreamableFile } from "@nestjs/common";
import type { Response } from "express";
import {
  JwtPayload,
  MilkAnomalyResponseDto,
  MilkAnomalySeverity,
  MilkAnomalyStatus,
  MilkExportFormat,
  MilkLogResponseDto,
  MilkSession,
  PaginatedMilkAnomaliesDto,
  PaginatedMilkLogsDto,
  UserRole,
  UserStatus,
} from "@vetralink/shared-types";
import { MilkLogsController } from "./milk-logs.controller";
import {
  IMilkLogService,
  MILK_LOGS_SERVICE,
} from "./services/milk-log.service.interface";
import {
  IMilkAnomalyService,
  MILK_ANOMALY_SERVICE,
} from "./services/milk-anomaly.service.interface";
import {
  IMilkExportService,
  MILK_EXPORT_SERVICE,
} from "./services/milk-export.service.interface";
import { TOKEN_SERVICE } from "../auth/services/token.service.interface";
import { FARM_MEMBER_REPOSITORY } from "../farms/repositories/farm-member.repository.interface";

describe("MilkLogsController", () => {
  let controller: MilkLogsController;
  let service: jest.Mocked<IMilkLogService>;
  let anomalyService: jest.Mocked<IMilkAnomalyService>;
  let exportService: jest.Mocked<IMilkExportService>;

  const farmId = "11111111-1111-1111-1111-111111111111";
  const mockUser: JwtPayload = {
    sub: "user-1111-1111-1111-111111111111",
    email: "herdsman@vetralink.com",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const mockMilkLogResponse: MilkLogResponseDto = {
    id: "log-1111-1111-1111-111111111111",
    farmId,
    animalId: "animal-1111-1111-1111-111111111111",
    recordedById: mockUser.sub,
    session: MilkSession.MORNING,
    yieldLiters: 14.5,
    fatPercent: 3.8,
    snfPercent: 8.5,
    loggedDate: "2026-09-13",
    syncVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockAnomalyResponse: MilkAnomalyResponseDto = {
    id: "anomaly-1111-1111-1111-111111111111",
    farmId,
    animalId: "animal-1111-1111-1111-111111111111",
    loggedDate: "2026-09-13",
    currentYieldLiters: 12.0,
    baselineYieldLiters: 20.0,
    dropPercentage: 40.0,
    severity: MilkAnomalySeverity.MEDIUM,
    status: MilkAnomalyStatus.DETECTED,
    acknowledgedById: null,
    acknowledgedAt: null,
    resolvedAt: null,
    clinicalNotes: null,
    resolutionNotes: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    service = {
      createMilkLog: jest.fn(),
      createBulkMilkLog: jest.fn(),
      updateMilkLog: jest.fn(),
      deleteMilkLog: jest.fn(),
      getMilkLogById: jest.fn(),
      queryMilkLogs: jest.fn(),
      getYieldAnalytics: jest.fn(),
    };

    anomalyService = {
      evaluateAnimalYieldDrop: jest.fn(),
      runFarmDailyScan: jest.fn(),
      queryAnomalies: jest.fn(),
      getAnomalyById: jest.fn(),
      acknowledgeAnomaly: jest.fn(),
      resolveAnomaly: jest.fn(),
      triggerFarmScan: jest.fn(),
    };

    exportService = {
      exportMilkLogs: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MilkLogsController],
      providers: [
        {
          provide: MILK_LOGS_SERVICE,
          useValue: service,
        },
        {
          provide: MILK_ANOMALY_SERVICE,
          useValue: anomalyService,
        },
        {
          provide: MILK_EXPORT_SERVICE,
          useValue: exportService,
        },
        {
          provide: TOKEN_SERVICE,
          useValue: { verifyAccessToken: jest.fn() },
        },
        {
          provide: FARM_MEMBER_REPOSITORY,
          useValue: { findMembership: jest.fn() },
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<MilkLogsController>(MilkLogsController);
  });

  describe("createMilkLog", () => {
    it("should delegate creation to MilkLogService and return result", async () => {
      service.createMilkLog.mockResolvedValue(mockMilkLogResponse);

      const dto = {
        animalId: "animal-1111-1111-1111-111111111111",
        session: MilkSession.MORNING,
        yieldLiters: 14.5,
        fatPercent: 3.8,
        snfPercent: 8.5,
        loggedDate: "2026-09-13",
      };

      const result = await controller.createMilkLog(
        farmId,
        mockUser,
        dto,
        "trace-123"
      );

      expect(service.createMilkLog).toHaveBeenCalledWith(
        farmId,
        mockUser.sub,
        dto,
        "trace-123"
      );
      expect(result).toEqual(mockMilkLogResponse);
    });
  });

  describe("createBulkMilkLog", () => {
    it("should delegate bulk creation to MilkLogService and return result", async () => {
      const mockBulkResponse: MilkLogResponseDto = {
        ...mockMilkLogResponse,
        animalId: null,
        yieldLiters: 950.0,
      };
      service.createBulkMilkLog.mockResolvedValue(mockBulkResponse);

      const dto = {
        session: MilkSession.MORNING,
        yieldLiters: 950.0,
        fatPercent: 4.1,
        snfPercent: 8.8,
        loggedDate: "2026-09-13",
        milkingAnimalsCount: 70,
        tankTemperatureCelsius: 3.5,
        notes: "Morning bulk cooling tank entry",
      };

      const result = await controller.createBulkMilkLog(
        farmId,
        mockUser,
        dto,
        "trace-bulk-123"
      );

      expect(service.createBulkMilkLog).toHaveBeenCalledWith(
        farmId,
        mockUser.sub,
        dto,
        "trace-bulk-123"
      );
      expect(result).toEqual(mockBulkResponse);
    });
  });

  describe("queryMilkLogs", () => {
    it("should delegate query to MilkLogService and return paginated result", async () => {
      const paginatedResult: PaginatedMilkLogsDto = {
        items: [mockMilkLogResponse],
        meta: {
          page: 1,
          pageSize: 20,
          total: 1,
          totalPages: 1,
        },
      };

      service.queryMilkLogs.mockResolvedValue(paginatedResult);

      const query = {
        session: MilkSession.MORNING,
        page: 1,
        limit: 20,
      };

      const result = await controller.queryMilkLogs(farmId, query);

      expect(service.queryMilkLogs).toHaveBeenCalledWith(farmId, query);
      expect(result).toEqual(paginatedResult);
    });
  });

  describe("getMilkLogById", () => {
    it("should delegate single retrieval to MilkLogService", async () => {
      service.getMilkLogById.mockResolvedValue(mockMilkLogResponse);

      const result = await controller.getMilkLogById(
        farmId,
        mockMilkLogResponse.id
      );

      expect(service.getMilkLogById).toHaveBeenCalledWith(
        mockMilkLogResponse.id,
        farmId
      );
      expect(result).toEqual(mockMilkLogResponse);
    });
  });

  describe("updateMilkLog", () => {
    it("should delegate update to MilkLogService", async () => {
      const updatedResponse = {
        ...mockMilkLogResponse,
        yieldLiters: 16.0,
      };
      service.updateMilkLog.mockResolvedValue(updatedResponse);

      const dto = {
        yieldLiters: 16.0,
      };

      const result = await controller.updateMilkLog(
        farmId,
        mockUser,
        mockMilkLogResponse.id,
        dto,
        "trace-456"
      );

      expect(service.updateMilkLog).toHaveBeenCalledWith(
        mockMilkLogResponse.id,
        farmId,
        mockUser.sub,
        dto,
        "trace-456"
      );
      expect(result).toEqual(updatedResponse);
    });
  });

  describe("deleteMilkLog", () => {
    it("should delegate delete to MilkLogService and return deleted status", async () => {
      service.deleteMilkLog.mockResolvedValue(undefined);

      const result = await controller.deleteMilkLog(
        farmId,
        mockUser,
        mockMilkLogResponse.id,
        "trace-789"
      );

      expect(service.deleteMilkLog).toHaveBeenCalledWith(
        mockMilkLogResponse.id,
        farmId,
        mockUser.sub,
        "trace-789"
      );
      expect(result).toEqual({ deleted: true, id: mockMilkLogResponse.id });
    });
  });

  describe("getYieldAnalytics", () => {
    it("should delegate to MilkLogService.getYieldAnalytics with query and return analytics", async () => {
      const mockAnalyticsResponse = {
        farmId,
        animalId: null,
        startDate: "2026-08-14",
        endDate: "2026-09-13",
        summary: {
          totalYieldLiters: 1200,
          dailyAverageLiters: 40,
          peakYieldDate: "2026-09-01",
          peakYieldLiters: 45,
          lowestYieldDate: "2026-08-15",
          lowestYieldLiters: 35,
          totalRecords: 60,
          activeDays: 30,
          averageFatPercent: 3.8,
          averageSnfPercent: 8.5,
          trendPercentage: 2.5,
          trendDirection: "STABLE" as const,
        },
        daily: [],
        weekly: [],
        monthly: [],
      };

      service.getYieldAnalytics.mockResolvedValue(mockAnalyticsResponse);

      const query = {
        startDate: "2026-08-14",
        endDate: "2026-09-13",
      };

      const result = await controller.getYieldAnalytics(farmId, query);

      expect(service.getYieldAnalytics).toHaveBeenCalledWith(farmId, query);
      expect(result).toEqual(mockAnalyticsResponse);
    });
  });

  describe("exportMilkLogs", () => {
    it("should call exportService, set response headers, and return StreamableFile", async () => {
      const mockResult = {
        buffer: Buffer.from("Log ID,Date,Session\r\n"),
        fileName: "milk-production-11111111-2026-09-01-to-2026-09-13.csv",
        contentType: "text/csv; charset=utf-8",
      };

      exportService.exportMilkLogs.mockResolvedValue(mockResult);

      const mockRes = {
        set: jest.fn(),
      } as unknown as Response;

      const query = {
        format: MilkExportFormat.CSV,
      };

      const result = await controller.exportMilkLogs(
        farmId,
        query,
        mockRes,
        "trace-export-1"
      );

      expect(exportService.exportMilkLogs).toHaveBeenCalledWith(
        farmId,
        query,
        "trace-export-1"
      );
      expect(mockRes.set).toHaveBeenCalledWith({
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition":
          'attachment; filename="milk-production-11111111-2026-09-01-to-2026-09-13.csv"',
        "Content-Length": mockResult.buffer.length,
      });
      expect(result).toBeInstanceOf(StreamableFile);
    });
  });

  describe("queryAnomalies", () => {
    it("should delegate anomaly querying to MilkAnomalyService", async () => {
      const paginatedResult: PaginatedMilkAnomaliesDto = {
        items: [mockAnomalyResponse],
        meta: {
          page: 1,
          pageSize: 20,
          total: 1,
          totalPages: 1,
        },
      };

      anomalyService.queryAnomalies.mockResolvedValue(paginatedResult);

      const query = {
        status: MilkAnomalyStatus.DETECTED,
        page: 1,
        limit: 20,
      };

      const result = await controller.queryAnomalies(farmId, query);

      expect(anomalyService.queryAnomalies).toHaveBeenCalledWith(farmId, query);
      expect(result).toEqual(paginatedResult);
    });
  });

  describe("getAnomalyById", () => {
    it("should delegate anomaly lookup to MilkAnomalyService", async () => {
      anomalyService.getAnomalyById.mockResolvedValue(mockAnomalyResponse);

      const result = await controller.getAnomalyById(
        farmId,
        mockAnomalyResponse.id
      );

      expect(anomalyService.getAnomalyById).toHaveBeenCalledWith(
        mockAnomalyResponse.id,
        farmId
      );
      expect(result).toEqual(mockAnomalyResponse);
    });
  });

  describe("triggerFarmScan", () => {
    it("should delegate farm scan triggering to MilkAnomalyService", async () => {
      const scanResponse = {
        jobId: "scan-job-123",
        farmId,
        targetDate: "2026-09-13",
      };

      anomalyService.triggerFarmScan.mockResolvedValue(scanResponse);

      const dto = {
        targetDate: "2026-09-13",
      };

      const result = await controller.triggerFarmScan(farmId, mockUser, dto);

      expect(anomalyService.triggerFarmScan).toHaveBeenCalledWith(
        farmId,
        mockUser.sub,
        dto
      );
      expect(result).toEqual(scanResponse);
    });
  });

  describe("acknowledgeAnomaly", () => {
    it("should delegate acknowledgment to MilkAnomalyService", async () => {
      const ackResponse: MilkAnomalyResponseDto = {
        ...mockAnomalyResponse,
        status: MilkAnomalyStatus.ACKNOWLEDGED,
        acknowledgedById: mockUser.sub,
        acknowledgedAt: new Date().toISOString(),
        clinicalNotes: "Subclinical mastitis suspected, veterinarian notified.",
      };

      anomalyService.acknowledgeAnomaly.mockResolvedValue(ackResponse);

      const dto = {
        clinicalNotes: "Subclinical mastitis suspected, veterinarian notified.",
      };

      const result = await controller.acknowledgeAnomaly(
        farmId,
        mockUser,
        mockAnomalyResponse.id,
        dto
      );

      expect(anomalyService.acknowledgeAnomaly).toHaveBeenCalledWith(
        mockAnomalyResponse.id,
        farmId,
        mockUser.sub,
        dto
      );
      expect(result).toEqual(ackResponse);
    });
  });

  describe("resolveAnomaly", () => {
    it("should delegate resolution to MilkAnomalyService", async () => {
      const resResponse: MilkAnomalyResponseDto = {
        ...mockAnomalyResponse,
        status: MilkAnomalyStatus.RESOLVED,
        resolvedAt: new Date().toISOString(),
        resolutionNotes: "Administered anti-inflammatory, yield normalized.",
      };

      anomalyService.resolveAnomaly.mockResolvedValue(resResponse);

      const dto = {
        resolutionNotes: "Administered anti-inflammatory, yield normalized.",
      };

      const result = await controller.resolveAnomaly(
        farmId,
        mockUser,
        mockAnomalyResponse.id,
        dto
      );

      expect(anomalyService.resolveAnomaly).toHaveBeenCalledWith(
        mockAnomalyResponse.id,
        farmId,
        mockUser.sub,
        dto
      );
      expect(result).toEqual(resResponse);
    });
  });
});
