import { Prisma } from "@prisma/client";
import {
  PreventativeScheduleStatus,
  VaccineRecordType,
} from "@vetralink/shared-types";
import { VaccineRecordEntity } from "../entities/vaccine-record.entity";

export interface VaccineRecordQueryFilter {
  animalId?: string;
  recordType?: VaccineRecordType;
  status?: PreventativeScheduleStatus;
  startDate?: Date;
  endDate?: Date;
  dueBefore?: Date;
  dueAfter?: Date;
  page?: number;
  limit?: number;
  sortBy?: "administeredAt" | "nextDueDate" | "createdAt" | "cost";
  sortOrder?: "asc" | "desc";
  asOfDate?: Date;
}

export interface VaccineScheduleCounts {
  totalRecords: number;
  totalVaccinations: number;
  totalDewormings: number;
  dueNext7Days: number;
  dueNext30Days: number;
  overdueCount: number;
}

export interface IVaccineRecordRepository {
  create(
    entity: VaccineRecordEntity,
    tx?: Prisma.TransactionClient
  ): Promise<VaccineRecordEntity>;

  update(
    entity: VaccineRecordEntity,
    tx?: Prisma.TransactionClient
  ): Promise<VaccineRecordEntity>;

  findById(
    id: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<VaccineRecordEntity | null>;

  findMany(
    farmId: string,
    filter: VaccineRecordQueryFilter,
    tx?: Prisma.TransactionClient
  ): Promise<{ items: VaccineRecordEntity[]; total: number }>;

  getScheduleCounts(
    farmId: string,
    asOfDate?: Date,
    tx?: Prisma.TransactionClient
  ): Promise<VaccineScheduleCounts>;

  findUpcoming(
    farmId: string,
    daysAhead?: number,
    limit?: number,
    asOfDate?: Date,
    tx?: Prisma.TransactionClient
  ): Promise<VaccineRecordEntity[]>;

  findRecordsForReminderScan(
    farmId?: string,
    daysAhead?: number,
    asOfDate?: Date,
    tx?: Prisma.TransactionClient
  ): Promise<VaccineRecordEntity[]>;

  delete(
    id: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<void>;
}

export const VACCINE_RECORD_REPOSITORY = "VACCINE_RECORD_REPOSITORY";
