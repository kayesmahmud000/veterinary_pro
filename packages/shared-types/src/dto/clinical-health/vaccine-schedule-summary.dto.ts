import { VaccineRecordResponseDto } from "./vaccine-record-response.dto.js";

export interface VaccineScheduleSummaryDto {
  readonly totalRecords: number;
  readonly totalVaccinations: number;
  readonly totalDewormings: number;
  readonly dueNext7Days: number;
  readonly dueNext30Days: number;
  readonly overdueCount: number;
  readonly upcomingEvents: VaccineRecordResponseDto[];
}
