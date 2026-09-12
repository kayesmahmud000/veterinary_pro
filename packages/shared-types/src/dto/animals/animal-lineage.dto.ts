import {
  AnimalGender,
  AnimalSpecies,
  AnimalStatus,
  InbreedingRiskLevel,
} from "../../enums/index.js";

export interface PedigreeNodeDto {
  readonly id: string;
  readonly tagNumber: string;
  readonly rfidNumber: string | null;
  readonly name: string | null;
  readonly species: AnimalSpecies;
  readonly breed: string | null;
  readonly gender: AnimalGender;
  readonly dateOfBirth: string | null;
  readonly status: AnimalStatus;
  readonly generation: number;
  readonly sire?: PedigreeNodeDto | null;
  readonly dam?: PedigreeNodeDto | null;
}

export interface OffspringSummaryDto {
  readonly id: string;
  readonly tagNumber: string;
  readonly rfidNumber: string | null;
  readonly name: string | null;
  readonly species: AnimalSpecies;
  readonly breed: string | null;
  readonly gender: AnimalGender;
  readonly dateOfBirth: string | null;
  readonly status: AnimalStatus;
  readonly otherParentId: string | null;
  readonly otherParentTagNumber: string | null;
  readonly otherParentName: string | null;
}

export interface AnimalLineageDto {
  readonly rootAnimal: PedigreeNodeDto;
  readonly maxGenerations: number;
  readonly ancestorGenerationsFound: number;
  readonly totalAncestors: number;
  readonly inbreedingCoefficient: number;
  readonly inbreedingRisk: InbreedingRiskLevel;
  readonly directOffspring: OffspringSummaryDto[];
  readonly totalOffspring: number;
}
