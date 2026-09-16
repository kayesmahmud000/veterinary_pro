import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  ChangeSubscriptionPlanDto,
  PreviewSubscriptionPlanChangeDto,
  QuotaViolationDetailDto,
  SubscriptionBillingInterval,
  SubscriptionChangeResultDto,
  SubscriptionProrationPreviewDto,
  SubscriptionTier,
} from "@vetralink/shared-types";
import {
  EntityNotFoundException,
  QuotaExceededDomainException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../../audit/repositories/audit-log.repository.interface";
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from "../../prisma/interfaces/transaction.interface";
import { SubscriptionProrationCalculator } from "../domain/subscription-proration-calculator";
import { SubscriptionPlanEntity } from "../entities/subscription-plan.entity";
import { SubscriptionEntity } from "../entities/subscription.entity";
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
import { ISubscriptionPlanChangeService } from "./subscription-plan-change.service.interface";

@Injectable()
export class SubscriptionPlanChangeService
  implements ISubscriptionPlanChangeService
{
  private readonly logger = new Logger(SubscriptionPlanChangeService.name);

  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subRepo: ISubscriptionRepository,
    @Inject(SUBSCRIPTION_PLAN_REPOSITORY)
    private readonly planRepo: ISubscriptionPlanRepository,
    @Inject(SUBSCRIPTION_USAGE_REPOSITORY)
    private readonly usageRepo: ISubscriptionUsageRepository,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepo: IAuditLogRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactionManager: ITransactionManager,
  ) {}

  public async previewPlanChange(
    subscriptionId: string,
    dto: PreviewSubscriptionPlanChangeDto,
    _userId?: string,
  ): Promise<SubscriptionProrationPreviewDto> {
    const { subscription, currentPlan, targetPlan } =
      await this.resolveSubscriptionAndPlans(subscriptionId, dto);

    const billingInterval =
      dto.billingInterval ?? SubscriptionBillingInterval.MONTHLY;

    // Check quota violations if downgrading
    const quotaViolations = await this.checkDowngradeQuotas(
      subscription,
      currentPlan,
      targetPlan,
    );

    const now = new Date();
    const proration = SubscriptionProrationCalculator.calculate({
      currentPlan,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      isTrial: subscription.isInTrial(now),
      targetPlan,
      targetInterval: billingInterval,
      effectiveDate: now,
    });

    return {
      subscriptionId: subscription.id,
      farmId: subscription.farmId,
      proration,
      canProceed: quotaViolations.length === 0,
      quotaViolations,
    };
  }

  public async changePlan(
    subscriptionId: string,
    userId: string,
    dto: ChangeSubscriptionPlanDto,
  ): Promise<SubscriptionChangeResultDto> {
    const { subscription, currentPlan, targetPlan } =
      await this.resolveSubscriptionAndPlans(subscriptionId, dto);

    if (subscription.isCanceled()) {
      throw new ValidationDomainException(
        "Cannot change plan on a canceled or expired subscription. Create a new subscription instead.",
      );
    }

    // Check quota violations if downgrading
    const quotaViolations = await this.checkDowngradeQuotas(
      subscription,
      currentPlan,
      targetPlan,
    );

    if (quotaViolations.length > 0) {
      const first = quotaViolations[0]!;
      throw new QuotaExceededDomainException(first.message, {
        quotaType: first.resource as any,
        currentUsage: first.currentUsage,
        limit: first.targetLimit,
        planTier: targetPlan.tier,
        upgradeTier: null,
      });
    }

    const billingInterval =
      dto.billingInterval ?? SubscriptionBillingInterval.MONTHLY;
    const now = new Date();

    const proration = SubscriptionProrationCalculator.calculate({
      currentPlan,
      currentPeriodStart: subscription.currentPeriodStart,
      currentPeriodEnd: subscription.currentPeriodEnd,
      isTrial: subscription.isInTrial(now),
      targetPlan,
      targetInterval: billingInterval,
      effectiveDate: now,
    });

    const newPeriodEnd = SubscriptionProrationCalculator.computeNewPeriodEnd(
      now,
      billingInterval,
    );

    const traceId = crypto.randomUUID();
    const oldValues = {
      planId: subscription.planId,
      tier: currentPlan.tier,
      currentPeriodStart: subscription.currentPeriodStart.toISOString(),
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      status: subscription.status,
    };

    subscription.changePlan({
      newPlan: targetPlan,
      newPeriodEnd,
      now,
    });

    const newValues = {
      planId: targetPlan.id,
      tier: targetPlan.tier,
      currentPeriodStart: subscription.currentPeriodStart.toISOString(),
      currentPeriodEnd: subscription.currentPeriodEnd.toISOString(),
      status: subscription.status,
      billingInterval,
      proration,
    };

    // Atomically persist updated subscription and emit audit log
    const saved = await this.transactionManager.run(async (tx) => {
      const updatedSub = await this.subRepo.save(subscription, tx);

      await this.auditLogRepo.record(
        {
          userId,
          action: "SUBSCRIPTION_PLAN_CHANGE",
          entityType: "Subscription",
          entityId: updatedSub.id,
          oldValues,
          newValues,
          traceId,
        },
        tx,
      );

      return updatedSub;
    });

    this.logger.log(
      `[TraceId: ${traceId}] Subscription '${saved.id}' changed from '${currentPlan.tier}' to '${targetPlan.tier}' (${billingInterval}) by user '${userId}'. Net amount due: ${proration.netAmountDueCents} cents.`,
    );

    return {
      subscription: saved.toResponseDto(now),
      proration,
      transactionId: traceId,
    };
  }

  private async resolveSubscriptionAndPlans(
    subscriptionId: string,
    dto: { targetPlanId?: string; targetTier?: SubscriptionTier },
  ): Promise<{
    subscription: SubscriptionEntity;
    currentPlan: SubscriptionPlanEntity;
    targetPlan: SubscriptionPlanEntity;
  }> {
    const subscription = await this.subRepo.findById(subscriptionId);
    if (!subscription) {
      throw new EntityNotFoundException("Subscription", subscriptionId);
    }

    let currentPlan = subscription.plan;
    if (!currentPlan) {
      currentPlan = await this.planRepo.findById(subscription.planId);
      if (!currentPlan) {
        throw new EntityNotFoundException("SubscriptionPlan", subscription.planId);
      }
      subscription.attachPlan(currentPlan);
    }

    let targetPlan: SubscriptionPlanEntity | null = null;
    if (dto.targetPlanId) {
      targetPlan = await this.planRepo.findById(dto.targetPlanId);
    } else if (dto.targetTier) {
      targetPlan = await this.planRepo.findByTier(dto.targetTier);
    } else {
      throw new ValidationDomainException(
        "Either targetPlanId or targetTier must be specified to change plan.",
      );
    }

    if (!targetPlan) {
      throw new EntityNotFoundException(
        "SubscriptionPlan",
        dto.targetPlanId ?? dto.targetTier ?? "UNKNOWN",
      );
    }

    return { subscription, currentPlan, targetPlan };
  }

  private async checkDowngradeQuotas(
    subscription: SubscriptionEntity,
    currentPlan: SubscriptionPlanEntity,
    targetPlan: SubscriptionPlanEntity,
  ): Promise<QuotaViolationDetailDto[]> {
    const violations: QuotaViolationDetailDto[] = [];
    if (!subscription.farmId) {
      return violations;
    }

    const tierRank: Record<SubscriptionTier, number> = {
      [SubscriptionTier.STARTER]: 1,
      [SubscriptionTier.PRO]: 2,
      [SubscriptionTier.ENTERPRISE]: 3,
    };

    const isDowngrade = tierRank[targetPlan.tier] < tierRank[currentPlan.tier];
    if (!isDowngrade) {
      return violations;
    }

    // 1. Check animal count against targetPlan.maxAnimals
    if (targetPlan.maxAnimals !== -1) {
      const activeAnimals = await this.usageRepo.countActiveAnimals(
        subscription.farmId,
      );
      if (activeAnimals > targetPlan.maxAnimals) {
        violations.push({
          resource: "ANIMALS",
          currentUsage: activeAnimals,
          targetLimit: targetPlan.maxAnimals,
          message: `Cannot downgrade to ${targetPlan.name} plan: Farm has ${activeAnimals} active animals, but target plan allows at most ${targetPlan.maxAnimals}.`,
        });
      }
    }

    // 2. Check staff seats against targetPlan.features.maxStaff
    const targetMaxStaff =
      typeof targetPlan.features?.maxStaff === "number"
        ? targetPlan.features.maxStaff
        : targetPlan.tier === SubscriptionTier.PRO
          ? 3
          : 1;

    if (targetMaxStaff !== -1) {
      const farmMembers = await this.usageRepo.countFarmMembers(
        subscription.farmId,
      );
      if (farmMembers > targetMaxStaff) {
        violations.push({
          resource: "STAFF",
          currentUsage: farmMembers,
          targetLimit: targetMaxStaff,
          message: `Cannot downgrade to ${targetPlan.name} plan: Farm has ${farmMembers} staff members, but target plan allows at most ${targetMaxStaff}.`,
        });
      }
    }

    return violations;
  }
}
