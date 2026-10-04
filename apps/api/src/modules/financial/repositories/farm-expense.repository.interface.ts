import { Prisma } from "@prisma/client";
import {
  ExpenseSummaryResponseDto,
  TransactionCategory,
} from "@vetralink/shared-types";
import { FarmExpenseEntity } from "../entities/farm-expense.entity";

export interface FarmExpenseQueryFilter {
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

export interface FarmExpenseSummaryFilter {
  farmId: string;
  startDate: Date;
  endDate: Date;
  animalId?: string;
}

export interface IFarmExpenseRepository {
  create(
    entity: FarmExpenseEntity,
    tx?: Prisma.TransactionClient
  ): Promise<FarmExpenseEntity>;

  update(
    entity: FarmExpenseEntity,
    tx?: Prisma.TransactionClient
  ): Promise<FarmExpenseEntity>;

  findById(
    id: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<FarmExpenseEntity | null>;

  findMany(
    filter: FarmExpenseQueryFilter,
    tx?: Prisma.TransactionClient
  ): Promise<{ items: FarmExpenseEntity[]; total: number }>;

  getSummary(
    filter: FarmExpenseSummaryFilter,
    tx?: Prisma.TransactionClient
  ): Promise<ExpenseSummaryResponseDto>;

  softDelete(
    entity: FarmExpenseEntity,
    tx?: Prisma.TransactionClient
  ): Promise<void>;
}

export const FARM_EXPENSE_REPOSITORY = "FARM_EXPENSE_REPOSITORY";
