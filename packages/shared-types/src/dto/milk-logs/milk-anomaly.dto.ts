import { MilkAnomalySeverity, MilkAnomalyStatus } from "../../enums/index.js";
import { PaginationMeta } from "../../contracts/api-response.contract.js";

export type MilkAnomalyJobType = "ANIMAL_DROP_CHECK" | "FARM_DAILY_SCAN";

export interface MilkAnomalyJobPayload {
  readonly jobType: MilkAnomalyJobType;
  readonly farmId: string;
  readonly animalId?: string;
  readonly loggedDate: string; // YYYY-MM-DD
  readonly actorUserId?: string;
  readonly traceId?: string;
}

export interface MilkAnomalyAnimalSummaryDto {
  readonly id: string;
  readonly tagNumber: string;
  readonly name: string | null;
  readonly species: string;
  readonly breed: string | null;
}

export interface MilkAnomalyUserSummaryDto {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

export interface MilkAnomalyResponseDto {
  readonly id: string;
  readonly farmId: string;
  readonly animalId: string;
  readonly loggedDate: string; // YYYY-MM-DD
  readonly currentYieldLiters: number;
  readonly baselineYieldLiters: number;
  readonly dropPercentage: number;
  readonly severity: MilkAnomalySeverity;
  readonly status: MilkAnomalyStatus;
  readonly acknowledgedById: string | null;
  readonly acknowledgedAt: string | null;
  readonly resolvedAt: string | null;
  readonly clinicalNotes: string | null;
  readonly resolutionNotes: string | null;
  readonly metadata?: Record<string, unknown>;
  readonly animal?: MilkAnomalyAnimalSummaryDto | null;
  readonly acknowledgedBy?: MilkAnomalyUserSummaryDto | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface MilkAnomalyQueryRequestDto {
  readonly animalId?: string;
  readonly severity?: MilkAnomalySeverity;
  readonly status?: MilkAnomalyStatus;
  readonly startDate?: string; // YYYY-MM-DD
  readonly endDate?: string; // YYYY-MM-DD
  readonly page?: number;
  readonly limit?: number;
}

export interface PaginatedMilkAnomaliesDto {
  readonly items: MilkAnomalyResponseDto[];
  readonly meta: PaginationMeta;
}

export interface AcknowledgeMilkAnomalyRequestDto {
  readonly clinicalNotes?: string;
}

export interface ResolveMilkAnomalyRequestDto {
  readonly resolutionNotes?: string;
  readonly status?: MilkAnomalyStatus.RESOLVED | MilkAnomalyStatus.FALSE_POSITIVE;
}

export interface TriggerAnomalyScanRequestDto {
  readonly targetDate?: string; // YYYY-MM-DD, defaults to today
}

export interface AnomalyScanResultDto {
  readonly farmId: string;
  readonly targetDate: string;
  readonly scannedAnimalsCount: number;
  readonly anomaliesDetectedCount: number;
  readonly detectedAnomalyIds: string[];
}
