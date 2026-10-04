import {
  AnimalImportJobDto,
  AnimalLineageDto,
  AnimalQueryFilterDto,
  AnimalResponseDto,
  AnimalWeightLogDto,
  CheckTagAvailabilityDto,
  GrowthCurveAnalyticsDto,
  PaginatedAnimalsDto,
  PaginatedImportJobsDto,
  PaginatedWeightLogsDto,
  RecordWeightDto,
  RegisterAnimalRequestDto,
  TagAvailabilityResponseDto,
  UpdateAnimalRequestDto,
  WeightHistoryQueryDto,
} from "@vetralink/shared-types";

export interface IAnimalsService {
  registerAnimal(
    farmId: string,
    dto: RegisterAnimalRequestDto,
    actorUserId?: string,
    traceId?: string
  ): Promise<AnimalResponseDto>;

  updateAnimal(
    id: string,
    farmId: string,
    dto: UpdateAnimalRequestDto,
    actorUserId?: string,
    traceId?: string
  ): Promise<AnimalResponseDto>;

  getAnimalById(id: string, farmId: string): Promise<AnimalResponseDto>;

  lookupByIdentifier(
    identifier: string,
    farmId: string
  ): Promise<AnimalResponseDto>;

  checkTagAvailability(
    farmId: string,
    dto: CheckTagAvailabilityDto
  ): Promise<TagAvailabilityResponseDto>;

  getAnimals(
    farmId: string,
    query: AnimalQueryFilterDto
  ): Promise<PaginatedAnimalsDto>;

  archiveAnimal(
    id: string,
    farmId: string,
    actorUserId?: string,
    traceId?: string
  ): Promise<AnimalResponseDto>;

  getAnimalLineage(
    id: string,
    farmId: string,
    generations?: number
  ): Promise<AnimalLineageDto>;

  recordWeight(
    animalId: string,
    farmId: string,
    dto: RecordWeightDto,
    actorUserId: string,
    traceId?: string
  ): Promise<AnimalWeightLogDto>;

  getWeightHistory(
    animalId: string,
    farmId: string,
    query?: WeightHistoryQueryDto
  ): Promise<PaginatedWeightLogsDto>;

  getGrowthCurve(
    animalId: string,
    farmId: string
  ): Promise<GrowthCurveAnalyticsDto>;

  deleteWeightLog(
    animalId: string,
    weightLogId: string,
    farmId: string,
    actorUserId: string,
    traceId?: string
  ): Promise<void>;

  createImportJob(
    farmId: string,
    file: Express.Multer.File,
    actorUserId: string,
    traceId?: string
  ): Promise<AnimalImportJobDto>;

  getImportJob(jobId: string, farmId: string): Promise<AnimalImportJobDto>;

  getImportJobs(
    farmId: string,
    page?: number,
    limit?: number
  ): Promise<PaginatedImportJobsDto>;

  generateImportTemplate(): string;
}

export const ANIMALS_SERVICE = "ANIMALS_SERVICE";
