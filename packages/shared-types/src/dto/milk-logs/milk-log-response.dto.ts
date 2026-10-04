import { MilkSession } from "../../enums/index.js";
import { PaginationMeta } from "../../contracts/api-response.contract.js";

export interface MilkLogAnimalSummaryDto {
  readonly id: string;
  readonly tagNumber: string;
  readonly name: string | null;
  readonly species: string;
  readonly breed: string | null;
}

export interface MilkLogRecorderSummaryDto {
  readonly id: string;
  readonly name: string;
  readonly email: string;
}

export interface MilkLogResponseDto {
  readonly id: string;
  readonly farmId: string;
  readonly animalId: string | null;
  readonly recordedById: string;
  readonly session: MilkSession;
  readonly yieldLiters: number;
  readonly fatPercent: number | null;
  readonly snfPercent: number | null;
  readonly loggedDate: string; // YYYY-MM-DD
  readonly syncVersion: number;
  readonly animal?: MilkLogAnimalSummaryDto | null;
  readonly recordedBy?: MilkLogRecorderSummaryDto | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PaginatedMilkLogsDto {
  readonly items: MilkLogResponseDto[];
  readonly meta: PaginationMeta;
}
