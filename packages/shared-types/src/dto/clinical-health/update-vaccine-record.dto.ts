import { VaccineRecordType } from "../../enums/index.js";

export interface UpdateVaccineRecordRequestDto {
  readonly recordType?: VaccineRecordType;
  readonly vaccineName?: string;
  readonly batchNumber?: string | null;
  readonly doseAmount?: number;
  readonly doseUnit?: string;
  readonly administeredAt?: string;
  readonly nextDueDate?: string | null;
  readonly cost?: number;
  readonly notes?: string | null;
  readonly syncVersion?: number;
}
