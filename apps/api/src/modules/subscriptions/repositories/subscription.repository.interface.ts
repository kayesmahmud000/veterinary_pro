import { SubscriptionEntity } from "../entities/subscription.entity";

export const SUBSCRIPTION_REPOSITORY = Symbol("SUBSCRIPTION_REPOSITORY");

export interface ISubscriptionRepository {
  findById(id: string): Promise<SubscriptionEntity | null>;
  findByFarmId(farmId: string): Promise<SubscriptionEntity | null>;
  findByUserId(userId: string): Promise<SubscriptionEntity[]>;
  findByGatewaySubId(gatewaySubId: string): Promise<SubscriptionEntity | null>;
  save(subscription: SubscriptionEntity): Promise<SubscriptionEntity>;
  findExpiredSubscriptions(now: Date): Promise<SubscriptionEntity[]>;
}
