import { Prisma } from "@prisma/client";
import {
  ReminderChannel,
  ReminderMilestone,
  ReminderStatus,
} from "@vetralink/shared-types";
import { VaccineReminderLogEntity } from "../entities/vaccine-reminder-log.entity";

export interface VaccineReminderLogQueryFilter {
  animalId?: string;
  vaccineRecordId?: string;
  channel?: ReminderChannel;
  milestone?: ReminderMilestone;
  status?: ReminderStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface IVaccineReminderLogRepository {
  create(
    entity: VaccineReminderLogEntity,
    tx?: Prisma.TransactionClient
  ): Promise<VaccineReminderLogEntity>;

  hasReminderBeenSent(
    vaccineRecordId: string,
    milestone: ReminderMilestone,
    channel: ReminderChannel,
    dispatchedDate: string,
    tx?: Prisma.TransactionClient
  ): Promise<boolean>;

  findById(
    id: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<VaccineReminderLogEntity | null>;

  findMany(
    farmId: string,
    filter: VaccineReminderLogQueryFilter,
    tx?: Prisma.TransactionClient
  ): Promise<{ items: VaccineReminderLogEntity[]; total: number }>;
}

export const VACCINE_REMINDER_LOG_REPOSITORY = "VACCINE_REMINDER_LOG_REPOSITORY";
