import { Test, TestingModule } from "@nestjs/testing";
import {
  SubscriptionQuotaType,
  SubscriptionStatus,
  SubscriptionTier,
} from "@vetralink/shared-types";
import { QuotaExceededDomainException } from "../../../common/exceptions/domain.exception";
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
import { SubscriptionQuotaService } from "./subscription-quota.service";

describe("SubscriptionQuotaService", () => {
  let service: SubscriptionQuotaService;
  let subRepo: jest.Mocked<ISubscriptionRepository>;
  let planRepo: jest.Mocked<ISubscriptionPlanRepository>;
  let usageRepo: jest.Mocked<ISubscriptionUsageRepository>;

  const starterPlan = SubscriptionPlanEntity.create({
    id: "plan-starter",
    name: "Starter",
    tier: SubscriptionTier.STARTER,
    priceMonthlyCents: 0,
    priceAnnualCents: 0,
    maxAnimals: 5,
    features: {
      maxAnimals: 5,
      maxStaff: 1,
      teleVetPriority: "STANDARD",
      advancedAnalytics: false,
      bulkImportExport: false,
      customReports: false,
    },
  });

  const proPlan = SubscriptionPlanEntity.create({
    id: "plan-pro",
    name: "Pro Farmer",
    tier: SubscriptionTier.PRO,
    priceMonthlyCents: 900,
    priceAnnualCents: 8900,
    maxAnimals: 30,
    features: {
      maxAnimals: 30,
      maxStaff: 3,
      teleVetPriority: "EXPEDITED",
      advancedAnalytics: true,
      bulkImportExport: true,
      customReports: false,
    },
  });

  const enterprisePlan = SubscriptionPlanEntity.create({
    id: "plan-enterprise",
    name: "Commercial Enterprise",
    tier: SubscriptionTier.ENTERPRISE,
    priceMonthlyCents: 2900,
    priceAnnualCents: 28900,
    maxAnimals: -1,
    features: {
      maxAnimals: -1,
      maxStaff: -1,
      teleVetPriority: "PRIORITY",
      advancedAnalytics: true,
      bulkImportExport: true,
      customReports: true,
    },
  });

  beforeEach(async () => {
    subRepo = {
      save: jest.fn(),
      findById: jest.fn(),
      findByFarmId: jest.fn(),
      findByUserId: jest.fn(),
      findByGatewaySubId: jest.fn(),
      findExpiredSubscriptions: jest.fn(),
      findPastDueSubscriptions: jest.fn(),
      findAllWithPlan: jest.fn(),
      findHistoricalSubscriptions: jest.fn(),
    };

    planRepo = {
      upsertDefaultPlans: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      findByTier: jest.fn(),
      save: jest.fn(),
    };

    usageRepo = {
      countActiveAnimals: jest.fn(),
      countFarmMembers: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionQuotaService,
        { provide: SUBSCRIPTION_REPOSITORY, useValue: subRepo },
        { provide: SUBSCRIPTION_PLAN_REPOSITORY, useValue: planRepo },
        { provide: SUBSCRIPTION_USAGE_REPOSITORY, useValue: usageRepo },
      ],
    }).compile();

    service = module.get<SubscriptionQuotaService>(SubscriptionQuotaService);
  });

  describe("checkQuota & fallback to STARTER", () => {
    it("should fallback to STARTER plan if farm has no subscription in DB", async () => {
      subRepo.findByFarmId.mockResolvedValue(null);
      planRepo.findByTier.mockResolvedValue(starterPlan);
      usageRepo.countActiveAnimals.mockResolvedValue(4);

      const result = await service.checkQuota(
        "farm-1",
        SubscriptionQuotaType.ANIMALS,
        1,
      );

      expect(result.allowed).toBe(true);
      expect(result.currentUsage).toBe(4);
      expect(result.limit).toBe(5);
      expect(result.remaining).toBe(1);
      expect(result.planTier).toBe(SubscriptionTier.STARTER);
      expect(result.upgradeTier).toBe(SubscriptionTier.PRO);
    });

    it("should disallow animal registration when STARTER reaches 5 animals", async () => {
      subRepo.findByFarmId.mockResolvedValue(null);
      planRepo.findByTier.mockResolvedValue(starterPlan);
      usageRepo.countActiveAnimals.mockResolvedValue(5);

      const result = await service.checkQuota(
        "farm-1",
        SubscriptionQuotaType.ANIMALS,
        1,
      );

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("should disallow staff addition on STARTER when 1 member already exists", async () => {
      subRepo.findByFarmId.mockResolvedValue(null);
      planRepo.findByTier.mockResolvedValue(starterPlan);
      usageRepo.countFarmMembers.mockResolvedValue(1);

      const result = await service.checkQuota(
        "farm-1",
        SubscriptionQuotaType.STAFF,
        1,
      );

      expect(result.allowed).toBe(false);
      expect(result.currentUsage).toBe(1);
      expect(result.limit).toBe(1);
      expect(result.remaining).toBe(0);
    });
  });

  describe("checkQuota with active PRO subscription", () => {
    it("should allow animal registration when under PRO limit (30 animals)", async () => {
      const activeSub = SubscriptionEntity.createTrial({
        userId: "user-1",
        farmId: "farm-pro",
        planId: proPlan.id,
        plan: proPlan,
      });

      subRepo.findByFarmId.mockResolvedValue(activeSub);
      usageRepo.countActiveAnimals.mockResolvedValue(29);

      const result = await service.checkQuota(
        "farm-pro",
        SubscriptionQuotaType.ANIMALS,
        1,
      );

      expect(result.allowed).toBe(true);
      expect(result.currentUsage).toBe(29);
      expect(result.limit).toBe(30);
      expect(result.remaining).toBe(1);
      expect(result.planTier).toBe(SubscriptionTier.PRO);
      expect(result.upgradeTier).toBe(SubscriptionTier.ENTERPRISE);
    });

    it("should allow staff addition up to 3 members on PRO plan", async () => {
      const activeSub = SubscriptionEntity.createTrial({
        userId: "user-1",
        farmId: "farm-pro",
        planId: proPlan.id,
        plan: proPlan,
      });

      subRepo.findByFarmId.mockResolvedValue(activeSub);
      usageRepo.countFarmMembers.mockResolvedValue(2);

      const result = await service.checkQuota(
        "farm-pro",
        SubscriptionQuotaType.STAFF,
        1,
      );

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });
  });

  describe("checkQuota with ENTERPRISE subscription", () => {
    it("should allow unlimited animals and unlimited staff", async () => {
      const enterpriseSub = SubscriptionEntity.createTrial({
        userId: "user-ent",
        farmId: "farm-ent",
        planId: enterprisePlan.id,
        plan: enterprisePlan,
      });

      subRepo.findByFarmId.mockResolvedValue(enterpriseSub);
      usageRepo.countActiveAnimals.mockResolvedValue(5420);
      usageRepo.countFarmMembers.mockResolvedValue(55);

      const animalCheck = await service.checkQuota(
        "farm-ent",
        SubscriptionQuotaType.ANIMALS,
        100,
      );
      expect(animalCheck.allowed).toBe(true);
      expect(animalCheck.limit).toBe(-1);
      expect(animalCheck.remaining).toBe(-1);
      expect(animalCheck.upgradeTier).toBeNull();

      const staffCheck = await service.checkQuota(
        "farm-ent",
        SubscriptionQuotaType.STAFF,
        10,
      );
      expect(staffCheck.allowed).toBe(true);
      expect(staffCheck.limit).toBe(-1);
    });
  });

  describe("assertQuotaAvailable", () => {
    it("should pass cleanly when quota is available", async () => {
      subRepo.findByFarmId.mockResolvedValue(null);
      planRepo.findByTier.mockResolvedValue(starterPlan);
      usageRepo.countActiveAnimals.mockResolvedValue(2);

      await expect(
        service.assertQuotaAvailable("farm-1", SubscriptionQuotaType.ANIMALS, 1),
      ).resolves.toMatchObject({
        allowed: true,
        currentUsage: 2,
        limit: 5,
      });
    });

    it("should throw QuotaExceededDomainException when animal limit is exceeded", async () => {
      subRepo.findByFarmId.mockResolvedValue(null);
      planRepo.findByTier.mockResolvedValue(starterPlan);
      usageRepo.countActiveAnimals.mockResolvedValue(5);

      await expect(
        service.assertQuotaAvailable("farm-1", SubscriptionQuotaType.ANIMALS, 1),
      ).rejects.toThrow(QuotaExceededDomainException);

      try {
        await service.assertQuotaAvailable(
          "farm-1",
          SubscriptionQuotaType.ANIMALS,
          1,
        );
      } catch (err: any) {
        expect(err).toBeInstanceOf(QuotaExceededDomainException);
        expect(err.statusCode).toBe(403);
        expect(err.errorCode).toBe("QUOTA_EXCEEDED");
        expect(err.details).toEqual({
          quotaType: SubscriptionQuotaType.ANIMALS,
          currentUsage: 5,
          limit: 5,
          planTier: SubscriptionTier.STARTER,
          upgradeTier: SubscriptionTier.PRO,
        });
      }
    });

    it("should throw QuotaExceededDomainException when staff limit is exceeded", async () => {
      subRepo.findByFarmId.mockResolvedValue(null);
      planRepo.findByTier.mockResolvedValue(starterPlan);
      usageRepo.countFarmMembers.mockResolvedValue(1);

      await expect(
        service.assertQuotaAvailable("farm-1", SubscriptionQuotaType.STAFF, 1),
      ).rejects.toThrow(QuotaExceededDomainException);
    });
  });

  describe("getFarmQuotaUsage", () => {
    it("should return complete quota summary for both animals and staff", async () => {
      subRepo.findByFarmId.mockResolvedValue(null);
      planRepo.findByTier.mockResolvedValue(starterPlan);
      usageRepo.countActiveAnimals.mockResolvedValue(3);
      usageRepo.countFarmMembers.mockResolvedValue(1);

      const summary = await service.getFarmQuotaUsage("farm-1");

      expect(summary.farmId).toBe("farm-1");
      expect(summary.planTier).toBe(SubscriptionTier.STARTER);
      expect(summary.quotas.animals).toEqual({
        quotaType: SubscriptionQuotaType.ANIMALS,
        currentUsage: 3,
        limit: 5,
        remaining: 2,
        isUnlimited: false,
        canAccommodate: true,
        planTier: SubscriptionTier.STARTER,
        upgradeTier: SubscriptionTier.PRO,
      });
      expect(summary.quotas.staff).toEqual({
        quotaType: SubscriptionQuotaType.STAFF,
        currentUsage: 1,
        limit: 1,
        remaining: 0,
        isUnlimited: false,
        canAccommodate: false,
        planTier: SubscriptionTier.STARTER,
        upgradeTier: SubscriptionTier.PRO,
      });
      expect(summary.features.bulkImportExport).toBe(false);
    });
  });
});
