import {
  SubscriptionBillingInterval,
  SubscriptionPlanChangeType,
  SubscriptionProrationBreakdownDto,
  SubscriptionTier,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import { SubscriptionPlanEntity } from "../entities/subscription-plan.entity";

export interface CalculateProrationParams {
  currentPlan: SubscriptionPlanEntity;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  currentInterval?: SubscriptionBillingInterval;
  isTrial?: boolean;
  targetPlan: SubscriptionPlanEntity;
  targetInterval: SubscriptionBillingInterval;
  effectiveDate?: Date;
}

const TIER_RANKS: Record<SubscriptionTier, number> = {
  [SubscriptionTier.STARTER]: 1,
  [SubscriptionTier.PRO]: 2,
  [SubscriptionTier.ENTERPRISE]: 3,
};

export class SubscriptionProrationCalculator {
  /**
   * Calculates prorated billing breakdown for an immediate subscription upgrade or downgrade.
   */
  public static calculate(
    params: CalculateProrationParams,
  ): SubscriptionProrationBreakdownDto {
    const {
      currentPlan,
      currentPeriodStart,
      currentPeriodEnd,
      targetPlan,
      targetInterval,
    } = params;

    if (!currentPlan) {
      throw new ValidationDomainException("Current subscription plan is required for proration calculation.");
    }
    if (!targetPlan) {
      throw new ValidationDomainException("Target subscription plan is required for proration calculation.");
    }
    if (currentPeriodEnd <= currentPeriodStart) {
      throw new ValidationDomainException("Current period end must be after current period start.");
    }

    const effectiveDate = params.effectiveDate ?? new Date();

    // 1. Determine current cycle interval
    const currentInterval =
      params.currentInterval ??
      this.inferBillingInterval(currentPeriodStart, currentPeriodEnd);

    // 2. Determine current cycle price in cents
    const isZeroCredit =
      params.isTrial === true ||
      currentPlan.tier === SubscriptionTier.STARTER;

    const currentPlanPriceCents = isZeroCredit
      ? 0
      : currentInterval === SubscriptionBillingInterval.ANNUAL
        ? currentPlan.priceAnnualCents
        : currentPlan.priceMonthlyCents;

    // 3. Determine target cycle price in cents
    const targetPlanPriceCents =
      targetInterval === SubscriptionBillingInterval.ANNUAL
        ? targetPlan.priceAnnualCents
        : targetPlan.priceMonthlyCents;

    // 4. Calculate timing & elapsed ratios (second precision)
    const totalPeriodSeconds = Math.max(
      1,
      Math.round((currentPeriodEnd.getTime() - currentPeriodStart.getTime()) / 1000),
    );

    const remainingSeconds = Math.max(
      0,
      Math.min(
        totalPeriodSeconds,
        Math.round((currentPeriodEnd.getTime() - effectiveDate.getTime()) / 1000),
      ),
    );

    const usedSeconds = Math.max(0, totalPeriodSeconds - remainingSeconds);
    const unusedRatio =
      totalPeriodSeconds > 0
        ? Number((remainingSeconds / totalPeriodSeconds).toFixed(6))
        : 0;

    // Human-readable day approximations
    const totalPeriodDays = Math.max(1, Math.ceil(totalPeriodSeconds / 86400));
    const usedDays = Math.max(0, Math.floor(usedSeconds / 86400));
    const remainingDays = Math.max(0, Math.ceil(remainingSeconds / 86400));

    // 5. Calculate unused credit
    const unusedCreditCents = isZeroCredit
      ? 0
      : Math.round(currentPlanPriceCents * unusedRatio);

    // 6. Net amount due vs credit balance
    let netAmountDueCents = 0;
    let creditBalanceCents = 0;

    if (targetPlanPriceCents >= unusedCreditCents) {
      netAmountDueCents = targetPlanPriceCents - unusedCreditCents;
      creditBalanceCents = 0;
    } else {
      netAmountDueCents = 0;
      creditBalanceCents = unusedCreditCents - targetPlanPriceCents;
    }

    // 7. Determine change type
    const changeType = this.determineChangeType(
      currentPlan.tier,
      targetPlan.tier,
      currentInterval,
      targetInterval,
    );

    return {
      currentPlanTier: currentPlan.tier,
      currentPlanName: currentPlan.name,
      currentInterval,
      currentPeriodStart: currentPeriodStart.toISOString(),
      currentPeriodEnd: currentPeriodEnd.toISOString(),
      targetPlanTier: targetPlan.tier,
      targetPlanName: targetPlan.name,
      targetInterval,
      changeType,
      effectiveDate: effectiveDate.toISOString(),
      totalPeriodDays,
      usedDays,
      remainingDays,
      unusedRatio,
      currentPlanPriceCents,
      unusedCreditCents,
      targetPlanPriceCents,
      netAmountDueCents,
      creditBalanceCents,
    };
  }

  /**
   * Infers billing interval based on duration between start and end dates.
   * If duration > 60 days, considered ANNUAL, otherwise MONTHLY.
   */
  public static inferBillingInterval(
    start: Date,
    end: Date,
  ): SubscriptionBillingInterval {
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > 60
      ? SubscriptionBillingInterval.ANNUAL
      : SubscriptionBillingInterval.MONTHLY;
  }

  /**
   * Computes the new period end date based on target interval starting from effectiveDate.
   */
  public static computeNewPeriodEnd(
    effectiveDate: Date,
    interval: SubscriptionBillingInterval,
  ): Date {
    const newEnd = new Date(effectiveDate);
    if (interval === SubscriptionBillingInterval.ANNUAL) {
      newEnd.setFullYear(newEnd.getFullYear() + 1);
    } else {
      newEnd.setDate(newEnd.getDate() + 30);
    }
    return newEnd;
  }

  private static determineChangeType(
    currentTier: SubscriptionTier,
    targetTier: SubscriptionTier,
    currentInterval: SubscriptionBillingInterval,
    targetInterval: SubscriptionBillingInterval,
  ): SubscriptionPlanChangeType {
    const currentRank = TIER_RANKS[currentTier] ?? 1;
    const targetRank = TIER_RANKS[targetTier] ?? 1;

    if (currentTier === targetTier) {
      if (currentInterval === targetInterval) {
        return SubscriptionPlanChangeType.NO_CHANGE;
      }
      return SubscriptionPlanChangeType.INTERVAL_CHANGE;
    }

    if (targetRank > currentRank) {
      return SubscriptionPlanChangeType.UPGRADE;
    }

    return SubscriptionPlanChangeType.DOWNGRADE;
  }
}
