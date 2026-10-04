import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  DEFAULT_SUBSCRIPTION_PLANS,
  FarmQuotaSummaryDto,
  isUnlimitedQuota,
  SubscriptionQuotaType,
  SubscriptionQuotaUsageDto,
  SubscriptionTier,
} from "@vetralink/shared-types";
import { QuotaExceededDomainException } from "../../../common/exceptions/domain.exception";
import { SubscriptionPlanEntity } from "../entities/subscription-plan.entity";
import {
  ISubscriptionPlanRepository,
  SUBSCRIPTION_PLAN_REPOSITORY,
} from "../repositories/subscription-plan.repository.interface";
import {
  ISubscriptionRepository,
  SUBSCRIPTION_REPOSITORY,
} from "../repositories/subscription.repository.interface";
import {
  ISubscriptionUsageRepository,
  SUBSCRIPTION_USAGE_REPOSITORY,
} from "../repositories/subscription-usage.repository.interface";
import {
  ISubscriptionQuotaService,
  SubscriptionQuotaCheckResult,
} from "./subscription-quota.service.interface";

@Injectable()
export class SubscriptionQuotaService implements ISubscriptionQuotaService {
  private readonly logger = new Logger(SubscriptionQuotaService.name);

  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subRepo: ISubscriptionRepository,
    @Inject(SUBSCRIPTION_PLAN_REPOSITORY)
    private readonly planRepo: ISubscriptionPlanRepository,
    @Inject(SUBSCRIPTION_USAGE_REPOSITORY)
    private readonly usageRepo: ISubscriptionUsageRepository,
  ) {}

  public async checkQuota(
    farmId: string,
    quotaType: SubscriptionQuotaType,
    increment = 1,
  ): Promise<SubscriptionQuotaCheckResult> {
    const { plan, isServiceAccessible } = await this.resolveFarmPlan(farmId);
    const limit = this.getPlanLimit(plan, quotaType);
    const currentUsage = await this.getCurrentUsage(farmId, quotaType);
    const unlimited = isUnlimitedQuota(limit);
    const remaining = unlimited ? -1 : Math.max(0, limit - currentUsage);

    const allowed =
      isServiceAccessible && (unlimited || currentUsage + increment <= limit);
    const upgradeTier = this.getRecommendedUpgrade(plan.tier);

    return {
      allowed,
      quotaType,
      currentUsage,
      limit,
      remaining,
      planTier: plan.tier,
      upgradeTier,
    };
  }

  public async assertQuotaAvailable(
    farmId: string,
    quotaType: SubscriptionQuotaType,
    increment = 1,
  ): Promise<SubscriptionQuotaCheckResult> {
    const result = await this.checkQuota(farmId, quotaType, increment);

    if (!result.allowed) {
      const upgradeMsg = result.upgradeTier
        ? ` Please upgrade to ${result.upgradeTier} tier.`
        : "";

      this.logger.warn(
        `Quota exceeded for farm '${farmId}' on [${result.quotaType}]: current ${result.currentUsage} + inc ${increment} > limit ${result.limit} (${result.planTier}).`,
      );

      throw new QuotaExceededDomainException(
        `Subscription quota exceeded: Your ${result.planTier} plan allows a maximum of ${result.limit} ${result.quotaType.toLowerCase()} (current: ${result.currentUsage}).${upgradeMsg}`,
        {
          quotaType: result.quotaType,
          currentUsage: result.currentUsage,
          limit: result.limit,
          planTier: result.planTier,
          upgradeTier: result.upgradeTier,
        },
      );
    }

    return result;
  }

  public async getFarmQuotaUsage(
    farmId: string,
  ): Promise<FarmQuotaSummaryDto> {
    const { plan, isServiceAccessible } = await this.resolveFarmPlan(farmId);

    const animalsLimit = this.getPlanLimit(plan, SubscriptionQuotaType.ANIMALS);
    const animalsUsage = await this.getCurrentUsage(
      farmId,
      SubscriptionQuotaType.ANIMALS,
    );
    const animalsUnlimited = isUnlimitedQuota(animalsLimit);

    const staffLimit = this.getPlanLimit(plan, SubscriptionQuotaType.STAFF);
    const staffUsage = await this.getCurrentUsage(
      farmId,
      SubscriptionQuotaType.STAFF,
    );
    const staffUnlimited = isUnlimitedQuota(staffLimit);

    const animalsQuota: SubscriptionQuotaUsageDto = {
      quotaType: SubscriptionQuotaType.ANIMALS,
      currentUsage: animalsUsage,
      limit: animalsLimit,
      remaining: animalsUnlimited
        ? -1
        : Math.max(0, animalsLimit - animalsUsage),
      isUnlimited: animalsUnlimited,
      canAccommodate:
        isServiceAccessible && (animalsUnlimited || animalsUsage + 1 <= animalsLimit),
      planTier: plan.tier,
      upgradeTier: this.getRecommendedUpgrade(plan.tier),
    };

    const staffQuota: SubscriptionQuotaUsageDto = {
      quotaType: SubscriptionQuotaType.STAFF,
      currentUsage: staffUsage,
      limit: staffLimit,
      remaining: staffUnlimited ? -1 : Math.max(0, staffLimit - staffUsage),
      isUnlimited: staffUnlimited,
      canAccommodate:
        isServiceAccessible && (staffUnlimited || staffUsage + 1 <= staffLimit),
      planTier: plan.tier,
      upgradeTier: this.getRecommendedUpgrade(plan.tier),
    };

    return {
      farmId,
      planTier: plan.tier,
      planName: plan.name,
      isSubscriptionActive: isServiceAccessible,
      quotas: {
        animals: animalsQuota,
        staff: staffQuota,
      },
      features: {
        maxAnimals: animalsLimit,
        maxStaff: staffLimit,
        bulkImportExport: Boolean(plan.features.bulkImportExport),
        advancedAnalytics: Boolean(plan.features.advancedAnalytics),
        customReports: Boolean(plan.features.customReports),
        teleVetPriority: plan.features.teleVetPriority ?? "STANDARD",
      },
    };
  }

  private async resolveFarmPlan(farmId: string): Promise<{
    plan: SubscriptionPlanEntity;
    isServiceAccessible: boolean;
  }> {
    const subscription = await this.subRepo.findByFarmId(farmId);

    if (subscription) {
      const isServiceAccessible = subscription.canAccessService();

      if (subscription.plan) {
        return { plan: subscription.plan, isServiceAccessible };
      }

      const planFromDb = await this.planRepo.findById(subscription.planId);
      if (planFromDb) {
        subscription.attachPlan(planFromDb);
        return { plan: planFromDb, isServiceAccessible };
      }
    }

    // Default to STARTER plan if no subscription record exists for tenant farm
    const starterPlan = await this.planRepo.findByTier(SubscriptionTier.STARTER);
    if (starterPlan) {
      return { plan: starterPlan, isServiceAccessible: true };
    }

    const defaultStarter = SubscriptionPlanEntity.create(
      DEFAULT_SUBSCRIPTION_PLANS[0]!,
    );
    return { plan: defaultStarter, isServiceAccessible: true };
  }

  private getPlanLimit(
    plan: SubscriptionPlanEntity,
    quotaType: SubscriptionQuotaType,
  ): number {
    if (quotaType === SubscriptionQuotaType.ANIMALS) {
      return plan.maxAnimals;
    }

    if (quotaType === SubscriptionQuotaType.STAFF) {
      if (typeof plan.features?.maxStaff === "number") {
        return plan.features.maxStaff;
      }
      return plan.tier === SubscriptionTier.ENTERPRISE
        ? -1
        : plan.tier === SubscriptionTier.PRO
          ? 3
          : 1;
    }

    return 0;
  }

  private async getCurrentUsage(
    farmId: string,
    quotaType: SubscriptionQuotaType,
  ): Promise<number> {
    if (quotaType === SubscriptionQuotaType.ANIMALS) {
      return this.usageRepo.countActiveAnimals(farmId);
    }
    if (quotaType === SubscriptionQuotaType.STAFF) {
      return this.usageRepo.countFarmMembers(farmId);
    }
    return 0;
  }

  private getRecommendedUpgrade(tier: SubscriptionTier): SubscriptionTier | null {
    if (tier === SubscriptionTier.STARTER) {
      return SubscriptionTier.PRO;
    }
    if (tier === SubscriptionTier.PRO) {
      return SubscriptionTier.ENTERPRISE;
    }
    return null;
  }
}
