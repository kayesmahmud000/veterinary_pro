import { PreventativeScheduleStatus, VaccineRecordType } from "../../enums/index.js";

export interface VaccineRecordQueryDto {
  readonly animalId?: string;
  readonly recordType?: VaccineRecordType;
  readonly status?: PreventativeScheduleStatus;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly dueBefore?: string;
  readonly dueAfter?: string;
  readonly page?: number;
  readonly limit?: number;
  readonly sortBy?: "administeredAt" | "nextDueDate" | "createdAt" | "cost";
  readonly sortOrder?: "asc" | "desc";
}
