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
  findAncestors(
    id: string,
    farmId: string,
    maxGenerations: number,
    tx?: Prisma.TransactionClient
  ): Promise<AncestorRecordRaw[]>;
  findDirectOffspring(
    id: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<OffspringRecordRaw[]>;
  findManyByIds(
    ids: string[],
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<AnimalEntity[]>;
  getFarmName(
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<string | null>;
}

export interface AncestorRecordRaw {
  id: string;
  tag_number: string;
  rfid_number: string | null;
  name: string | null;
  species: string;
  breed: string | null;
  gender: string;
  date_of_birth: Date | string | null;
  status: string;
  sire_id: string | null;
  dam_id: string | null;
  generation: number;
  branch: "SIRE" | "DAM";
}

export interface OffspringRecordRaw {
  id: string;
  tag_number: string;
  rfid_number: string | null;
  name: string | null;
  species: string;
  breed: string | null;
  gender: string;
  date_of_birth: Date | string | null;
  status: string;
  other_parent_id: string | null;
  other_parent_tag_number: string | null;
  other_parent_name: string | null;
}

export const ANIMAL_REPOSITORY = "ANIMAL_REPOSITORY";
