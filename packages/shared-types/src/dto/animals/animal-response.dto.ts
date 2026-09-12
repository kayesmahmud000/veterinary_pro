import { AnimalGender, AnimalSpecies, AnimalStatus } from "../../enums/index.js";
import { PaginationMeta } from "../../contracts/api-response.contract.js";

export interface AnimalPedigreeSummaryDto {
  readonly id: string;
  readonly tagNumber: string;
  readonly name: string | null;
}

export interface AnimalResponseDto {
  readonly id: string;
  readonly farmId: string;
  readonly tagNumber: string;
  readonly rfidNumber: string | null;
  readonly name: string | null;
  readonly species: AnimalSpecies;
  readonly breed: string | null;
  readonly gender: AnimalGender;
  readonly dateOfBirth: string | null;
  readonly ageMonths: number | null;
  readonly weightKg: number | null;
  readonly status: AnimalStatus;
  readonly sireId: string | null;
  readonly damId: string | null;
  readonly sire?: AnimalPedigreeSummaryDto | null;
  readonly dam?: AnimalPedigreeSummaryDto | null;
  readonly metadata: Record<string, unknown>;
  readonly syncVersion: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface PaginatedAnimalsDto {
  readonly items: AnimalResponseDto[];
  readonly meta: PaginationMeta;
}
