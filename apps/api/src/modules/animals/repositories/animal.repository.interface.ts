import { Prisma } from "@prisma/client";
import { AnimalQueryFilterDto } from "@vetralink/shared-types";
import { AnimalEntity } from "../entities/animal.entity";

export interface IAnimalRepository {
  create(animal: AnimalEntity, tx?: Prisma.TransactionClient): Promise<AnimalEntity>;
  update(animal: AnimalEntity, tx?: Prisma.TransactionClient): Promise<AnimalEntity>;
  findById(id: string, farmId: string, tx?: Prisma.TransactionClient): Promise<AnimalEntity | null>;
  findByTagNumber(
    tagNumber: string,
    farmId: string,
    includeSoftDeleted?: boolean,
    tx?: Prisma.TransactionClient
  ): Promise<AnimalEntity | null>;
  findByRfidNumber(
    rfidNumber: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<AnimalEntity | null>;
  findByIdentifier(
    identifier: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<AnimalEntity | null>;
  findMany(
    farmId: string,
    filter: AnimalQueryFilterDto,
    tx?: Prisma.TransactionClient
  ): Promise<{ items: AnimalEntity[]; total: number }>;
  existsActiveTag(
    tagNumber: string,
    farmId: string,
    excludeId?: string,
    tx?: Prisma.TransactionClient
  ): Promise<boolean>;
  existsActiveRfid(
    rfidNumber: string,
    farmId: string,
    excludeId?: string,
    tx?: Prisma.TransactionClient
  ): Promise<boolean>;
  softDelete(
    id: string,
    farmId: string,
    deletedAt?: Date,
    tx?: Prisma.TransactionClient
  ): Promise<AnimalEntity>;
}

export const ANIMAL_REPOSITORY = "ANIMAL_REPOSITORY";
