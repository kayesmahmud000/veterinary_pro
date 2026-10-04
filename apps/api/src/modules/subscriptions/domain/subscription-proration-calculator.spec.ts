import {
  SubscriptionBillingInterval,
  SubscriptionPlanChangeType,
  SubscriptionTier,
} from "@vetralink/shared-types";
import { SubscriptionPlanEntity } from "../entities/subscription-plan.entity";
import { SubscriptionProrationCalculator } from "./subscription-proration-calculator";

describe("SubscriptionProrationCalculator", () => {
  const starterPlan = SubscriptionPlanEntity.create({
    id: "plan-starter",
    name: "Starter",
    tier: SubscriptionTier.STARTER,
    priceMonthlyCents: 0,
    priceAnnualCents: 0,
    maxAnimals: 5,
  });

  const proPlan = SubscriptionPlanEntity.create({
    id: "plan-pro",
    name: "Pro Farmer",
    tier: SubscriptionTier.PRO,
    priceMonthlyCents: 900, // $9.00
    priceAnnualCents: 8900, // $89.00
    maxAnimals: 30,
  });

  const enterprisePlan = SubscriptionPlanEntity.create({
    id: "plan-enterprise",
    name: "Commercial Enterprise",
    tier: SubscriptionTier.ENTERPRISE,
    priceMonthlyCents: 2900, // $29.00
    priceAnnualCents: 28900, // $289.00
    maxAnimals: -1,
  });

  describe("Prorated Upgrade Calculations", () => {
    it("should calculate exact proration when upgrading from PRO to ENTERPRISE after 10 days of a 30-day cycle", () => {
      const periodStart = new Date("2026-09-01T00:00:00.000Z");
      const periodEnd = new Date("2026-10-01T00:00:00.000Z"); // 30 days
      const effectiveDate = new Date("2026-09-11T00:00:00.000Z"); // 10 days used, 20 days remaining

      const result = SubscriptionProrationCalculator.calculate({
        currentPlan: proPlan,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        currentInterval: SubscriptionBillingInterval.MONTHLY,
        targetPlan: enterprisePlan,
        targetInterval: SubscriptionBillingInterval.MONTHLY,
        effectiveDate,
      });

      expect(result.changeType).toBe(SubscriptionPlanChangeType.UPGRADE);
      expect(result.currentPlanPriceCents).toBe(900);
      expect(result.targetPlanPriceCents).toBe(2900);
      expect(result.usedDays).toBe(10);
      expect(result.remainingDays).toBe(20);

      // Unused ratio = 20 / 30 = 0.666667
      // Unused credit = 900 * 0.666667 = 600 cents ($6.00)
      expect(result.unusedCreditCents).toBe(600);

      // Net amount due = 2900 - 600 = 2300 cents ($23.00)
      expect(result.netAmountDueCents).toBe(2300);
      expect(result.creditBalanceCents).toBe(0);
    });

    it("should give zero credit when upgrading from a trial or free STARTER tier", () => {
      const periodStart = new Date("2026-09-01T00:00:00.000Z");
      const periodEnd = new Date("2026-09-15T00:00:00.000Z");
      const effectiveDate = new Date("2026-09-05T00:00:00.000Z");

      const result = SubscriptionProrationCalculator.calculate({
        currentPlan: starterPlan,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        isTrial: true,
        targetPlan: proPlan,
        targetInterval: SubscriptionBillingInterval.MONTHLY,
        effectiveDate,
      });

      expect(result.changeType).toBe(SubscriptionPlanChangeType.UPGRADE);
      expect(result.currentPlanPriceCents).toBe(0);
      expect(result.unusedCreditCents).toBe(0);
      expect(result.netAmountDueCents).toBe(900);
      expect(result.creditBalanceCents).toBe(0);
    });

    it("should calculate proration when upgrading from PRO Monthly to PRO Annual (Interval change)", () => {
      const periodStart = new Date("2026-09-01T00:00:00.000Z");
      const periodEnd = new Date("2026-10-01T00:00:00.000Z");
      const effectiveDate = new Date("2026-09-16T00:00:00.000Z"); // 15 days used, 15 days remaining (half)

      const result = SubscriptionProrationCalculator.calculate({
        currentPlan: proPlan,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        currentInterval: SubscriptionBillingInterval.MONTHLY,
        targetPlan: proPlan,
        targetInterval: SubscriptionBillingInterval.ANNUAL,
        effectiveDate,
      });

      expect(result.changeType).toBe(SubscriptionPlanChangeType.INTERVAL_CHANGE);
      expect(result.currentPlanPriceCents).toBe(900);
      expect(result.targetPlanPriceCents).toBe(8900);
      // Half of monthly price = 450 cents
      expect(result.unusedCreditCents).toBe(450);
      expect(result.netAmountDueCents).toBe(8900 - 450);
      expect(result.creditBalanceCents).toBe(0);
    });
  });

  describe("Prorated Downgrade Calculations", () => {
    it("should generate credit balance when downgrading from ENTERPRISE to PRO with large remaining period", () => {
      const periodStart = new Date("2026-09-01T00:00:00.000Z");
      const periodEnd = new Date("2026-10-01T00:00:00.000Z");
      const effectiveDate = new Date("2026-09-02T00:00:00.000Z"); // 1 day used, 29 days remaining

      const result = SubscriptionProrationCalculator.calculate({
        currentPlan: enterprisePlan,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        currentInterval: SubscriptionBillingInterval.MONTHLY,
        targetPlan: proPlan,
        targetInterval: SubscriptionBillingInterval.MONTHLY,
        effectiveDate,
      });

      expect(result.changeType).toBe(SubscriptionPlanChangeType.DOWNGRADE);
      expect(result.currentPlanPriceCents).toBe(2900);
      expect(result.targetPlanPriceCents).toBe(900);

      // Unused credit approx 29/30 * 2900 = 2803 cents
      expect(result.unusedCreditCents).toBeGreaterThan(2700);
      // Since unused credit > 900, netAmountDue = 0 and creditBalance > 0
      expect(result.netAmountDueCents).toBe(0);
      expect(result.creditBalanceCents).toBe(result.unusedCreditCents - 900);
    });

    it("should report NO_CHANGE when same tier and same billing interval are selected", () => {
      const periodStart = new Date("2026-09-01T00:00:00.000Z");
      const periodEnd = new Date("2026-10-01T00:00:00.000Z");

      const result = SubscriptionProrationCalculator.calculate({
        currentPlan: proPlan,
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        currentInterval: SubscriptionBillingInterval.MONTHLY,
        targetPlan: proPlan,
        targetInterval: SubscriptionBillingInterval.MONTHLY,
      });

      expect(result.changeType).toBe(SubscriptionPlanChangeType.NO_CHANGE);
    });
  });

  describe("Helper methods", () => {
    it("should correctly infer billing interval from period dates", () => {
      const start = new Date("2026-01-01T00:00:00.000Z");
      const monthEnd = new Date("2026-02-01T00:00:00.000Z");
      const yearEnd = new Date("2027-01-01T00:00:00.000Z");

      expect(SubscriptionProrationCalculator.inferBillingInterval(start, monthEnd)).toBe(
        SubscriptionBillingInterval.MONTHLY,
      );
      expect(SubscriptionProrationCalculator.inferBillingInterval(start, yearEnd)).toBe(
        SubscriptionBillingInterval.ANNUAL,
      );
    });

    it("should correctly compute new period end date", () => {
      const now = new Date("2026-09-15T00:00:00.000Z");

      const monthlyEnd = SubscriptionProrationCalculator.computeNewPeriodEnd(
        now,
        SubscriptionBillingInterval.MONTHLY,
      );
      expect(monthlyEnd.toISOString()).toBe("2026-10-15T00:00:00.000Z");

      const annualEnd = SubscriptionProrationCalculator.computeNewPeriodEnd(
        now,
        SubscriptionBillingInterval.ANNUAL,
      );
      expect(annualEnd.toISOString()).toBe("2027-09-15T00:00:00.000Z");
    });
  });
});
