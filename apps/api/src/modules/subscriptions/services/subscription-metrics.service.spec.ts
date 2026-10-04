import {
  SubscriptionStatus,
  SubscriptionTier,
} from "@vetralink/shared-types";
import { SubscriptionPlanEntity } from "../entities/subscription-plan.entity";
import { SubscriptionEntity } from "../entities/subscription.entity";
import { ISubscriptionRepository } from "../repositories/subscription.repository.interface";
import { SubscriptionMetricsService } from "./subscription-metrics.service";

describe("SubscriptionMetricsService", () => {
  let service: SubscriptionMetricsService;
  let mockRepo: jest.Mocked<ISubscriptionRepository>;

  const starterPlan = SubscriptionPlanEntity.fromPersistence({
    id: "plan-starter",
    name: "Starter",
    tier: SubscriptionTier.STARTER,
    priceMonthlyCents: 900,
    priceAnnualCents: 10800,
    maxAnimals: 5,
    features: {},
    isActive: true,
    createdAt: new Date("2026-01-01"),
  });

  const proPlan = SubscriptionPlanEntity.fromPersistence({
    id: "plan-pro",
    name: "Pro Farmer",
    tier: SubscriptionTier.PRO,
    priceMonthlyCents: 2900,
    priceAnnualCents: 29000,
    maxAnimals: 30,
    features: {},
    isActive: true,
    createdAt: new Date("2026-01-01"),
  });

  const enterprisePlan = SubscriptionPlanEntity.fromPersistence({
    id: "plan-enterprise",
    name: "Enterprise",
    tier: SubscriptionTier.ENTERPRISE,
    priceMonthlyCents: 9900,
    priceAnnualCents: 99000,
    maxAnimals: 9999,
    features: {},
    isActive: true,
    createdAt: new Date("2026-01-01"),
  });

  beforeEach(() => {
    mockRepo = {
      findById: jest.fn(),
      findByFarmId: jest.fn(),
      findByUserId: jest.fn(),
      findByGatewaySubId: jest.fn(),
      save: jest.fn(),
      findExpiredSubscriptions: jest.fn(),
      findPastDueSubscriptions: jest.fn(),
      findAllWithPlan: jest.fn(),
      findHistoricalSubscriptions: jest.fn(),
    };

    service = new SubscriptionMetricsService(mockRepo);
  });

  describe("getSummary()", () => {
    it("should return zero metrics when no subscriptions exist", async () => {
      mockRepo.findAllWithPlan.mockResolvedValue([]);

      const result = await service.getSummary(new Date("2026-09-20T00:00:00Z"));

      expect(result.mrrCents).toBe(0);
      expect(result.arrCents).toBe(0);
      expect(result.arpuCents).toBe(0);
      expect(result.ltvCents).toBe(0);
      expect(result.activeSubscriptionsCount).toBe(0);
      expect(result.activePayingSubscriptionsCount).toBe(0);
      expect(result.totalSubscriptionsCount).toBe(0);
      expect(result.customerChurnRatePercent).toBe(0);
      expect(result.revenueChurnRatePercent).toBe(0);
      expect(result.tierBreakdown).toHaveLength(3);
      expect(result.statusBreakdown).toHaveLength(5);
      expect(result.dunningExposure.totalPastDueCount).toBe(0);
      expect(result.dunningExposure.atRiskMrrCents).toBe(0);
    });

    it("should calculate MRR, ARR, ARPU, LTV, tier and status breakdowns accurately", async () => {
      const now = new Date("2026-09-20T12:00:00Z");

      // 1. Starter monthly active: 900 cents MRR
      const sub1 = SubscriptionEntity.fromPersistence({
        id: "sub-1",
        userId: "user-1",
        farmId: "farm-1",
        planId: starterPlan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date("2026-09-01T00:00:00Z"),
        currentPeriodEnd: new Date("2026-10-01T00:00:00Z"),
        gatewaySubId: "sub_1",
        cancelAtPeriodEnd: false,
        createdAt: new Date("2026-09-01T00:00:00Z"),
        updatedAt: new Date("2026-09-01T00:00:00Z"),
        plan: starterPlan as any,
      });

      // 2. Pro annual active: 29000 / 12 = 2417 cents MRR
      const sub2 = SubscriptionEntity.fromPersistence({
        id: "sub-2",
        userId: "user-2",
        farmId: "farm-2",
        planId: proPlan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date("2026-01-01T00:00:00Z"),
        currentPeriodEnd: new Date("2027-01-01T00:00:00Z"),
        gatewaySubId: "sub_2",
        cancelAtPeriodEnd: false,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
        plan: proPlan as any,
      });

      // 3. Enterprise trial: 0 MRR
      const sub3 = SubscriptionEntity.fromPersistence({
        id: "sub-3",
        userId: "user-3",
        farmId: "farm-3",
        planId: enterprisePlan.id,
        status: SubscriptionStatus.TRIALING,
        currentPeriodStart: new Date("2026-09-10T00:00:00Z"),
        currentPeriodEnd: new Date("2026-09-24T00:00:00Z"),
        gatewaySubId: null,
        cancelAtPeriodEnd: false,
        createdAt: new Date("2026-09-10T00:00:00Z"),
        updatedAt: new Date("2026-09-10T00:00:00Z"),
        plan: enterprisePlan as any,
      });

      // 4. Past due day 2 (Grace period): 900 cents at-risk MRR
      const sub4 = SubscriptionEntity.fromPersistence({
        id: "sub-4",
        userId: "user-4",
        farmId: "farm-4",
        planId: starterPlan.id,
        status: SubscriptionStatus.PAST_DUE,
        currentPeriodStart: new Date("2026-08-18T00:00:00Z"),
        currentPeriodEnd: new Date("2026-09-18T12:00:00Z"), // 2 days past due
        gatewaySubId: "sub_4",
        cancelAtPeriodEnd: false,
        createdAt: new Date("2026-08-18T00:00:00Z"),
        updatedAt: new Date("2026-09-18T12:00:00Z"),
        plan: starterPlan as any,
      });

      // 5. Past due day 5 (Read-only): 2900 cents at-risk MRR
      const sub5 = SubscriptionEntity.fromPersistence({
        id: "sub-5",
        userId: "user-5",
        farmId: "farm-5",
        planId: proPlan.id,
        status: SubscriptionStatus.PAST_DUE,
        currentPeriodStart: new Date("2026-08-15T00:00:00Z"),
        currentPeriodEnd: new Date("2026-09-15T12:00:00Z"), // 5 days past due
        gatewaySubId: "sub_5",
        cancelAtPeriodEnd: false,
        createdAt: new Date("2026-08-15T00:00:00Z"),
        updatedAt: new Date("2026-09-15T12:00:00Z"),
        plan: proPlan as any,
      });

      // 6. Past due day 9 (Suspended): 9900 cents at-risk MRR
      const sub6 = SubscriptionEntity.fromPersistence({
        id: "sub-6",
        userId: "user-6",
        farmId: "farm-6",
        planId: enterprisePlan.id,
        status: SubscriptionStatus.PAST_DUE,
        currentPeriodStart: new Date("2026-08-11T00:00:00Z"),
        currentPeriodEnd: new Date("2026-09-11T12:00:00Z"), // 9 days past due
        gatewaySubId: "sub_6",
        cancelAtPeriodEnd: false,
        createdAt: new Date("2026-08-11T00:00:00Z"),
        updatedAt: new Date("2026-09-11T12:00:00Z"),
        plan: enterprisePlan as any,
      });

      // 7. Canceled 10 days ago (within 30-day window): 900 cents MRR
      const sub7 = SubscriptionEntity.fromPersistence({
        id: "sub-7",
        userId: "user-7",
        farmId: "farm-7",
        planId: starterPlan.id,
        status: SubscriptionStatus.CANCELED,
        currentPeriodStart: new Date("2026-08-01T00:00:00Z"),
        currentPeriodEnd: new Date("2026-09-01T00:00:00Z"),
        gatewaySubId: "sub_7",
        cancelAtPeriodEnd: true,
        createdAt: new Date("2026-08-01T00:00:00Z"),
        updatedAt: new Date("2026-09-10T00:00:00Z"), // within 30 days of now
        plan: starterPlan as any,
      });

      mockRepo.findAllWithPlan.mockResolvedValue([
        sub1,
        sub2,
        sub3,
        sub4,
        sub5,
        sub6,
        sub7,
      ]);

      const result = await service.getSummary(now);

      // Expected MRR: 900 (sub1) + 2417 (sub2) = 3317 cents
      expect(result.mrrCents).toBe(3317);
      expect(result.arrCents).toBe(3317 * 12);
      expect(result.activePayingSubscriptionsCount).toBe(2);
      expect(result.activeSubscriptionsCount).toBe(2);
      expect(result.trialingSubscriptionsCount).toBe(1);
      expect(result.pastDueSubscriptionsCount).toBe(3);
      expect(result.canceledSubscriptionsCount).toBe(1);
      expect(result.totalSubscriptionsCount).toBe(7);

      // ARPU = 3317 / 2 = 1659 cents
      expect(result.arpuCents).toBe(1659);

      // Dunning Exposure: 900 + 2900 + 9900 = 13700 cents
      expect(result.dunningExposure.totalPastDueCount).toBe(3);
      expect(result.dunningExposure.atRiskMrrCents).toBe(13700);
      expect(result.dunningExposure.gracePeriodCount).toBe(1);
      expect(result.dunningExposure.readOnlyCount).toBe(1);
      expect(result.dunningExposure.suspendedCount).toBe(1);

      // Churn: 1 churned sub (sub7) / (2 active + 1 churned) = 33.33%
      expect(result.customerChurnRatePercent).toBe(33.33);
      expect(result.revenueChurnRatePercent).toBe(
        Math.round((900 / (3317 + 900)) * 10000) / 100,
      );

      // LTV = 1659 / (33.33 / 100) = 4977 cents
      expect(result.ltvCents).toBe(Math.round(1659 / 0.3333));

      // Tier Breakdown
      const starterTier = result.tierBreakdown.find(
        (t) => t.tier === SubscriptionTier.STARTER,
      );
      expect(starterTier?.activePayingCount).toBe(1);
      expect(starterTier?.mrrCents).toBe(900);

      const proTier = result.tierBreakdown.find(
        (t) => t.tier === SubscriptionTier.PRO,
      );
      expect(proTier?.activePayingCount).toBe(1);
      expect(proTier?.mrrCents).toBe(2417);
    });
  });

  describe("getTrends()", () => {
    it("should compute monthly trend cohorts across requested window", async () => {
      const sub = SubscriptionEntity.fromPersistence({
        id: "sub-1",
        userId: "user-1",
        farmId: "farm-1",
        planId: starterPlan.id,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodStart: new Date("2026-07-01T00:00:00Z"),
        currentPeriodEnd: new Date("2026-10-01T00:00:00Z"),
        gatewaySubId: "sub_1",
        cancelAtPeriodEnd: false,
        createdAt: new Date("2026-07-01T00:00:00Z"),
        updatedAt: new Date("2026-07-01T00:00:00Z"),
        plan: starterPlan as any,
      });

      mockRepo.findHistoricalSubscriptions.mockResolvedValue([sub]);

      const result = await service.getTrends({
        startDate: "2026-07-01T00:00:00.000Z",
        endDate: "2026-09-30T23:59:59.999Z",
      });

      expect(result.timeline.length).toBe(3); // July, August, September
      expect(result.timeline[0]?.period).toBe("2026-07");
      expect(result.timeline[0]?.newSubscriptionsCount).toBe(1);
      expect(result.timeline[0]?.activeCount).toBe(1);
      expect(result.timeline[0]?.mrrCents).toBe(900);

      expect(result.timeline[1]?.period).toBe("2026-08");
      expect(result.timeline[1]?.newSubscriptionsCount).toBe(0);
      expect(result.timeline[1]?.activeCount).toBe(1);

      expect(result.timeline[2]?.period).toBe("2026-09");
      expect(result.timeline[2]?.activeCount).toBe(1);
    });
  });
});
