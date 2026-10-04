import { Prisma } from "@prisma/client";
import { AnimalWeightLogEntity } from "../entities/animal-weight-log.entity";

export interface WeightQueryOptions {
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface IAnimalWeightRepository {
  create(
    log: AnimalWeightLogEntity,
    tx?: Prisma.TransactionClient
  ): Promise<AnimalWeightLogEntity>;

  findByAnimalId(
    animalId: string,
    farmId: string,
    options?: WeightQueryOptions,
    tx?: Prisma.TransactionClient
  ): Promise<{ items: AnimalWeightLogEntity[]; total: number }>;

  findAllChronological(
    animalId: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<AnimalWeightLogEntity[]>;

  findLatestByAnimalId(
    animalId: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<AnimalWeightLogEntity | null>;

  findById(
    id: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<AnimalWeightLogEntity | null>;

  delete(
    id: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<boolean>;
}

export const ANIMAL_WEIGHT_REPOSITORY = "ANIMAL_WEIGHT_REPOSITORY";
