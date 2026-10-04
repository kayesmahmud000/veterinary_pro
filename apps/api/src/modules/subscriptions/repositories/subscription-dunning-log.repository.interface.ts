import {
  DunningChannel,
  DunningStage,
  QueryDunningLogsDto,
} from "@vetralink/shared-types";
import { SubscriptionDunningLogEntity } from "../entities/subscription-dunning-log.entity";

export const SUBSCRIPTION_DUNNING_LOG_REPOSITORY = Symbol(
  "SUBSCRIPTION_DUNNING_LOG_REPOSITORY",
);

export interface ISubscriptionDunningLogRepository {
  findById(id: string): Promise<SubscriptionDunningLogEntity | null>;
  findBySubscriptionAndStage(
    subscriptionId: string,
    stage: DunningStage,
    channel: DunningChannel,
    dispatchedDate: string,
  ): Promise<SubscriptionDunningLogEntity | null>;
  findLatestBySubscription(
    subscriptionId: string,
  ): Promise<SubscriptionDunningLogEntity[]>;
  findMany(
    query: QueryDunningLogsDto,
  ): Promise<{ items: SubscriptionDunningLogEntity[]; total: number }>;
  save(
    entity: SubscriptionDunningLogEntity,
    tx?: import("@prisma/client").Prisma.TransactionClient,
  ): Promise<SubscriptionDunningLogEntity>;
}
