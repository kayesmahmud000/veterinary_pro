import { SubscriptionTier, UNLIMITED_ANIMALS_SENTINEL } from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import { SubscriptionPlanEntity } from "./subscription-plan.entity";

describe("SubscriptionPlanEntity", () => {
  describe("create()", () => {
    it("should successfully create a STARTER plan with default features", () => {
      const plan = SubscriptionPlanEntity.create({
        name: "Starter",
        tier: SubscriptionTier.STARTER,
        priceMonthlyCents: 0,
        priceAnnualCents: 0,
        maxAnimals: 5,
      });

      expect(plan.id).toBeDefined();
      expect(plan.name).toBe("Starter");
      expect(plan.tier).toBe(SubscriptionTier.STARTER);
      expect(plan.maxAnimals).toBe(5);
      expect(plan.isUnlimitedAnimals()).toBe(false);
      expect(plan.canAccommodateAnimals(4)).toBe(true);
      expect(plan.canAccommodateAnimals(5)).toBe(false);
      expect(plan.features.maxStaff).toBe(1);
      expect(plan.features.teleVetPriority).toBe("STANDARD");
      expect(plan.features.advancedAnalytics).toBe(false);
      expect(plan.calculateAnnualSavingsCents()).toBe(0);
    });

    it("should successfully create a PRO plan with annual savings and 30 animals limit", () => {
      const plan = SubscriptionPlanEntity.create({
        name: "Pro Farmer",
        tier: SubscriptionTier.PRO,
        priceMonthlyCents: 900,
        priceAnnualCents: 8900,
        maxAnimals: 30,
      });

      expect(plan.name).toBe("Pro Farmer");
      expect(plan.tier).toBe(SubscriptionTier.PRO);
      expect(plan.maxAnimals).toBe(30);
      expect(plan.isUnlimitedAnimals()).toBe(false);
      expect(plan.canAccommodateAnimals(29)).toBe(true);
      expect(plan.canAccommodateAnimals(30)).toBe(false);
      expect(plan.features.maxStaff).toBe(3);
      expect(plan.features.teleVetPriority).toBe("EXPEDITED");
      expect(plan.features.advancedAnalytics).toBe(true);
      // (900 * 12) - 8900 = 10800 - 8900 = 1900 cents ($19/year savings)
      expect(plan.calculateAnnualSavingsCents()).toBe(1900);
    });

    it("should successfully create an ENTERPRISE plan with unlimited animals and staff", () => {
      const plan = SubscriptionPlanEntity.create({
        name: "Commercial Enterprise",
        tier: SubscriptionTier.ENTERPRISE,
        priceMonthlyCents: 2900,
        priceAnnualCents: 28900,
        maxAnimals: UNLIMITED_ANIMALS_SENTINEL,
      });

      expect(plan.name).toBe("Commercial Enterprise");
      expect(plan.tier).toBe(SubscriptionTier.ENTERPRISE);
      expect(plan.maxAnimals).toBe(-1);
      expect(plan.isUnlimitedAnimals()).toBe(true);
      expect(plan.canAccommodateAnimals(0)).toBe(true);
      expect(plan.canAccommodateAnimals(5000)).toBe(true);
      expect(plan.features.maxStaff).toBe(-1);
      expect(plan.features.teleVetPriority).toBe("PRIORITY");
      expect(plan.features.customReports).toBe(true);
      // (2900 * 12) - 28900 = 34800 - 28900 = 5900 cents ($59/year savings)
      expect(plan.calculateAnnualSavingsCents()).toBe(5900);
    });

    it("should throw ValidationDomainException if name is empty", () => {
      expect(() =>
        SubscriptionPlanEntity.create({
          name: "  ",
          tier: SubscriptionTier.STARTER,
          priceMonthlyCents: 0,
          priceAnnualCents: 0,
          maxAnimals: 5,
        }),
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if monthly price is negative", () => {
      expect(() =>
        SubscriptionPlanEntity.create({
          name: "Invalid",
          tier: SubscriptionTier.PRO,
          priceMonthlyCents: -100,
          priceAnnualCents: 1000,
          maxAnimals: 10,
        }),
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if annual price is negative", () => {
      expect(() =>
        SubscriptionPlanEntity.create({
          name: "Invalid",
          tier: SubscriptionTier.PRO,
          priceMonthlyCents: 100,
          priceAnnualCents: -1000,
          maxAnimals: 10,
        }),
      ).toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if maxAnimals is less than -1", () => {
      expect(() =>
        SubscriptionPlanEntity.create({
          name: "Invalid",
          tier: SubscriptionTier.PRO,
          priceMonthlyCents: 100,
          priceAnnualCents: 1000,
          maxAnimals: -2,
        }),
      ).toThrow(ValidationDomainException);
    });
  });

  describe("fromPersistence()", () => {
    it("should hydrate plan entity from raw database record", () => {
      const raw = {
        id: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
        name: "Pro Farmer",
        tier: "PRO",
        priceMonthlyCents: 900,
        priceAnnualCents: 8900,
        maxAnimals: 30,
        features: {
          maxAnimals: 30,
          maxStaff: 3,
          teleVetPriority: "EXPEDITED" as const,
          advancedAnalytics: true,
          bulkImportExport: true,
          customReports: false,
        },
        isActive: true,
        createdAt: new Date("2026-09-01T00:00:00Z"),
      };

      const entity = SubscriptionPlanEntity.fromPersistence(raw);
      expect(entity.id).toBe(raw.id);
      expect(entity.name).toBe("Pro Farmer");
      expect(entity.tier).toBe(SubscriptionTier.PRO);
      expect(entity.maxAnimals).toBe(30);
      expect(entity.isActive).toBe(true);

      const dto = entity.toResponseDto();
      expect(dto.annualSavingsCents).toBe(1900);
      expect(dto.isUnlimitedAnimals).toBe(false);
    });
  });

  describe("updateDetails()", () => {
    it("should update valid fields and validate constraints", () => {
      const plan = SubscriptionPlanEntity.create({
        name: "Pro Farmer",
        tier: SubscriptionTier.PRO,
        priceMonthlyCents: 900,
        priceAnnualCents: 8900,
        maxAnimals: 30,
      });

      plan.updateDetails({
        name: "Pro Plus",
        priceMonthlyCents: 1200,
        maxAnimals: 40,
        isActive: false,
      });

      expect(plan.name).toBe("Pro Plus");
      expect(plan.priceMonthlyCents).toBe(1200);
      expect(plan.maxAnimals).toBe(40);
      expect(plan.isActive).toBe(false);

      expect(() => plan.updateDetails({ name: "" })).toThrow(ValidationDomainException);
      expect(() => plan.updateDetails({ priceMonthlyCents: -50 })).toThrow(ValidationDomainException);
      expect(() => plan.updateDetails({ priceAnnualCents: -50 })).toThrow(ValidationDomainException);
      expect(() => plan.updateDetails({ maxAnimals: -5 })).toThrow(ValidationDomainException);
    });
  });

  describe("allowsStaffCount()", () => {
    it("should enforce staff limits based on tier features", () => {
      const starter = SubscriptionPlanEntity.create({
        name: "Starter",
        tier: SubscriptionTier.STARTER,
        priceMonthlyCents: 0,
        priceAnnualCents: 0,
        maxAnimals: 5,
      });
      expect(starter.allowsStaffCount(1)).toBe(true);
      expect(starter.allowsStaffCount(2)).toBe(false);

      const enterprise = SubscriptionPlanEntity.create({
        name: "Enterprise",
        tier: SubscriptionTier.ENTERPRISE,
        priceMonthlyCents: 2900,
        priceAnnualCents: 28900,
        maxAnimals: -1,
      });
      expect(enterprise.allowsStaffCount(100)).toBe(true);
    });
  });
});
