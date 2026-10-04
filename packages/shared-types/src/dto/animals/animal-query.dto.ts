import { AnimalGender, AnimalSpecies, AnimalStatus } from "../../enums/index.js";

export type AnimalSortBy =
  | "tagNumber"
  | "name"
  | "createdAt"
  | "dateOfBirth"
  | "weightKg";

export type SortOrder = "asc" | "desc";

export interface AnimalQueryFilterDto {
  readonly species?: AnimalSpecies;
  readonly gender?: AnimalGender;
  readonly status?: AnimalStatus;
  readonly search?: string;
  readonly page?: number;
  readonly limit?: number;
  readonly sortBy?: AnimalSortBy;
  readonly sortOrder?: SortOrder;
}
