import { Inject, Injectable, Logger } from "@nestjs/common";
import { SubscriptionTier } from "@vetralink/shared-types";
import { EntityNotFoundException } from "../../../common/exceptions/domain.exception";
import {
  CancelSubscriptionDto,
  CreateTrialSubscriptionDto,
  SubscriptionResponseDto,
} from "../dto";
import { SubscriptionEntity } from "../entities/subscription.entity";
import {
  ISubscriptionPlanRepository,
  SUBSCRIPTION_PLAN_REPOSITORY,
} from "../repositories/subscription-plan.repository.interface";
import {
  ISubscriptionRepository,
  SUBSCRIPTION_REPOSITORY,
} from "../repositories/subscription.repository.interface";
import { ISubscriptionLifecycleService } from "./subscription-lifecycle.service.interface";

@Injectable()
export class SubscriptionLifecycleService
  implements ISubscriptionLifecycleService
{
  private readonly logger = new Logger(SubscriptionLifecycleService.name);

  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subRepo: ISubscriptionRepository,
    @Inject(SUBSCRIPTION_PLAN_REPOSITORY)
    private readonly planRepo: ISubscriptionPlanRepository,
  ) {}

  async createTrialSubscription(
    userId: string,
    dto: CreateTrialSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    const tier = dto.planTier ?? SubscriptionTier.PRO;
    const plan = await this.planRepo.findByTier(tier);
    if (!plan) {
      throw new EntityNotFoundException("SubscriptionPlan", tier);
    }

    if (dto.farmId) {
      const existing = await this.subRepo.findByFarmId(dto.farmId);
      if (existing && existing.canAccessService()) {
        this.logger.log(
          `Farm '${dto.farmId}' already has active subscription '${existing.id}'. Returning existing.`,
        );
        if (!existing.plan) {
          existing.attachPlan(plan);
        }
        return existing.toResponseDto();
      }
    }

    const trialDays = dto.trialDays ?? 14;
    const subscription = SubscriptionEntity.createTrial({
      userId,
      farmId: dto.farmId,
      planId: plan.id,
      plan,
      trialDays,
    });

    const saved = await this.subRepo.save(subscription);
    this.logger.log(
      `Created ${trialDays}-day trial subscription '${saved.id}' for user '${userId}' [tier: ${tier}].`,
    );

    return saved.toResponseDto();
  }

  async getFarmSubscription(farmId: string): Promise<SubscriptionResponseDto> {
    const subscription = await this.subRepo.findByFarmId(farmId);
    if (!subscription) {
      throw new EntityNotFoundException("Subscription", farmId);
    }

    if (!subscription.plan) {
      const plan = await this.planRepo.findById(subscription.planId);
      if (plan) {
        subscription.attachPlan(plan);
      }
    }

    return subscription.toResponseDto();
  }

  async getUserSubscription(
    userId: string,
    farmId?: string,
  ): Promise<SubscriptionResponseDto> {
    if (farmId) {
      const farmSub = await this.subRepo.findByFarmId(farmId);
      if (farmSub) {
        if (!farmSub.plan) {
          const plan = await this.planRepo.findById(farmSub.planId);
          if (plan) {
            farmSub.attachPlan(plan);
          }
        }
        return farmSub.toResponseDto();
      }
    }

    const userSubs = await this.subRepo.findByUserId(userId);
    if (userSubs.length === 0) {
      throw new EntityNotFoundException("Subscription", userId);
    }

    const activeSub = userSubs.find((s) => s.isActive()) ?? userSubs[0]!;
    if (!activeSub.plan) {
      const plan = await this.planRepo.findById(activeSub.planId);
      if (plan) {
        activeSub.attachPlan(plan);
      }
    }

    return activeSub.toResponseDto();
  }

  async activateSubscription(
    id: string,
    params?: { periodEnd?: Date; gatewaySubId?: string },
  ): Promise<SubscriptionResponseDto> {
    const subscription = await this.subRepo.findById(id);
    if (!subscription) {
      throw new EntityNotFoundException("Subscription", id);
    }

    subscription.activate({
      periodEnd: params?.periodEnd,
      gatewaySubId: params?.gatewaySubId,
    });

    const updated = await this.subRepo.save(subscription);
    this.logger.log(`Activated subscription '${updated.id}'.`);

    return updated.toResponseDto();
  }

  async markSubscriptionPastDue(id: string): Promise<SubscriptionResponseDto> {
    const subscription = await this.subRepo.findById(id);
    if (!subscription) {
      throw new EntityNotFoundException("Subscription", id);
    }

    subscription.markPastDue();
    const updated = await this.subRepo.save(subscription);
    this.logger.warn(`Subscription '${updated.id}' marked PAST_DUE.`);

    return updated.toResponseDto();
  }

  async cancelSubscription(
    id: string,
    dto?: CancelSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    const subscription = await this.subRepo.findById(id);
    if (!subscription) {
      throw new EntityNotFoundException("Subscription", id);
    }

    const immediate = dto?.immediate ?? false;
    subscription.requestCancellation({ immediate });

    const updated = await this.subRepo.save(subscription);
    this.logger.log(
      `Subscription '${updated.id}' requested cancellation (immediate: ${immediate}).`,
    );

    return updated.toResponseDto();
  }

  async reactivateSubscription(id: string): Promise<SubscriptionResponseDto> {
    const subscription = await this.subRepo.findById(id);
    if (!subscription) {
      throw new EntityNotFoundException("Subscription", id);
    }

    subscription.revokeCancellation();
    const updated = await this.subRepo.save(subscription);
    this.logger.log(`Subscription '${updated.id}' cancellation revoked.`);

    return updated.toResponseDto();
  }

  async processExpiredSubscriptions(): Promise<{ processedCount: number }> {
    const expired = await this.subRepo.findExpiredSubscriptions(new Date());

    let count = 0;
    for (const sub of expired) {
      sub.expire();
      await this.subRepo.save(sub);
      count++;
    }

    if (count > 0) {
      this.logger.log(`Processed and expired ${count} overdue subscriptions.`);
    }

    return { processedCount: count };
  }
}
