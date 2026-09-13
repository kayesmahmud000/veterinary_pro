import { VaccineRecordType } from "../../enums/index.js";

export interface CreateVaccineRecordRequestDto {
  readonly animalId: string;
  readonly recordType?: VaccineRecordType;
  readonly vaccineName: string;
  readonly batchNumber?: string | null;
  readonly doseAmount: number;
  readonly doseUnit?: string;
  readonly administeredAt: string; // ISO 8601 string
  readonly nextDueDate?: string | null; // ISO 8601 or YYYY-MM-DD
  readonly cost?: number;
  readonly notes?: string | null;
}
