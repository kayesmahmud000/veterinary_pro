import { HealthEventType, SeverityLevel } from "../../enums/index.js";
import { PaginationMeta } from "../../contracts/api-response.contract.js";
import { HealthRecordAttachmentResponseDto } from "./health-record-attachment-response.dto.js";

export interface HealthIncidentAnimalSummaryDto {
  readonly id: string;
  readonly tagNumber: string;
  readonly name: string | null;
  readonly species: string;
  readonly breed: string | null;
  readonly gender: string;
}

export interface HealthIncidentUserSummaryDto {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role?: string;
}

export interface HealthIncidentResponseDto {
  readonly id: string;
  readonly farmId: string;
  readonly animalId: string;
  readonly recordedById: string;
  readonly attendingVetId: string | null;
  readonly eventType: HealthEventType;
  readonly severity: SeverityLevel;
  readonly symptoms: string;
  readonly diagnosis: string | null;
  readonly treatment: string | null;
  readonly cost: number;
  readonly resolvedAt: string | null;
  readonly isResolved: boolean;
  readonly escalationLevel?: number;
  readonly lastEscalatedAt?: string | null;
  readonly syncVersion: number;
  readonly animal?: HealthIncidentAnimalSummaryDto | null;
  readonly recordedBy?: HealthIncidentUserSummaryDto | null;
  readonly attendingVet?: HealthIncidentUserSummaryDto | null;
  readonly attachments?: HealthRecordAttachmentResponseDto[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PaginatedHealthIncidentsDto {
  readonly items: HealthIncidentResponseDto[];
  readonly meta: PaginationMeta;
}
