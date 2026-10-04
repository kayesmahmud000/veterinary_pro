import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { DefaultSubscriptionPlanConfig, SubscriptionTier } from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { SubscriptionPlanEntity } from "../entities/subscription-plan.entity";
import { ISubscriptionPlanRepository } from "./subscription-plan.repository.interface";

@Injectable()
export class SubscriptionPlanRepository implements ISubscriptionPlanRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(includeInactive: boolean = false): Promise<SubscriptionPlanEntity[]> {
    const where = includeInactive ? {} : { isActive: true };
    const records = await this.prisma.subscriptionPlan.findMany({
      where,
      orderBy: { priceMonthlyCents: "asc" },
    });
    return records.map((record) => SubscriptionPlanEntity.fromPersistence(record));
  }

  async findById(id: string): Promise<SubscriptionPlanEntity | null> {
    const record = await this.prisma.subscriptionPlan.findUnique({
      where: { id },
    });
    if (!record) {
      return null;
    }
    return SubscriptionPlanEntity.fromPersistence(record);
  }

  async findByTier(tier: SubscriptionTier): Promise<SubscriptionPlanEntity | null> {
    const record = await this.prisma.subscriptionPlan.findUnique({
      where: { tier },
    });
    if (!record) {
      return null;
    }
    return SubscriptionPlanEntity.fromPersistence(record);
  }

  async save(plan: SubscriptionPlanEntity): Promise<SubscriptionPlanEntity> {
    const record = await this.prisma.subscriptionPlan.upsert({
      where: { id: plan.id },
      create: {
        id: plan.id,
        name: plan.name,
        tier: plan.tier,
        priceMonthlyCents: plan.priceMonthlyCents,
        priceAnnualCents: plan.priceAnnualCents,
        maxAnimals: plan.maxAnimals,
        features: plan.features as unknown as Prisma.InputJsonValue,
        isActive: plan.isActive,
        createdAt: plan.createdAt,
      },
      update: {
        name: plan.name,
        priceMonthlyCents: plan.priceMonthlyCents,
        priceAnnualCents: plan.priceAnnualCents,
        maxAnimals: plan.maxAnimals,
        features: plan.features as unknown as Prisma.InputJsonValue,
        isActive: plan.isActive,
      },
    });

    return SubscriptionPlanEntity.fromPersistence(record);
  }

  async upsertDefaultPlans(
    defaultPlans: readonly DefaultSubscriptionPlanConfig[],
  ): Promise<SubscriptionPlanEntity[]> {
    return this.prisma.$transaction(async (tx) => {
      const results: SubscriptionPlanEntity[] = [];

      for (const config of defaultPlans) {
        const existing = await tx.subscriptionPlan.findUnique({
          where: { tier: config.tier },
        });

        const record = existing
          ? await tx.subscriptionPlan.update({
              where: { tier: config.tier },
              data: {
                name: config.name,
                priceMonthlyCents: config.priceMonthlyCents,
                priceAnnualCents: config.priceAnnualCents,
                maxAnimals: config.maxAnimals,
                features: config.features as unknown as Prisma.InputJsonValue,
                isActive: config.isActive,
              },
            })
          : await tx.subscriptionPlan.create({
              data: {
                name: config.name,
                tier: config.tier,
                priceMonthlyCents: config.priceMonthlyCents,
                priceAnnualCents: config.priceAnnualCents,
                maxAnimals: config.maxAnimals,
                features: config.features as unknown as Prisma.InputJsonValue,
                isActive: config.isActive,
              },
            });

        results.push(SubscriptionPlanEntity.fromPersistence(record));
      }

      return results;
    });
  }
}
