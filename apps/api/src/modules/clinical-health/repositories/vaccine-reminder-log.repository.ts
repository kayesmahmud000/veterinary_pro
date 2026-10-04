import { Injectable, Logger } from "@nestjs/common";
import {
  Prisma,
  ReminderChannel as PrismaReminderChannel,
  ReminderMilestone as PrismaReminderMilestone,
  ReminderStatus as PrismaReminderStatus,
} from "@prisma/client";
import {
  ReminderChannel,
  ReminderMilestone,
  ReminderStatus,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { VaccineReminderLogEntity } from "../entities/vaccine-reminder-log.entity";
import {
  IVaccineReminderLogRepository,
  VaccineReminderLogQueryFilter,
} from "./vaccine-reminder-log.repository.interface";

@Injectable()
export class VaccineReminderLogRepository
  implements IVaccineReminderLogRepository
{
  private readonly logger = new Logger(VaccineReminderLogRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  public async create(
    entity: VaccineReminderLogEntity,
    tx?: Prisma.TransactionClient
  ): Promise<VaccineReminderLogEntity> {
    const db = tx ?? this.prisma;

    const created = await db.vaccineReminderLog.create({
      data: {
        id: entity.id,
        farmId: entity.farmId,
        vaccineRecordId: entity.vaccineRecordId,
        animalId: entity.animalId,
        recipientUserId: entity.recipientUserId,
        recipientPhone: entity.recipientPhone,
        channel: entity.channel as unknown as PrismaReminderChannel,
        milestone: entity.milestone as unknown as PrismaReminderMilestone,
        status: entity.status as unknown as PrismaReminderStatus,
        message: entity.message,
        errorMessage: entity.errorMessage,
        dispatchedDate: entity.dispatchedDate,
        dispatchedAt: entity.dispatchedAt,
      },
    });

    return this.toDomain(created);
  }

  public async hasReminderBeenSent(
    vaccineRecordId: string,
    milestone: ReminderMilestone,
    channel: ReminderChannel,
    dispatchedDate: string,
    tx?: Prisma.TransactionClient
  ): Promise<boolean> {
    const db = tx ?? this.prisma;

    const existing = await db.vaccineReminderLog.findUnique({
      where: {
        unique_vaccine_reminder_daily: {
          vaccineRecordId,
          milestone: milestone as unknown as PrismaReminderMilestone,
          channel: channel as unknown as PrismaReminderChannel,
          dispatchedDate,
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
  ): Promise<VaccineReminderLogEntity | null> {
    const db = tx ?? this.prisma;

    const record = await db.vaccineReminderLog.findFirst({
      where: {
        id,
        farmId,
      },
    });

    return record ? this.toDomain(record) : null;
  }

  public async findMany(
    farmId: string,
    filter: VaccineReminderLogQueryFilter,
    tx?: Prisma.TransactionClient
  ): Promise<{ items: VaccineReminderLogEntity[]; total: number }> {
    const db = tx ?? this.prisma;

    const where: Prisma.VaccineReminderLogWhereInput = {
      farmId,
      ...(filter.animalId ? { animalId: filter.animalId } : {}),
      ...(filter.vaccineRecordId
        ? { vaccineRecordId: filter.vaccineRecordId }
        : {}),
      ...(filter.channel
        ? { channel: filter.channel as unknown as PrismaReminderChannel }
        : {}),
      ...(filter.milestone
        ? { milestone: filter.milestone as unknown as PrismaReminderMilestone }
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
      db.vaccineReminderLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dispatchedAt: "desc" },
      }),
      db.vaccineReminderLog.count({ where }),
    ]);

    return {
      items: records.map((record) => this.toDomain(record)),
      total,
    };
  }

  private toDomain(
    raw: Prisma.VaccineReminderLogGetPayload<Record<string, never>>
  ): VaccineReminderLogEntity {
    return VaccineReminderLogEntity.reconstitute({
      id: raw.id,
      farmId: raw.farmId,
      vaccineRecordId: raw.vaccineRecordId,
      animalId: raw.animalId,
      recipientUserId: raw.recipientUserId,
      recipientPhone: raw.recipientPhone,
      channel: raw.channel as unknown as ReminderChannel,
      milestone: raw.milestone as unknown as ReminderMilestone,
      status: raw.status as unknown as ReminderStatus,
      message: raw.message,
      errorMessage: raw.errorMessage,
      dispatchedDate: raw.dispatchedDate,
      dispatchedAt: raw.dispatchedAt,
    });
  }
}
