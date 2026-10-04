import { PreventativeScheduleStatus, VaccineRecordType } from "../../enums/index.js";
import { PaginationMeta } from "../../contracts/api-response.contract.js";
import {
  HealthIncidentAnimalSummaryDto,
  HealthIncidentUserSummaryDto,
} from "./health-incident-response.dto.js";

export interface VaccineRecordResponseDto {
  readonly id: string;
  readonly farmId: string;
  readonly animalId: string;
  readonly administeredById: string;
  readonly recordType: VaccineRecordType;
  readonly vaccineName: string;
  readonly batchNumber: string | null;
  readonly doseAmount: number;
  readonly doseUnit: string;
  readonly cost: number;
  readonly notes: string | null;
  readonly administeredAt: string;
  readonly nextDueDate: string | null;
  readonly scheduleStatus: PreventativeScheduleStatus;
  readonly isOverdue: boolean;
  readonly syncVersion: number;
  readonly animal?: HealthIncidentAnimalSummaryDto | null;
  readonly administeredBy?: HealthIncidentUserSummaryDto | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PaginatedVaccineRecordsDto {
  readonly items: VaccineRecordResponseDto[];
  readonly meta: PaginationMeta;
}
