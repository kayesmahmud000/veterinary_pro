import { Prisma } from "@prisma/client";
import {
  RevenueSummaryResponseDto,
  TransactionCategory,
} from "@vetralink/shared-types";
import { FarmRevenueEntity } from "../entities/farm-revenue.entity";

export interface FarmRevenueQueryFilter {
  farmId: string;
  startDate?: Date;
  endDate?: Date;
  category?: TransactionCategory;
  animalId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: "txDate" | "amount" | "createdAt";
  sortOrder?: "asc" | "desc";
}

export interface FarmRevenueSummaryFilter {
  farmId: string;
  startDate: Date;
  endDate: Date;
  animalId?: string;
}

export interface IFarmRevenueRepository {
  create(
    entity: FarmRevenueEntity,
    tx?: Prisma.TransactionClient
  ): Promise<FarmRevenueEntity>;

  update(
    entity: FarmRevenueEntity,
    tx?: Prisma.TransactionClient
  ): Promise<FarmRevenueEntity>;

  findById(
    id: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<FarmRevenueEntity | null>;

  findMany(
    filter: FarmRevenueQueryFilter,
    tx?: Prisma.TransactionClient
  ): Promise<{ items: FarmRevenueEntity[]; total: number }>;

  getSummary(
    filter: FarmRevenueSummaryFilter,
    tx?: Prisma.TransactionClient
  ): Promise<RevenueSummaryResponseDto>;

  softDelete(
    entity: FarmRevenueEntity,
    tx?: Prisma.TransactionClient
  ): Promise<void>;
}

export const FARM_REVENUE_REPOSITORY = "FARM_REVENUE_REPOSITORY";
