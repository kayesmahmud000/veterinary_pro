import { SubscriptionStatus, SubscriptionTier } from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import { SubscriptionPlanEntity } from "./subscription-plan.entity";
import { SubscriptionEntity } from "./subscription.entity";

describe("SubscriptionEntity", () => {
  const mockPlan = SubscriptionPlanEntity.create({
    id: "plan-123",
    name: "Pro Farmer",
    tier: SubscriptionTier.PRO,
    priceMonthlyCents: 900,
    priceAnnualCents: 8900,
    maxAnimals: 30,
  });

  const baseProps = {
    userId: "user-123",
    farmId: "farm-123",
    planId: mockPlan.id,
    plan: mockPlan,
  };

  describe("createTrial()", () => {
    it("should initialize a 14-day trial by default", () => {
      const now = new Date("2026-09-01T00:00:00.000Z");
      const subscription = SubscriptionEntity.createTrial({
        ...baseProps,
        now,
      });

      expect(subscription.id).toBeDefined();
      expect(subscription.status).toBe(SubscriptionStatus.TRIALING);
      expect(subscription.userId).toBe("user-123");
      expect(subscription.farmId).toBe("farm-123");
      expect(subscription.planId).toBe(mockPlan.id);
      expect(subscription.currentPeriodStart.toISOString()).toBe("2026-09-01T00:00:00.000Z");
      expect(subscription.currentPeriodEnd.toISOString()).toBe("2026-09-15T00:00:00.000Z");
      expect(subscription.cancelAtPeriodEnd).toBe(false);
      expect(subscription.isInTrial(now)).toBe(true);
      expect(subscription.isActive(now)).toBe(true);
      expect(subscription.daysRemaining(now)).toBe(14);
    });

    it("should support custom trial length", () => {
      const now = new Date("2026-09-01T00:00:00.000Z");
      const subscription = SubscriptionEntity.createTrial({
        ...baseProps,
        trialDays: 30,
        now,
      });

      expect(subscription.daysRemaining(now)).toBe(30);
    });

    it("should throw if userId or planId is missing or trialDays < 1", () => {
      expect(() =>
        SubscriptionEntity.createTrial({ ...baseProps, userId: "" }),
      ).toThrow(ValidationDomainException);

      expect(() =>
        SubscriptionEntity.createTrial({ ...baseProps, planId: "" }),
      ).toThrow(ValidationDomainException);

      expect(() =>
        SubscriptionEntity.createTrial({ ...baseProps, trialDays: 0 }),
      ).toThrow(ValidationDomainException);
    });
  });

  describe("createActive()", () => {
    it("should initialize an active subscription with valid future period end", () => {
      const now = new Date("2026-09-01T00:00:00.000Z");
      const periodEnd = new Date("2026-10-01T00:00:00.000Z");

      const subscription = SubscriptionEntity.createActive({
        ...baseProps,
        periodEnd,
        gatewaySubId: "sub_stripe_123",
        now,
      });

      expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
      expect(subscription.gatewaySubId).toBe("sub_stripe_123");
      expect(subscription.isActive(now)).toBe(true);
      expect(subscription.isInTrial(now)).toBe(false);
      expect(subscription.daysRemaining(now)).toBe(30);
    });

    it("should throw if periodEnd is before or equal to now", () => {
      const now = new Date("2026-09-01T00:00:00.000Z");
      const pastEnd = new Date("2026-08-31T00:00:00.000Z");

      expect(() =>
        SubscriptionEntity.createActive({
          ...baseProps,
          periodEnd: pastEnd,
          now,
        }),
      ).toThrow(ValidationDomainException);
    });
  });

  describe("State Transitions & Predicates", () => {
    let subscription: SubscriptionEntity;
    const now = new Date("2026-09-01T00:00:00.000Z");

    beforeEach(() => {
      subscription = SubscriptionEntity.createTrial({
        ...baseProps,
        trialDays: 14,
        now,
      });
    });

    it("should activate from trial on payment confirmation", () => {
      const paymentDate = new Date("2026-09-10T00:00:00.000Z");
      const nextMonthEnd = new Date("2026-10-10T00:00:00.000Z");

      subscription.activate({
        periodEnd: nextMonthEnd,
        gatewaySubId: "sub_real_999",
        now: paymentDate,
      });

      expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
      expect(subscription.gatewaySubId).toBe("sub_real_999");
      expect(subscription.currentPeriodEnd).toEqual(nextMonthEnd);
      expect(subscription.isInTrial(paymentDate)).toBe(false);
      expect(subscription.isActive(paymentDate)).toBe(true);
    });

    it("should handle past-due transition and allow grace period service access", () => {
      subscription.activate({ now });
      subscription.markPastDue(now);

      expect(subscription.status).toBe(SubscriptionStatus.PAST_DUE);
      expect(subscription.isPastDue()).toBe(true);
      expect(subscription.isActive(now)).toBe(false);

      // Within 3-day grace period of currentPeriodEnd (2026-09-15)
      const day2AfterExpiry = new Date("2026-09-17T00:00:00.000Z");
      expect(subscription.canAccessService(day2AfterExpiry)).toBe(true);

      // Past 3-day grace period (2026-09-19)
      const day4AfterExpiry = new Date("2026-09-19T00:00:00.000Z");
      expect(subscription.canAccessService(day4AfterExpiry)).toBe(false);
    });

    it("should handle cancellation at period end and allow revocation before expiry", () => {
      subscription.activate({ now });
      subscription.requestCancellation({ immediate: false, now });

      expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
      expect(subscription.cancelAtPeriodEnd).toBe(true);
      expect(subscription.canAccessService(now)).toBe(true);

      // Revoke cancellation
      subscription.revokeCancellation(now);
      expect(subscription.cancelAtPeriodEnd).toBe(false);
    });

    it("should reject revocation if subscription has expired", () => {
      subscription.requestCancellation({ immediate: false, now });

      const pastEnd = new Date("2026-09-20T00:00:00.000Z");
      expect(() => subscription.revokeCancellation(pastEnd)).toThrow(
        ValidationDomainException,
      );
    });

    it("should handle immediate cancellation", () => {
      subscription.requestCancellation({ immediate: true, now });

      expect(subscription.status).toBe(SubscriptionStatus.CANCELED);
      expect(subscription.cancelAtPeriodEnd).toBe(false);
      expect(subscription.isCanceled()).toBe(true);
      expect(subscription.canAccessService(now)).toBe(false);

      expect(() => subscription.activate()).toThrow(ValidationDomainException);
    });

    it("should handle subscription renewal", () => {
      subscription.activate({ now });
      const newPeriodEnd = new Date("2026-10-15T00:00:00.000Z");

      subscription.renew(newPeriodEnd, "sub_gateway_new", now);

      expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
      expect(subscription.currentPeriodStart).toEqual(new Date("2026-09-15T00:00:00.000Z"));
      expect(subscription.currentPeriodEnd).toEqual(newPeriodEnd);
      expect(subscription.gatewaySubId).toBe("sub_gateway_new");
    });

    it("should map to response DTO properly", () => {
      const dto = subscription.toResponseDto(now);
      expect(dto.id).toBe(subscription.id);
      expect(dto.userId).toBe("user-123");
      expect(dto.status).toBe(SubscriptionStatus.TRIALING);
      expect(dto.plan?.name).toBe("Pro Farmer");
      expect(dto.isActive).toBe(true);
      expect(dto.isTrial).toBe(true);
    });

    it("should change plan to enterprise with new period end and activate", () => {
      const enterprisePlan = SubscriptionPlanEntity.create({
        id: "plan-ent",
        name: "Enterprise",
        tier: SubscriptionTier.ENTERPRISE,
        priceMonthlyCents: 2900,
        priceAnnualCents: 28900,
        maxAnimals: -1,
      });

      const effectiveDate = new Date("2026-09-08T00:00:00.000Z");
      const newPeriodEnd = new Date("2026-10-08T00:00:00.000Z");

      subscription.changePlan({
        newPlan: enterprisePlan,
        newPeriodEnd,
        gatewaySubId: "sub_gateway_upgrade",
        now: effectiveDate,
      });

      expect(subscription.planId).toBe(enterprisePlan.id);
      expect(subscription.plan?.tier).toBe(SubscriptionTier.ENTERPRISE);
      expect(subscription.status).toBe(SubscriptionStatus.ACTIVE);
      expect(subscription.currentPeriodStart).toEqual(effectiveDate);
      expect(subscription.currentPeriodEnd).toEqual(newPeriodEnd);
      expect(subscription.gatewaySubId).toBe("sub_gateway_upgrade");
      expect(subscription.cancelAtPeriodEnd).toBe(false);
    });

    it("should throw when changing plan on canceled subscription", () => {
      subscription.requestCancellation({ immediate: true, now });

      const newPlan = SubscriptionPlanEntity.create({
        id: "plan-ent",
        name: "Enterprise",
        tier: SubscriptionTier.ENTERPRISE,
        priceMonthlyCents: 2900,
        priceAnnualCents: 28900,
        maxAnimals: -1,
      });

      expect(() =>
        subscription.changePlan({
          newPlan,
          newPeriodEnd: new Date("2026-10-01T00:00:00.000Z"),
          now,
        }),
      ).toThrow(ValidationDomainException);
    });
  });
});

