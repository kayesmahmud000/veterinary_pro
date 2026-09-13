import { MilkSession, MilkExportFormat } from "../../enums/index.js";

export interface ExportMilkLogsRequestDto {
  readonly format?: MilkExportFormat;
  readonly startDate?: string; // YYYY-MM-DD
  readonly endDate?: string; // YYYY-MM-DD
  readonly animalId?: string;
  readonly session?: MilkSession;
  readonly entryType?: "INDIVIDUAL" | "BULK" | "ALL";
  readonly limit?: number;
}

export interface MilkExportResultDto {
  readonly buffer: Uint8Array;
  readonly fileName: string;
  readonly contentType: string;
}
