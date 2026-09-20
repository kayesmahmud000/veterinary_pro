import { Injectable } from "@nestjs/common";
import {
  DunningChannel,
  DunningStage,
  QueryDunningLogsDto,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { SubscriptionDunningLogEntity } from "../entities/subscription-dunning-log.entity";
import { ISubscriptionDunningLogRepository } from "./subscription-dunning-log.repository.interface";

@Injectable()
export class SubscriptionDunningLogRepository
  implements ISubscriptionDunningLogRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<SubscriptionDunningLogEntity | null> {
    const record = await this.prisma.subscriptionDunningLog.findUnique({
      where: { id },
    });
    if (!record) {
      return null;
    }
    return SubscriptionDunningLogEntity.fromPersistence(record);
  }

  async findBySubscriptionAndStage(
    subscriptionId: string,
    stage: DunningStage,
    channel: DunningChannel,
    dispatchedDate: string,
  ): Promise<SubscriptionDunningLogEntity | null> {
    const record = await this.prisma.subscriptionDunningLog.findUnique({
      where: {
        unique_subscription_dunning_daily: {
          subscriptionId,
          stage,
          channel,
          dispatchedDate,
        },
      },
    });
    if (!record) {
      return null;
    }
    return SubscriptionDunningLogEntity.fromPersistence(record);
  }

  async findLatestBySubscription(
    subscriptionId: string,
  ): Promise<SubscriptionDunningLogEntity[]> {
    const records = await this.prisma.subscriptionDunningLog.findMany({
      where: { subscriptionId },
      orderBy: { dispatchedAt: "desc" },
    });
    return records.map((r) => SubscriptionDunningLogEntity.fromPersistence(r));
  }

  async findMany(
    query: QueryDunningLogsDto,
  ): Promise<{ items: SubscriptionDunningLogEntity[]; total: number }> {
    const {
      subscriptionId,
      userId,
      farmId,
      stage,
      channel,
      status,
      startDate,
      endDate,
      page = 1,
      limit = 20,
    } = query;

    const where: any = {};
    if (subscriptionId) where.subscriptionId = subscriptionId;
    if (userId) where.userId = userId;
    if (farmId) where.farmId = farmId;
    if (stage) where.stage = stage;
    if (channel) where.channel = channel;
    if (status) where.status = status;

    if (startDate || endDate) {
      where.dispatchedAt = {};
      if (startDate) where.dispatchedAt.gte = new Date(startDate);
      if (endDate) where.dispatchedAt.lte = new Date(endDate);
    }

    const [records, total] = await Promise.all([
      this.prisma.subscriptionDunningLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { dispatchedAt: "desc" },
      }),
      this.prisma.subscriptionDunningLog.count({ where }),
    ]);

    return {
      items: records.map((r) => SubscriptionDunningLogEntity.fromPersistence(r)),
      total,
    };
  }

  async save(
    entity: SubscriptionDunningLogEntity,
    tx?: import("@prisma/client").Prisma.TransactionClient,
  ): Promise<SubscriptionDunningLogEntity> {
    const client = tx ?? this.prisma;
    const record = await client.subscriptionDunningLog.upsert({
      where: { id: entity.id },
      create: {
        id: entity.id,
        subscriptionId: entity.subscriptionId,
        userId: entity.userId,
        farmId: entity.farmId,
        stage: entity.stage,
        channel: entity.channel,
        status: entity.status,
        recipientEmail: entity.recipientEmail,
        subject: entity.subject,
        message: entity.message,
        errorMessage: entity.errorMessage,
        attemptCount: entity.attemptCount,
        gatewayInvoiceId: entity.gatewayInvoiceId,
        dispatchedDate: entity.dispatchedDate,
        dispatchedAt: entity.dispatchedAt,
      },
      update: {
        status: entity.status,
        errorMessage: entity.errorMessage,
        attemptCount: entity.attemptCount,
        subject: entity.subject,
        message: entity.message,
      },
    });

    return SubscriptionDunningLogEntity.fromPersistence(record);
  }
}
