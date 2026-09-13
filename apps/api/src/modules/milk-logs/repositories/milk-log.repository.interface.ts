import { Prisma } from "@prisma/client";
import { MilkSession } from "@vetralink/shared-types";
import { MilkLogEntity } from "../entities/milk-log.entity";

export interface MilkLogQueryFilter {
  animalId?: string;
  session?: MilkSession;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
  sortBy?: "loggedDate" | "yieldLiters" | "createdAt";
  sortOrder?: "asc" | "desc";
  entryType?: "INDIVIDUAL" | "BULK" | "ALL";
}

export interface MilkLogAnalyticsFilter {
  animalId?: string;
  startDate: Date;
  endDate: Date;
  entryType?: "INDIVIDUAL" | "BULK" | "ALL";
}

export interface MilkLogExportFilter {
  animalId?: string;
  session?: MilkSession;
  startDate?: Date;
  endDate?: Date;
  entryType?: "INDIVIDUAL" | "BULK" | "ALL";
  limit?: number;
}

export interface IMilkLogRepository {
  create(entity: MilkLogEntity, tx?: Prisma.TransactionClient): Promise<MilkLogEntity>;
  update(entity: MilkLogEntity, tx?: Prisma.TransactionClient): Promise<MilkLogEntity>;
  delete(id: string, farmId: string, tx?: Prisma.TransactionClient): Promise<void>;
  findById(id: string, farmId: string, tx?: Prisma.TransactionClient): Promise<MilkLogEntity | null>;
  findBySessionAndDate(
    farmId: string,
    animalId: string,
    loggedDate: Date,
    session: MilkSession,
    tx?: Prisma.TransactionClient
  ): Promise<MilkLogEntity | null>;
  findBulkBySessionAndDate(
    farmId: string,
    loggedDate: Date,
    session: MilkSession,
    tx?: Prisma.TransactionClient
  ): Promise<MilkLogEntity | null>;
  findMany(
    farmId: string,
    filter: MilkLogQueryFilter,
    tx?: Prisma.TransactionClient
  ): Promise<{ items: MilkLogEntity[]; total: number }>;
  findLogsForAnalytics(
    farmId: string,
    filter: MilkLogAnalyticsFilter,
    tx?: Prisma.TransactionClient
  ): Promise<MilkLogEntity[]>;
  findLogsForExport(
    farmId: string,
    filter: MilkLogExportFilter,
    tx?: Prisma.TransactionClient
  ): Promise<MilkLogEntity[]>;
}

export const MILK_LOG_REPOSITORY = "MILK_LOG_REPOSITORY";
