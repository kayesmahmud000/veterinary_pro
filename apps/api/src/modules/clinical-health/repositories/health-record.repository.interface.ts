import { Prisma } from "@prisma/client";
import { HealthEventType, SeverityLevel } from "@vetralink/shared-types";
import { HealthRecordEntity } from "../entities/health-record.entity";

export interface HealthRecordQueryFilter {
  animalId?: string;
  eventType?: HealthEventType;
  severity?: SeverityLevel;
  isResolved?: boolean;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "severity" | "cost" | "resolvedAt";
  sortOrder?: "asc" | "desc";
}

export interface IHealthRecordRepository {
  create(entity: HealthRecordEntity, tx?: Prisma.TransactionClient): Promise<HealthRecordEntity>;
  update(entity: HealthRecordEntity, tx?: Prisma.TransactionClient): Promise<HealthRecordEntity>;
  findById(id: string, farmId: string, tx?: Prisma.TransactionClient): Promise<HealthRecordEntity | null>;
  findMany(
    farmId: string,
    filter: HealthRecordQueryFilter,
    tx?: Prisma.TransactionClient
  ): Promise<{ items: HealthRecordEntity[]; total: number }>;
  findUnresolvedCriticalCases(
    farmId?: string,
    asOfDate?: Date,
    tx?: Prisma.TransactionClient
  ): Promise<HealthRecordEntity[]>;
  delete(id: string, farmId: string, tx?: Prisma.TransactionClient): Promise<void>;
}

export const HEALTH_RECORD_REPOSITORY = "HEALTH_RECORD_REPOSITORY";
