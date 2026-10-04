import * as xlsx from "xlsx";
import {
  MilkExportFormat,
  MilkSession,
} from "@vetralink/shared-types";
import { IMilkLogRepository } from "../repositories/milk-log.repository.interface";
import { MilkExportService } from "./milk-export.service";
import { MilkLogEntity } from "../entities/milk-log.entity";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import { parseYmdToDate } from "../utils/milk-yield-analytics.util";

describe("MilkExportService", () => {
  let service: MilkExportService;
  let repository: jest.Mocked<IMilkLogRepository>;

  const farmId = "11111111-1111-1111-1111-111111111111";

  const createMockMilkLog = (props: {
    id?: string;
    loggedDate: Date;
    session: MilkSession;
    yieldLiters: number;
    fatPercent?: number | null;
    snfPercent?: number | null;
    animalId?: string | null;
    tagNumber?: string;
    animalName?: string;
  }): MilkLogEntity => {
    return new MilkLogEntity({
      id: props.id ?? crypto.randomUUID(),
      farmId,
      animalId: props.animalId !== undefined ? props.animalId : "animal-1",
      recordedById: "user-1",
      session: props.session,
      yieldLiters: props.yieldLiters,
      fatPercent: props.fatPercent ?? null,
      snfPercent: props.snfPercent ?? null,
      loggedDate: props.loggedDate,
      syncVersion: 1,
      createdAt: new Date("2026-09-13T06:00:00.000Z"),
      updatedAt: new Date("2026-09-13T06:00:00.000Z"),
      animal:
        props.animalId === null
          ? null
          : {
              id: props.animalId ?? "animal-1",
              tagNumber: props.tagNumber ?? "COW-001",
              name: props.animalName ?? "Daisy, Bell",
              species: "COW",
              breed: "Holstein",
            },
      recordedBy: {
        id: "user-1",
        name: "Tariq Rahman",
        email: "tariq@vetralink.pro",
      },
    });
  };

  beforeEach(() => {
    repository = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findById: jest.fn(),
      findBySessionAndDate: jest.fn(),
      findBulkBySessionAndDate: jest.fn(),
      findMany: jest.fn(),
      findLogsForAnalytics: jest.fn(),
      findLogsForExport: jest.fn(),
    };

    service = new MilkExportService(repository);
  });

  describe("CSV Export", () => {
    it("should export milk logs as RFC 4180 CSV with UTF-8 BOM and correct headers", async () => {
      const mockLogs = [
        createMockMilkLog({
          id: "log-1",
          loggedDate: parseYmdToDate("2026-09-10"),
          session: MilkSession.MORNING,
          yieldLiters: 15.25,
          fatPercent: 3.8,
          snfPercent: 8.5,
          animalId: "animal-1",
          tagNumber: "COW-001",
          animalName: 'Daisy "The Great"',
        }),
        createMockMilkLog({
          id: "log-2",
          loggedDate: parseYmdToDate("2026-09-10"),
          session: MilkSession.EVENING,
          yieldLiters: 950.0,
          animalId: null, // Bulk
        }),
      ];

      repository.findLogsForExport.mockResolvedValue(mockLogs);

      const result = await service.exportMilkLogs(farmId, {
        format: MilkExportFormat.CSV,
        startDate: "2026-09-01",
        endDate: "2026-09-13",
      });

      expect(result.contentType).toBe("text/csv; charset=utf-8");
      expect(result.fileName).toBe("milk-production-11111111-2026-09-01-to-2026-09-13.csv");

      const csvString = Buffer.from(result.buffer).toString("utf8");
      // Verify BOM
      expect(csvString.startsWith("\uFEFF")).toBe(true);

      const lines = csvString.slice(1).split("\r\n");
      expect(lines[0]).toBe(
        "Log ID,Date,Session,Entry Type,Animal Tag,Animal Name,Species,Breed,Yield (Liters),Fat %,SNF %,Recorded By Name,Recorded By Email,Sync Version,Created At"
      );

      // Verify row 1 escaping (double quotes escaped)
      expect(lines[1]).toContain('"Daisy ""The Great"""');
      expect(lines[1]).toContain("15.250");
      expect(lines[1]).toContain("3.80");
      expect(lines[1]).toContain("8.50");
      expect(lines[1]).toContain("INDIVIDUAL");

      // Verify bulk row
      expect(lines[2]).toContain("BULK");
      expect(lines[2]).toContain("950.000");
    });

    it("should handle empty dataset cleanly with valid CSV header", async () => {
      repository.findLogsForExport.mockResolvedValue([]);

      const result = await service.exportMilkLogs(farmId, {
        format: MilkExportFormat.CSV,
        startDate: "2026-09-01",
        endDate: "2026-09-05",
      });

      expect(result.contentType).toBe("text/csv; charset=utf-8");
      const csvString = Buffer.from(result.buffer).toString("utf8");
      expect(csvString.startsWith("\uFEFF")).toBe(true);
      const lines = csvString.slice(1).split("\r\n");
      expect(lines.length).toBe(1);
      expect(lines[0]).toContain("Log ID,Date,Session");
    });
  });

  describe("Excel Export (.xlsx)", () => {
    it("should export valid multi-sheet workbook with Production Logs and Executive Summary", async () => {
      const mockLogs = [
        createMockMilkLog({
          loggedDate: parseYmdToDate("2026-09-12"),
          session: MilkSession.MORNING,
          yieldLiters: 20.0,
          fatPercent: 4.0,
          snfPercent: 9.0,
        }),
        createMockMilkLog({
          loggedDate: parseYmdToDate("2026-09-12"),
          session: MilkSession.AFTERNOON,
          yieldLiters: 15.0,
          fatPercent: 3.5,
          snfPercent: 8.5,
        }),
        createMockMilkLog({
          loggedDate: parseYmdToDate("2026-09-12"),
          session: MilkSession.EVENING,
          yieldLiters: 100.0,
          animalId: null, // Bulk
        }),
      ];

      repository.findLogsForExport.mockResolvedValue(mockLogs);

      const result = await service.exportMilkLogs(farmId, {
        format: MilkExportFormat.EXCEL,
        startDate: "2026-09-10",
        endDate: "2026-09-13",
      });

      expect(result.contentType).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      expect(result.fileName).toBe(
        "milk-production-11111111-2026-09-10-to-2026-09-13.xlsx"
      );

      // Parse back with xlsx
      const workbook = xlsx.read(result.buffer, { type: "buffer" });
      expect(workbook.SheetNames).toContain("Production Logs");
      expect(workbook.SheetNames).toContain("Executive Summary");

      // Verify Production Logs data
      const logsSheet = workbook.Sheets["Production Logs"]!;
      const rows = xlsx.utils.sheet_to_json<Record<string, unknown>>(logsSheet);
      expect(rows.length).toBe(3);
      expect(rows[0]!["Yield (Liters)"]).toBe(20);
      expect(rows[0]!["Fat %"]).toBe(4);
      expect(rows[0]!["Entry Type"]).toBe("INDIVIDUAL");
      expect(rows[2]!["Entry Type"]).toBe("BULK");

      // Verify Executive Summary metrics
      const summarySheet = workbook.Sheets["Executive Summary"]!;
      const summaryRows = xlsx.utils.sheet_to_json<{
        Metric: string;
        Value: unknown;
      }>(summarySheet);

      const metricsMap = new Map(summaryRows.map((r) => [r.Metric, r.Value]));
      expect(metricsMap.get("Total Records Exported")).toBe(3);
      expect(metricsMap.get("Individual Animal Records")).toBe(2);
      expect(metricsMap.get("Bulk Tank Collection Records")).toBe(1);
      expect(metricsMap.get("Total Milk Volume (Liters)")).toBe(135);
      expect(metricsMap.get("Morning Session Volume (Liters)")).toBe(20);
      expect(metricsMap.get("Afternoon Session Volume (Liters)")).toBe(15);
      expect(metricsMap.get("Evening Session Volume (Liters)")).toBe(100);
      // Weighted fat: (20*4 + 15*3.5) / 35 = (80 + 52.5) / 35 = 132.5 / 35 = 3.79
      expect(metricsMap.get("Weighted Average Fat %")).toBe(3.79);
    });

    it("should handle empty logs for Excel export without crashing", async () => {
      repository.findLogsForExport.mockResolvedValue([]);

      const result = await service.exportMilkLogs(farmId, {
        format: MilkExportFormat.EXCEL,
      });

      expect(result.contentType).toBe(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      const workbook = xlsx.read(result.buffer, { type: "buffer" });
      expect(workbook.SheetNames).toContain("Production Logs");
      expect(workbook.SheetNames).toContain("Executive Summary");
    });
  });

  describe("Validation & Error Boundaries", () => {
    it("should throw ValidationDomainException if startDate format is invalid", async () => {
      await expect(
        service.exportMilkLogs(farmId, {
          startDate: "13-09-2026",
        })
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if endDate format is invalid", async () => {
      await expect(
        service.exportMilkLogs(farmId, {
          endDate: "2026/09/13",
        })
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if startDate > endDate", async () => {
      await expect(
        service.exportMilkLogs(farmId, {
          startDate: "2026-09-13",
          endDate: "2026-09-01",
        })
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if endDate is in the distant future", async () => {
      await expect(
        service.exportMilkLogs(farmId, {
          endDate: "2099-01-01",
        })
      ).rejects.toThrow(ValidationDomainException);
    });
  });

  describe("Filter Delegation", () => {
    it("should propagate query filters properly to repository", async () => {
      repository.findLogsForExport.mockResolvedValue([]);

      await service.exportMilkLogs(farmId, {
        animalId: "animal-uuid-1",
        session: MilkSession.MORNING,
        startDate: "2026-09-01",
        endDate: "2026-09-10",
        entryType: "INDIVIDUAL",
        limit: 2000,
      });

      expect(repository.findLogsForExport).toHaveBeenCalledWith(farmId, {
        animalId: "animal-uuid-1",
        session: MilkSession.MORNING,
        startDate: parseYmdToDate("2026-09-01"),
        endDate: parseYmdToDate("2026-09-10"),
        entryType: "INDIVIDUAL",
        limit: 2000,
      });
    });
  });
});
