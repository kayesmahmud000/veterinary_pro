import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  DunningExposureDto,
  MonthlyTrendPointDto,
  QuerySaasMetricsDto,
  SaasMetricsSummaryDto,
  SaasMetricsTrendDto,
  SubscriptionBillingInterval,
  SubscriptionStatus,
  SubscriptionStatusBreakdownDto,
  SubscriptionTier,
  SubscriptionTierBreakdownDto,
} from "@vetralink/shared-types";
import { SubscriptionProrationCalculator } from "../domain/subscription-proration-calculator";
import { SubscriptionEntity } from "../entities/subscription.entity";
import {
  ISubscriptionRepository,
  SUBSCRIPTION_REPOSITORY,
} from "../repositories/subscription.repository.interface";
import { ISubscriptionMetricsService } from "./subscription-metrics.service.interface";

const TIER_NAMES: Record<SubscriptionTier, string> = {
  [SubscriptionTier.STARTER]: "Starter",
  [SubscriptionTier.PRO]: "Pro Farmer",
  [SubscriptionTier.ENTERPRISE]: "Enterprise",
};

@Injectable()
export class SubscriptionMetricsService implements ISubscriptionMetricsService {
  private readonly logger = new Logger(SubscriptionMetricsService.name);

  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subscriptionRepo: ISubscriptionRepository,
  ) {}

  public async getSummary(asOfDate?: Date): Promise<SaasMetricsSummaryDto> {
    const targetDate = asOfDate ?? new Date();
    this.logger.log(`Aggregating SaaS metrics summary as of ${targetDate.toISOString()}`);

    const allSubscriptions = await this.subscriptionRepo.findAllWithPlan(targetDate);

    let mrrCents = 0;
    let atRiskMrrCents = 0;
    let activePayingCount = 0;
    let gracePeriodCount = 0;
    let readOnlyCount = 0;
    let suspendedCount = 0;

    const statusCounts: Record<SubscriptionStatus, number> = {
      [SubscriptionStatus.ACTIVE]: 0,
      [SubscriptionStatus.TRIALING]: 0,
      [SubscriptionStatus.PAST_DUE]: 0,
      [SubscriptionStatus.CANCELED]: 0,
      [SubscriptionStatus.EXPIRED]: 0,
    };

    const tierMetrics: Record<
      SubscriptionTier,
      { count: number; activePayingCount: number; mrrCents: number }
    > = {
      [SubscriptionTier.STARTER]: { count: 0, activePayingCount: 0, mrrCents: 0 },
      [SubscriptionTier.PRO]: { count: 0, activePayingCount: 0, mrrCents: 0 },
      [SubscriptionTier.ENTERPRISE]: { count: 0, activePayingCount: 0, mrrCents: 0 },
    };

    for (const sub of allSubscriptions) {
      statusCounts[sub.status] = (statusCounts[sub.status] ?? 0) + 1;

      const tier = sub.plan?.tier;
      if (tier && tierMetrics[tier]) {
        tierMetrics[tier].count++;
      }

      if (sub.status === SubscriptionStatus.ACTIVE) {
        const subMrr = this.computeSubscriptionMrr(sub);
        mrrCents += subMrr;
        activePayingCount++;

        if (tier && tierMetrics[tier]) {
          tierMetrics[tier].activePayingCount++;
          tierMetrics[tier].mrrCents += subMrr;
        }
      } else if (sub.status === SubscriptionStatus.PAST_DUE) {
        const subMrr = this.computeSubscriptionMrr(sub);
        atRiskMrrCents += subMrr;

        const diffMs = targetDate.getTime() - sub.currentPeriodEnd.getTime();
        const daysPastDue = Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));

        if (daysPastDue <= 3) {
          gracePeriodCount++;
        } else if (daysPastDue <= 7) {
          readOnlyCount++;
        } else {
          suspendedCount++;
        }
      }
    }

    const arrCents = mrrCents * 12;
    const arpuCents =
      activePayingCount > 0 ? Math.round(mrrCents / activePayingCount) : 0;

    // Churn over 30-day window
    const thirtyDaysAgo = new Date(targetDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    const churnedSubs = allSubscriptions.filter(
      (s) =>
        (s.status === SubscriptionStatus.CANCELED ||
          s.status === SubscriptionStatus.EXPIRED) &&
        s.updatedAt >= thirtyDaysAgo,
    );

    const churnedCount = churnedSubs.length;
    let churnedMrrCents = 0;
    for (const sub of churnedSubs) {
      churnedMrrCents += this.computeSubscriptionMrr(sub);
    }

    const activeAtStart = activePayingCount + churnedCount;
    const customerChurnRatePercent =
      activeAtStart > 0
        ? Math.round((churnedCount / activeAtStart) * 10000) / 100
        : 0;

    const startingMrr = mrrCents + churnedMrrCents;
    const revenueChurnRatePercent =
      startingMrr > 0
        ? Math.round((churnedMrrCents / startingMrr) * 10000) / 100
        : 0;

    // LTV = ARPU / Churn Rate (or 24-month horizon when churn is 0)
    const ltvCents =
      customerChurnRatePercent > 0
        ? Math.round(arpuCents / (customerChurnRatePercent / 100))
        : Math.round(arpuCents * 24);

    const tierBreakdown: SubscriptionTierBreakdownDto[] = (
      [
        SubscriptionTier.STARTER,
        SubscriptionTier.PRO,
        SubscriptionTier.ENTERPRISE,
      ] as const
    ).map((tier) => {
      const data = tierMetrics[tier];
      return {
        tier,
        tierName: TIER_NAMES[tier],
        count: data.count,
        activePayingCount: data.activePayingCount,
        mrrCents: data.mrrCents,
        percentageOfMrr:
          mrrCents > 0
            ? Math.round((data.mrrCents / mrrCents) * 10000) / 100
            : 0,
      };
    });

    const totalCount = allSubscriptions.length;
    const statusBreakdown: SubscriptionStatusBreakdownDto[] = (
      [
        SubscriptionStatus.ACTIVE,
        SubscriptionStatus.TRIALING,
        SubscriptionStatus.PAST_DUE,
        SubscriptionStatus.CANCELED,
        SubscriptionStatus.EXPIRED,
      ] as const
    ).map((status) => ({
      status,
      count: statusCounts[status] ?? 0,
      percentageOfTotal:
        totalCount > 0
          ? Math.round(((statusCounts[status] ?? 0) / totalCount) * 10000) / 100
          : 0,
    }));

    const dunningExposure: DunningExposureDto = {
      totalPastDueCount: statusCounts[SubscriptionStatus.PAST_DUE] ?? 0,
      atRiskMrrCents,
      gracePeriodCount,
      readOnlyCount,
      suspendedCount,
    };

    return {
      asOfDate: targetDate.toISOString(),
      mrrCents,
      arrCents,
      arpuCents,
      ltvCents,
      activeSubscriptionsCount: statusCounts[SubscriptionStatus.ACTIVE] ?? 0,
      activePayingSubscriptionsCount: activePayingCount,
      trialingSubscriptionsCount: statusCounts[SubscriptionStatus.TRIALING] ?? 0,
      pastDueSubscriptionsCount: statusCounts[SubscriptionStatus.PAST_DUE] ?? 0,
      canceledSubscriptionsCount: statusCounts[SubscriptionStatus.CANCELED] ?? 0,
      expiredSubscriptionsCount: statusCounts[SubscriptionStatus.EXPIRED] ?? 0,
      totalSubscriptionsCount: totalCount,
      customerChurnRatePercent,
      revenueChurnRatePercent,
      tierBreakdown,
      statusBreakdown,
      dunningExposure,
    };
  }

  public async getTrends(query?: QuerySaasMetricsDto): Promise<SaasMetricsTrendDto> {
    const monthCount = query?.months ?? 6;
    const endDate = query?.endDate ? new Date(query.endDate) : new Date();

    let startDate: Date;
    if (query?.startDate) {
      startDate = new Date(query.startDate);
    } else {
      startDate = new Date(endDate);
      startDate.setMonth(startDate.getMonth() - (monthCount - 1));
      startDate.setDate(1);
      startDate.setHours(0, 0, 0, 0);
    }

    this.logger.log(
      `Calculating SaaS trends between ${startDate.toISOString()} and ${endDate.toISOString()}`,
    );

    const historicalSubs = await this.subscriptionRepo.findHistoricalSubscriptions(
      startDate,
      endDate,
    );

    const timeline: MonthlyTrendPointDto[] = [];
    const currentCursor = new Date(startDate);

    while (currentCursor <= endDate) {
      const year = currentCursor.getFullYear();
      const month = currentCursor.getMonth();

      const monthStart = new Date(year, month, 1, 0, 0, 0, 0);
      const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
      const periodLabel = `${year}-${String(month + 1).padStart(2, "0")}`;

      let mrrCents = 0;
      let activeCount = 0;
      let newCount = 0;
      let churnedCount = 0;

      for (const sub of historicalSubs) {
        // Created in this month
        if (sub.createdAt >= monthStart && sub.createdAt <= monthEnd) {
          newCount++;
        }

        // Churned in this month
        if (
          (sub.status === SubscriptionStatus.CANCELED ||
            sub.status === SubscriptionStatus.EXPIRED) &&
          sub.updatedAt >= monthStart &&
          sub.updatedAt <= monthEnd
        ) {
          churnedCount++;
        }

        // Active as of month end:
        // Created on or before monthEnd, and periodEnd >= monthEnd (or not canceled/expired prior)
        const wasCreatedBeforeEnd = sub.createdAt <= monthEnd;
        const wasActiveAtEnd =
          sub.status === SubscriptionStatus.ACTIVE &&
          sub.currentPeriodStart <= monthEnd &&
          sub.currentPeriodEnd >= monthStart;

        if (wasCreatedBeforeEnd && wasActiveAtEnd) {
          activeCount++;
          mrrCents += this.computeSubscriptionMrr(sub);
        }
      }

      timeline.push({
        period: periodLabel,
        mrrCents,
        arrCents: mrrCents * 12,
        activeCount,
        newSubscriptionsCount: newCount,
        churnedSubscriptionsCount: churnedCount,
        netGrowthCount: newCount - churnedCount,
      });

      // Move to next month
      currentCursor.setMonth(currentCursor.getMonth() + 1);
      currentCursor.setDate(1);
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      timeline,
    };
  }

  private computeSubscriptionMrr(sub: SubscriptionEntity): number {
    if (!sub.plan) {
      return 0;
    }

    const interval = SubscriptionProrationCalculator.inferBillingInterval(
      sub.currentPeriodStart,
      sub.currentPeriodEnd,
    );

    if (interval === SubscriptionBillingInterval.ANNUAL) {
      return Math.round(sub.plan.priceAnnualCents / 12);
    }

    return sub.plan.priceMonthlyCents;
  }
}
