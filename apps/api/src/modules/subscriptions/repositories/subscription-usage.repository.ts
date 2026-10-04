import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ISubscriptionUsageRepository } from "./subscription-usage.repository.interface";

@Injectable()
export class SubscriptionUsageRepository
  implements ISubscriptionUsageRepository
{
  private readonly logger = new Logger(SubscriptionUsageRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  public async countActiveAnimals(
    farmId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = tx ?? this.prisma;
    return client.animal.count({
      where: {
        farmId,
        deletedAt: null,
      },
    });
  }

  public async countFarmMembers(
    farmId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<number> {
    const client = tx ?? this.prisma;
    return client.farmMember.count({
      where: {
        farmId,
      },
    });
  }
}
