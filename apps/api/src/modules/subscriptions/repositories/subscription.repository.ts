import { Injectable } from "@nestjs/common";
import { SubscriptionStatus } from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { SubscriptionEntity } from "../entities/subscription.entity";
import { ISubscriptionRepository } from "./subscription.repository.interface";

@Injectable()
export class SubscriptionRepository implements ISubscriptionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<SubscriptionEntity | null> {
    const record = await this.prisma.subscription.findUnique({
      where: { id },
      include: { plan: true },
    });
    if (!record) {
      return null;
    }
    return SubscriptionEntity.fromPersistence(record);
  }

  async findByFarmId(farmId: string): Promise<SubscriptionEntity | null> {
    const record = await this.prisma.subscription.findFirst({
      where: { farmId },
      include: { plan: true },
      orderBy: { updatedAt: "desc" },
    });
    if (!record) {
      return null;
    }
    return SubscriptionEntity.fromPersistence(record);
  }

  async findByUserId(userId: string): Promise<SubscriptionEntity[]> {
    const records = await this.prisma.subscription.findMany({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });
    return records.map((r) => SubscriptionEntity.fromPersistence(r));
  }

  async findByGatewaySubId(gatewaySubId: string): Promise<SubscriptionEntity | null> {
    const record = await this.prisma.subscription.findUnique({
      where: { gatewaySubId },
      include: { plan: true },
    });
    if (!record) {
      return null;
    }
    return SubscriptionEntity.fromPersistence(record);
  }

  async save(subscription: SubscriptionEntity): Promise<SubscriptionEntity> {
    const record = await this.prisma.subscription.upsert({
      where: { id: subscription.id },
      create: {
        id: subscription.id,
        userId: subscription.userId,
        farmId: subscription.farmId,
        planId: subscription.planId,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        gatewaySubId: subscription.gatewaySubId,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
      },
      update: {
        farmId: subscription.farmId,
        planId: subscription.planId,
        status: subscription.status,
        currentPeriodStart: subscription.currentPeriodStart,
        currentPeriodEnd: subscription.currentPeriodEnd,
        gatewaySubId: subscription.gatewaySubId,
        cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
        updatedAt: subscription.updatedAt,
      },
      include: { plan: true },
    });

    return SubscriptionEntity.fromPersistence(record);
  }

  async findExpiredSubscriptions(now: Date): Promise<SubscriptionEntity[]> {
    const records = await this.prisma.subscription.findMany({
      where: {
        status: {
          in: [
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.TRIALING,
            SubscriptionStatus.PAST_DUE,
          ],
        },
        currentPeriodEnd: { lte: now },
      },
      include: { plan: true },
      take: 100,
    });

    return records.map((r) => SubscriptionEntity.fromPersistence(r));
  }
}
