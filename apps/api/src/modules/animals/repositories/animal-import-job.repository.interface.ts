import { AnimalImportJobEntity } from "../entities/animal-import-job.entity";

export const ANIMAL_IMPORT_JOB_REPOSITORY = Symbol("ANIMAL_IMPORT_JOB_REPOSITORY");

export interface IAnimalImportJobRepository {
  create(job: AnimalImportJobEntity): Promise<AnimalImportJobEntity>;
  findById(id: string, farmId: string): Promise<AnimalImportJobEntity | null>;
  findByFarmId(
    farmId: string,
    options?: { page?: number; limit?: number }
  ): Promise<{ items: AnimalImportJobEntity[]; total: number }>;
  update(job: AnimalImportJobEntity): Promise<AnimalImportJobEntity>;
}
