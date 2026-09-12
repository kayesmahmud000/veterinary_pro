import { AnimalSpecies, GrowthTrajectory } from "../../enums/index.js";
import { PaginationMeta } from "../../contracts/api-response.contract.js";

export interface RecordWeightDto {
  readonly weightKg: number;
  readonly recordedAt: string;
  readonly notes?: string | null;
}

export interface AnimalWeightLogDto {
  readonly id: string;
  readonly animalId: string;
  readonly farmId: string;
  readonly weightKg: number;
  readonly recordedAt: string;
  readonly notes: string | null;
  readonly recordedById: string;
  readonly recordedByName: string | null;
  readonly ageDays: number | null;
  readonly syncVersion: number;
  readonly createdAt: string;
}

export interface PaginatedWeightLogsDto {
  readonly items: AnimalWeightLogDto[];
  readonly meta: PaginationMeta;
}

export interface WeightHistoryQueryDto {
  readonly startDate?: string;
  readonly endDate?: string;
  readonly page?: number;
  readonly limit?: number;
}

export interface GrowthCurvePointDto {
  readonly logId: string;
  readonly recordedAt: string;
  readonly weightKg: number;
  readonly ageDays: number | null;
  readonly intervalDays: number;
  readonly weightChangeKg: number;
  readonly intervalAdgKg: number;
}

export interface GrowthCurveAnalyticsDto {
  readonly animalId: string;
  readonly tagNumber: string;
  readonly species: AnimalSpecies;
  readonly birthDate: string | null;
  readonly currentAgeDays: number | null;
  readonly currentWeightKg: number | null;
  readonly startingWeightKg: number | null;
  readonly totalGainKg: number | null;
  readonly overallAdgKg: number | null;
  readonly trajectory: GrowthTrajectory;
  readonly hasWeightLossAlert: boolean;
  readonly points: GrowthCurvePointDto[];
}
