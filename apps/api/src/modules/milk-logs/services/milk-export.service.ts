import { Inject, Injectable, Logger } from "@nestjs/common";
import * as xlsx from "xlsx";
import {
  ExportMilkLogsRequestDto,
  MilkExportFormat,
  MilkExportResultDto,
  MilkSession,
} from "@vetralink/shared-types";
import {
  IMilkLogRepository,
  MILK_LOG_REPOSITORY,
} from "../repositories/milk-log.repository.interface";
import { IMilkExportService } from "./milk-export.service.interface";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import {
  formatDateToYmd,
  parseYmdToDate,
  round,
} from "../utils/milk-yield-analytics.util";
import { MilkLogEntity } from "../entities/milk-log.entity";

@Injectable()
export class MilkExportService implements IMilkExportService {
  private readonly logger = new Logger(MilkExportService.name);

  constructor(
    @Inject(MILK_LOG_REPOSITORY)
    private readonly milkLogRepository: IMilkLogRepository
  ) {}

  public async exportMilkLogs(
    farmId: string,
    query: ExportMilkLogsRequestDto,
    traceId?: string
  ): Promise<MilkExportResultDto> {
    const tracePrefix = traceId ? `[TraceId: ${traceId}] ` : "";
    this.logger.log(
      `${tracePrefix}Exporting milk logs for farm [${farmId}] with format [${query.format ?? "CSV"}]`
    );

    // 1. Validate date ranges
    let parsedStart: Date | undefined;
    let parsedEnd: Date | undefined;

    if (query.startDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(query.startDate)) {
        throw new ValidationDomainException(
          "startDate must follow the ISO format YYYY-MM-DD."
        );
      }
      parsedStart = parseYmdToDate(query.startDate);
    }

