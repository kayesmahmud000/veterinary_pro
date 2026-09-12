import { AnimalGender, AnimalSpecies, AnimalStatus } from "../../enums/index.js";

export interface UpdateAnimalRequestDto {
  readonly tagNumber?: string;
  readonly rfidNumber?: string | null;
  readonly name?: string | null;
  readonly species?: AnimalSpecies;
  readonly breed?: string | null;
  readonly gender?: AnimalGender;
  readonly dateOfBirth?: string | null;
  readonly weightKg?: number | null;
  readonly status?: AnimalStatus;
  readonly sireId?: string | null;
  readonly damId?: string | null;
  readonly metadata?: Record<string, unknown>;
}
