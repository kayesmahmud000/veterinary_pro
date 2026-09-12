import { AnimalGender, AnimalSpecies, ImportJobStatus } from "../../enums/index.js";
import { PaginationMeta } from "../../contracts/api-response.contract.js";

export interface AnimalImportRowErrorDto {
  row: number;
  tagNumber?: string;
  field?: string;
  message: string;
  rawData?: Record<string, unknown>;
}

export interface AnimalImportJobDto {
  id: string;
  farmId: string;
  uploadedById: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  status: ImportJobStatus;
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  errorReport: AnimalImportRowErrorDto[] | null;
  progressPercentage: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedImportJobsDto {
  items: AnimalImportJobDto[];
  meta: PaginationMeta;
}

export interface AnimalImportRowDto {
  tagNumber: string;
  name?: string;
  species: AnimalSpecies;
  breed?: string;
  gender: AnimalGender;
  dateOfBirth?: string;
  weightKg?: number;
  rfidNumber?: string;
  sireTag?: string;
  damTag?: string;
}
