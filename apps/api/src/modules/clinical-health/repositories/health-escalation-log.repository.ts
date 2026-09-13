import { Injectable, Logger } from "@nestjs/common";
import {
  Prisma,
  HealthEscalationLevel as PrismaHealthEscalationLevel,
  HealthEscalationAction as PrismaHealthEscalationAction,
  ReminderChannel as PrismaReminderChannel,
  ReminderStatus as PrismaReminderStatus,
} from "@prisma/client";
import {
  HealthEscalationLevel,
  HealthEscalationAction,
  ReminderChannel,
  ReminderStatus,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { HealthEscalationLogEntity } from "../entities/health-escalation-log.entity";
import {
  IHealthEscalationLogRepository,
  HealthEscalationLogQueryFilter,
} from "./health-escalation-log.repository.interface";

@Injectable()
export class HealthEscalationLogRepository
  implements IHealthEscalationLogRepository
{
  private readonly logger = new Logger(HealthEscalationLogRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  public async create(
    entity: HealthEscalationLogEntity,
    tx?: Prisma.TransactionClient
  ): Promise<HealthEscalationLogEntity> {
    const db = tx ?? this.prisma;

    const created = await db.healthIncidentEscalationLog.create({
      data: {
        id: entity.id,
        farmId: entity.farmId,
        healthRecordId: entity.healthRecordId,
        animalId: entity.animalId,
        level: entity.level as unknown as PrismaHealthEscalationLevel,
        actionTaken: entity.actionTaken as unknown as PrismaHealthEscalationAction,
        recipientUserId: entity.recipientUserId,
        recipientPhone: entity.recipientPhone,
        channel: entity.channel as unknown as PrismaReminderChannel,
        status: entity.status as unknown as PrismaReminderStatus,
        notes: entity.notes,
        hoursUnresolved: entity.hoursUnresolved,
        dispatchedAt: entity.dispatchedAt,
      },
    });

    return this.toDomain(created);
  }

  public async hasEscalationBeenLogged(
    healthRecordId: string,
    level: HealthEscalationLevel,
    channel: ReminderChannel,
    tx?: Prisma.TransactionClient
  ): Promise<boolean> {
    const db = tx ?? this.prisma;

    const existing = await db.healthIncidentEscalationLog.findUnique({
      where: {
        unique_health_incident_escalation_level: {
          healthRecordId,
          level: level as unknown as PrismaHealthEscalationLevel,
          channel: channel as unknown as PrismaReminderChannel,
        },
      },
      select: { id: true },
    });

    return existing !== null;
  }

  public async findById(
    id: string,
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<HealthEscalationLogEntity | null> {
    const db = tx ?? this.prisma;

    const record = await db.healthIncidentEscalationLog.findFirst({
      where: {
        id,
        farmId,
      },
    });

    return record ? this.toDomain(record) : null;
  }

  public async findMany(
    farmId: string,
    filter: HealthEscalationLogQueryFilter,
    tx?: Prisma.TransactionClient
  ): Promise<{ items: HealthEscalationLogEntity[]; total: number }> {
    const db = tx ?? this.prisma;

    const where: Prisma.HealthIncidentEscalationLogWhereInput = {
      farmId,
      ...(filter.animalId ? { animalId: filter.animalId } : {}),
      ...(filter.healthRecordId
        ? { healthRecordId: filter.healthRecordId }
        : {}),
      ...(filter.level
        ? { level: filter.level as unknown as PrismaHealthEscalationLevel }
        : {}),
      ...(filter.actionTaken
        ? {
            actionTaken:
              filter.actionTaken as unknown as PrismaHealthEscalationAction,
          }
        : {}),
      ...(filter.channel
        ? { channel: filter.channel as unknown as PrismaReminderChannel }
        : {}),
      ...(filter.status
        ? { status: filter.status as unknown as PrismaReminderStatus }
        : {}),
    };

    if (filter.startDate || filter.endDate) {
      where.dispatchedAt = {
        ...(filter.startDate ? { gte: filter.startDate } : {}),
        ...(filter.endDate ? { lte: filter.endDate } : {}),
      };
    }

    const page = Math.max(1, filter.page ?? 1);
    const limit = Math.min(100, Math.max(1, filter.limit ?? 20));
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      db.healthIncidentEscalationLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dispatchedAt: "desc" },
      }),
      db.healthIncidentEscalationLog.count({ where }),
    ]);

    return {
      items: records.map((record) => this.toDomain(record)),
      total,
    };
  }

  public async findActiveEscalations(
    farmId: string,
    tx?: Prisma.TransactionClient
  ): Promise<HealthEscalationLogEntity[]> {
    const db = tx ?? this.prisma;

    // Find escalation logs for unresolved health records on this farm
    const records = await db.healthIncidentEscalationLog.findMany({
      where: {
        farmId,
        healthRecord: {
          resolvedAt: null,
        },
      },
      orderBy: { dispatchedAt: "desc" },
    });

    return records.map((record) => this.toDomain(record));
  }

  private toDomain(
    raw: Prisma.HealthIncidentEscalationLogGetPayload<Record<string, never>>
  ): HealthEscalationLogEntity {
    return HealthEscalationLogEntity.reconstitute({
      id: raw.id,
      farmId: raw.farmId,
      healthRecordId: raw.healthRecordId,
      animalId: raw.animalId,
      level: raw.level as unknown as HealthEscalationLevel,
      actionTaken: raw.actionTaken as unknown as HealthEscalationAction,
      recipientUserId: raw.recipientUserId,
      recipientPhone: raw.recipientPhone,
      channel: raw.channel as unknown as ReminderChannel,
      status: raw.status as unknown as ReminderStatus,
      notes: raw.notes,
      hoursUnresolved: raw.hoursUnresolved,
      dispatchedAt: raw.dispatchedAt,
    });
  }
}