    if (query.endDate) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(query.endDate)) {
        throw new ValidationDomainException(
          "endDate must follow the ISO format YYYY-MM-DD."
        );
      }
      parsedEnd = parseYmdToDate(query.endDate);
    }

    if (parsedStart && parsedEnd && parsedStart > parsedEnd) {
      throw new ValidationDomainException(
        "startDate cannot be chronologically after endDate."
      );
    }

    // Safety guard: max future limit
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    if (parsedEnd && parsedEnd > tomorrow) {
      throw new ValidationDomainException(
        "Export date range cannot extend into the future."
      );
    }

    // 2. Fetch logs from repository
    const limit = Math.min(10000, Math.max(1, query.limit ?? 5000));
    const logs = await this.milkLogRepository.findLogsForExport(farmId, {
      animalId: query.animalId,
      session: query.session,
      startDate: parsedStart,
      endDate: parsedEnd,
      entryType: query.entryType,
      limit,
    });

    const format = query.format ?? MilkExportFormat.CSV;
    const startStr = query.startDate ?? (logs.length > 0 ? formatDateToYmd(logs[0]!.loggedDate) : "all");
    const endStr = query.endDate ?? (logs.length > 0 ? formatDateToYmd(logs[logs.length - 1]!.loggedDate) : "all");
    const farmPrefix = farmId.slice(0, 8);

    if (format === MilkExportFormat.EXCEL) {
      return this.generateExcelExport(farmId, logs, query, farmPrefix, startStr, endStr);
    }

    return this.generateCsvExport(farmId, logs, farmPrefix, startStr, endStr);
  }

  private generateCsvExport(
    farmId: string,
    logs: MilkLogEntity[],
    farmPrefix: string,
    startStr: string,
    endStr: string
  ): MilkExportResultDto {
    const headers = [
      "Log ID",
      "Date",
      "Session",
      "Entry Type",
      "Animal Tag",
      "Animal Name",
      "Species",
      "Breed",
      "Yield (Liters)",
      "Fat %",
      "SNF %",
      "Recorded By Name",
      "Recorded By Email",
      "Sync Version",
      "Created At",
    ];

    const rows: string[] = [headers.join(",")];

    for (const log of logs) {
      const row = [
        this.escapeCsv(log.id),
        this.escapeCsv(formatDateToYmd(log.loggedDate)),
        this.escapeCsv(log.session),
        this.escapeCsv(log.isBulk ? "BULK" : "INDIVIDUAL"),
        this.escapeCsv(log.animal?.tagNumber ?? "N/A"),
        this.escapeCsv(log.animal?.name ?? ""),
        this.escapeCsv(log.animal?.species ?? ""),
        this.escapeCsv(log.animal?.breed ?? ""),
        log.yieldLiters.toFixed(3),
        log.fatPercent !== null ? log.fatPercent.toFixed(2) : "",
        log.snfPercent !== null ? log.snfPercent.toFixed(2) : "",
        this.escapeCsv(log.recordedBy?.name ?? ""),
        this.escapeCsv(log.recordedBy?.email ?? ""),
        String(log.syncVersion),
        this.escapeCsv(log.createdAt.toISOString()),
      ];
      rows.push(row.join(","));
    }

    // Prepend UTF-8 BOM (\uFEFF) for Excel UTF-8 compatibility
    const csvContent = "\uFEFF" + rows.join("\r\n");
    const buffer = Buffer.from(csvContent, "utf8");
    const fileName = `milk-production-${farmPrefix}-${startStr}-to-${endStr}.csv`;

    return {
      buffer,
      fileName,
      contentType: "text/csv; charset=utf-8",
    };
  }

  private generateExcelExport(
    farmId: string,
    logs: MilkLogEntity[],
    query: ExportMilkLogsRequestDto,
    farmPrefix: string,
    startStr: string,
    endStr: string
  ): MilkExportResultDto {
    const workbook = xlsx.utils.book_new();

    // Sheet 1: Production Logs
    const logRows = logs.map((log) => ({
      "Log ID": log.id,
      Date: formatDateToYmd(log.loggedDate),
      Session: log.session,
      "Entry Type": log.isBulk ? "BULK" : "INDIVIDUAL",
      "Animal Tag": log.animal?.tagNumber ?? "N/A",
      "Animal Name": log.animal?.name ?? "",
      Species: log.animal?.species ?? "",
      Breed: log.animal?.breed ?? "",
      "Yield (Liters)": round(log.yieldLiters, 3),
      "Fat %": log.fatPercent !== null ? round(log.fatPercent, 2) : "",
      "SNF %": log.snfPercent !== null ? round(log.snfPercent, 2) : "",
      "Recorded By Name": log.recordedBy?.name ?? "",
      "Recorded By Email": log.recordedBy?.email ?? "",
      "Sync Version": log.syncVersion,
      "Created At": log.createdAt.toISOString(),
    }));

    const wsLogs = xlsx.utils.json_to_sheet(logRows);

    // Auto-fit column widths for Sheet 1
    const colWidths = [
      { wch: 38 }, // Log ID
      { wch: 12 }, // Date
      { wch: 12 }, // Session
      { wch: 12 }, // Entry Type
      { wch: 14 }, // Animal Tag
      { wch: 18 }, // Animal Name
      { wch: 12 }, // Species
      { wch: 20 }, // Breed
      { wch: 14 }, // Yield (Liters)
      { wch: 10 }, // Fat %
      { wch: 10 }, // SNF %
      { wch: 22 }, // Recorded By Name
      { wch: 26 }, // Recorded By Email
      { wch: 12 }, // Sync Version
      { wch: 24 }, // Created At
    ];
    wsLogs["!cols"] = colWidths;

    xlsx.utils.book_append_sheet(workbook, wsLogs, "Production Logs");

    // Sheet 2: Executive Summary
    const totalVolume = logs.reduce((acc, curr) => acc + curr.yieldLiters, 0);
    const individualLogs = logs.filter((l) => !l.isBulk);
    const bulkLogs = logs.filter((l) => l.isBulk);
    const morningVolume = logs
      .filter((l) => l.session === MilkSession.MORNING)
      .reduce((acc, curr) => acc + curr.yieldLiters, 0);
    const afternoonVolume = logs
      .filter((l) => l.session === MilkSession.AFTERNOON)
      .reduce((acc, curr) => acc + curr.yieldLiters, 0);
    const eveningVolume = logs
      .filter((l) => l.session === MilkSession.EVENING)
      .reduce((acc, curr) => acc + curr.yieldLiters, 0);

    // Weighted Fat and SNF averages
    let totalFatVolume = 0;
    let fatEligibleYield = 0;
    let totalSnfVolume = 0;
    let snfEligibleYield = 0;

    for (const log of logs) {
      if (log.fatPercent !== null && log.fatPercent !== undefined) {
        totalFatVolume += log.fatPercent * log.yieldLiters;
        fatEligibleYield += log.yieldLiters;
      }
      if (log.snfPercent !== null && log.snfPercent !== undefined) {
        totalSnfVolume += log.snfPercent * log.yieldLiters;
        snfEligibleYield += log.yieldLiters;
      }
    }

    const weightedAvgFat = fatEligibleYield > 0 ? round(totalFatVolume / fatEligibleYield, 2) : "N/A";
    const weightedAvgSnf = snfEligibleYield > 0 ? round(totalSnfVolume / snfEligibleYield, 2) : "N/A";

    const summaryData = [
      { Metric: "Farm Tenant UUID", Value: farmId },
      { Metric: "Export Generated At", Value: new Date().toISOString() },
      { Metric: "Date Range Filter", Value: `${startStr} to ${endStr}` },
      { Metric: "Session Filter", Value: query.session ?? "ALL" },
      { Metric: "Entry Type Filter", Value: query.entryType ?? "ALL" },
      { Metric: "Total Records Exported", Value: logs.length },
      { Metric: "Individual Animal Records", Value: individualLogs.length },
      { Metric: "Bulk Tank Collection Records", Value: bulkLogs.length },
      { Metric: "Total Milk Volume (Liters)", Value: round(totalVolume, 3) },
      {
        Metric: "Average Yield per Record (Liters)",
        Value: logs.length > 0 ? round(totalVolume / logs.length, 3) : 0,
      },
      { Metric: "Morning Session Volume (Liters)", Value: round(morningVolume, 3) },
      { Metric: "Afternoon Session Volume (Liters)", Value: round(afternoonVolume, 3) },
      { Metric: "Evening Session Volume (Liters)", Value: round(eveningVolume, 3) },
      { Metric: "Weighted Average Fat %", Value: weightedAvgFat },
      { Metric: "Weighted Average SNF %", Value: weightedAvgSnf },
    ];

    const wsSummary = xlsx.utils.json_to_sheet(summaryData);
    wsSummary["!cols"] = [{ wch: 35 }, { wch: 45 }];
    xlsx.utils.book_append_sheet(workbook, wsSummary, "Executive Summary");

    // Write binary buffer
    const buffer: Buffer = xlsx.write(workbook, {
      type: "buffer",
      bookType: "xlsx",
    });

    const fileName = `milk-production-${farmPrefix}-${startStr}-to-${endStr}.xlsx`;

    return {
      buffer,
      fileName,
      contentType:
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  }

  private escapeCsv(val: string): string {
    if (!val) {
      return "";
    }
    if (
      val.includes(",") ||
      val.includes('"') ||
      val.includes("\n") ||
      val.includes("\r")
    ) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  }
}
