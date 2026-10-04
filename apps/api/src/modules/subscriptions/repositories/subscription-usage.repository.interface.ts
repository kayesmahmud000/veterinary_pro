import { Prisma } from "@prisma/client";

export interface ISubscriptionUsageRepository {
  countActiveAnimals(
    farmId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number>;

  countFarmMembers(
    farmId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number>;
}

export const SUBSCRIPTION_USAGE_REPOSITORY = "SUBSCRIPTION_USAGE_REPOSITORY";
