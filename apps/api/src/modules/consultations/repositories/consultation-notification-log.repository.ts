import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { QueryVetNotificationsDto } from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { ConsultationNotificationLogEntity } from "../entities/consultation-notification-log.entity";
import { IConsultationNotificationLogRepository } from "./consultation-notification-log.repository.interface";

@Injectable()
export class ConsultationNotificationLogRepository
  implements IConsultationNotificationLogRepository
{
  constructor(private readonly prisma: PrismaService) {}

  public async create(
    entity: ConsultationNotificationLogEntity,
  ): Promise<ConsultationNotificationLogEntity> {
    const record = await this.prisma.consultationNotificationLog.create({
      data: {
        id: entity.id,
        consultationId: entity.consultationId,
        vetId: entity.vetId,
        channel: entity.channel,
        status: entity.status,
        title: entity.title,
        message: entity.message,
        errorMessage: entity.errorMessage,
        metadata: entity.metadata as unknown as Prisma.InputJsonValue,
        readAt: entity.readAt,
        dispatchedAt: entity.dispatchedAt,
      },
    });

    return ConsultationNotificationLogEntity.fromPersistence(record);
  }

  public async findById(
    id: string,
  ): Promise<ConsultationNotificationLogEntity | null> {
    const record = await this.prisma.consultationNotificationLog.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return ConsultationNotificationLogEntity.fromPersistence(record);
  }

  public async save(
    entity: ConsultationNotificationLogEntity,
  ): Promise<ConsultationNotificationLogEntity> {
    const record = await this.prisma.consultationNotificationLog.update({
      where: { id: entity.id },
      data: {
        status: entity.status,
        errorMessage: entity.errorMessage,
        readAt: entity.readAt,
      },
    });

    return ConsultationNotificationLogEntity.fromPersistence(record);
  }

  public async findByVet(
    vetId: string,
    query: QueryVetNotificationsDto,
  ): Promise<{
    items: ConsultationNotificationLogEntity[];
    total: number;
    unreadCount: number;
  }> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Prisma.ConsultationNotificationLogWhereInput = {
      vetId,
      ...(query.channel ? { channel: query.channel } : {}),
      ...(query.unreadOnly ? { readAt: null } : {}),
    };

    const [records, total, unreadCount] = await Promise.all([
      this.prisma.consultationNotificationLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { dispatchedAt: "desc" },
      }),
      this.prisma.consultationNotificationLog.count({ where }),
      this.prisma.consultationNotificationLog.count({
        where: { vetId, readAt: null },
      }),
    ]);

    return {
      items: records.map((r) =>
        ConsultationNotificationLogEntity.fromPersistence(r),
      ),
      total,
      unreadCount,
    };
  }

  public async findByConsultation(
    consultationId: string,
  ): Promise<ConsultationNotificationLogEntity[]> {
    const records = await this.prisma.consultationNotificationLog.findMany({
      where: { consultationId },
      orderBy: { dispatchedAt: "asc" },
    });

    return records.map((r) =>
      ConsultationNotificationLogEntity.fromPersistence(r),
    );
  }
}
