import { Prisma } from "@prisma/client";
import {
  MilkAnomalySeverity,
  MilkAnomalyStatus,
} from "@vetralink/shared-types";
import { MilkYieldAnomalyEntity } from "../entities/milk-yield-anomaly.entity";

export interface MilkAnomalyQueryFilter {
  animalId?: string;
  severity?: MilkAnomalySeverity;
  status?: MilkAnomalyStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface IMilkYieldAnomalyRepository {
  upsert(
    entity: MilkYieldAnomalyEntity,
    tx?: Prisma.TransactionClient
  ): Promise<MilkYieldAnomalyEntity>;

  save(
    entity: MilkYieldAnomalyEntity,
    tx?: Prisma.TransactionClient
  ): Promise<MilkYieldAnomalyEntity>;

  findById(
    id: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<MilkYieldAnomalyEntity | null>;

  findByAnimalAndDate(
    farmId: string,
    animalId: string,
    loggedDate: Date,
    tx?: Prisma.TransactionClient
  ): Promise<MilkYieldAnomalyEntity | null>;

  findMany(
    farmId: string,
    filter: MilkAnomalyQueryFilter,
    tx?: Prisma.TransactionClient
  ): Promise<{ items: MilkYieldAnomalyEntity[]; total: number }>;
}

export const MILK_YIELD_ANOMALY_REPOSITORY = "MILK_YIELD_ANOMALY_REPOSITORY";
