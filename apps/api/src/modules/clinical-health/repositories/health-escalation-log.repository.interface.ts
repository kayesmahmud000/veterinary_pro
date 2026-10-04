import { Prisma } from "@prisma/client";
import {
  HealthEscalationLevel,
  HealthEscalationAction,
  ReminderChannel,
  ReminderStatus,
} from "@vetralink/shared-types";
import { HealthEscalationLogEntity } from "../entities/health-escalation-log.entity";

export interface HealthEscalationLogQueryFilter {
  animalId?: string;
  healthRecordId?: string;
  level?: HealthEscalationLevel;
  actionTaken?: HealthEscalationAction;
  channel?: ReminderChannel;
  status?: ReminderStatus;
  startDate?: Date;
  endDate?: Date;
  page?: number;
  limit?: number;
}

export interface IHealthEscalationLogRepository {
  create(
    entity: HealthEscalationLogEntity,
    tx?: Prisma.TransactionClient
  ): Promise<HealthEscalationLogEntity>;

  hasEscalationBeenLogged(
    healthRecordId: string,
    level: HealthEscalationLevel,
    channel: ReminderChannel,
    tx?: Prisma.TransactionClient
  ): Promise<boolean>;

  findById(
    id: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<HealthEscalationLogEntity | null>;

  findMany(
    farmId: string,
    filter: HealthEscalationLogQueryFilter,
    tx?: Prisma.TransactionClient
  ): Promise<{ items: HealthEscalationLogEntity[]; total: number }>;

  findActiveEscalations(
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<HealthEscalationLogEntity[]>;
}

export const HEALTH_ESCALATION_LOG_REPOSITORY = "HEALTH_ESCALATION_LOG_REPOSITORY";
