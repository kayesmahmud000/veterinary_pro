import {
  ExportMilkLogsRequestDto,
  MilkExportResultDto,
} from "@vetralink/shared-types";

export interface IMilkExportService {
  exportMilkLogs(
    farmId: string,
    query: ExportMilkLogsRequestDto,
    traceId?: string
  ): Promise<MilkExportResultDto>;
}

export const MILK_EXPORT_SERVICE = "MILK_EXPORT_SERVICE";
