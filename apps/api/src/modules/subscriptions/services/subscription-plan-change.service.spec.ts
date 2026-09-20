import {
  SubscriptionBillingInterval,
  SubscriptionPlanChangeType,
  SubscriptionStatus,
  SubscriptionTier,
} from "@vetralink/shared-types";
import {
  EntityNotFoundException,
  QuotaExceededDomainException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import { IAuditLogRepository } from "../../audit/repositories/audit-log.repository.interface";
import { ITransactionManager } from "../../prisma/interfaces/transaction.interface";
import { SubscriptionPlanEntity } from "../entities/subscription-plan.entity";
import { SubscriptionEntity } from "../entities/subscription.entity";
import { ISubscriptionPlanRepository } from "../repositories/subscription-plan.repository.interface";
import { ISubscriptionRepository } from "../repositories/subscription.repository.interface";
import { ISubscriptionUsageRepository } from "../repositories/subscription-usage.repository.interface";
import { SubscriptionPlanChangeService } from "./subscription-plan-change.service";

describe("SubscriptionPlanChangeService", () => {
  let service: SubscriptionPlanChangeService;
  let mockSubRepo: jest.Mocked<ISubscriptionRepository>;
  let mockPlanRepo: jest.Mocked<ISubscriptionPlanRepository>;
  let mockUsageRepo: jest.Mocked<ISubscriptionUsageRepository>;
  let mockAuditLogRepo: jest.Mocked<IAuditLogRepository>;
  let mockTxManager: jest.Mocked<ITransactionManager>;

  const starterPlan = SubscriptionPlanEntity.create({
    id: "plan-starter-id",
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
    id: "plan-pro-id",
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
    id: "plan-ent-id",
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

  let activeProSub: SubscriptionEntity;

  beforeEach(() => {
    mockSubRepo = {
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

    mockPlanRepo = {
      findById: jest.fn(),
      findByTier: jest.fn(),
      findAll: jest.fn(),
      save: jest.fn(),
      upsertDefaultPlans: jest.fn(),
    };

    mockUsageRepo = {
      countActiveAnimals: jest.fn().mockResolvedValue(10),
      countFarmMembers: jest.fn().mockResolvedValue(1),
    };

    mockAuditLogRepo = {
      record: jest.fn().mockResolvedValue({} as any),
      findByEntity: jest.fn(),
      findByTraceId: jest.fn(),
      query: jest.fn(),
    };

    mockTxManager = {
      run: jest.fn().mockImplementation((cb) => cb({} as any)),
    };

    service = new SubscriptionPlanChangeService(
      mockSubRepo,
      mockPlanRepo,
      mockUsageRepo,
      mockAuditLogRepo,
      mockTxManager,
    );

    const periodStart = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000); // 10 days ago
    const periodEnd = new Date(Date.now() + 20 * 24 * 60 * 60 * 1000); // 20 days remaining

    activeProSub = SubscriptionEntity.createActive({
      id: "sub-123",
      userId: "user-abc",
      farmId: "farm-xyz",
      planId: proPlan.id,
      plan: proPlan,
      periodEnd,
      now: periodStart,
    });
  });

  describe("previewPlanChange", () => {
    it("should calculate upgrade proration breakdown with no quota violations", () => {
      mockSubRepo.findById.mockResolvedValue(activeProSub);
      mockPlanRepo.findByTier.mockResolvedValue(enterprisePlan);

      return service
        .previewPlanChange("sub-123", {
          targetTier: SubscriptionTier.ENTERPRISE,
          billingInterval: SubscriptionBillingInterval.MONTHLY,
        })
        .then((preview) => {
          expect(preview.subscriptionId).toBe("sub-123");
          expect(preview.farmId).toBe("farm-xyz");
          expect(preview.canProceed).toBe(true);
          expect(preview.quotaViolations).toHaveLength(0);
          expect(preview.proration.changeType).toBe(SubscriptionPlanChangeType.UPGRADE);
          expect(preview.proration.targetPlanPriceCents).toBe(2900);
          expect(preview.proration.netAmountDueCents).toBeGreaterThan(0);
        });
    });

    it("should flag quota violation when attempting to downgrade with animal usage exceeding lower tier", () => {
      mockSubRepo.findById.mockResolvedValue(activeProSub);
      mockPlanRepo.findByTier.mockResolvedValue(starterPlan);
      mockUsageRepo.countActiveAnimals.mockResolvedValue(15); // Starter max is 5

      return service
        .previewPlanChange("sub-123", {
          targetTier: SubscriptionTier.STARTER,
          billingInterval: SubscriptionBillingInterval.MONTHLY,
        })
        .then((preview) => {
          expect(preview.canProceed).toBe(false);
          expect(preview.quotaViolations).toHaveLength(1);
          expect(preview.quotaViolations[0]?.resource).toBe("ANIMALS");
          expect(preview.quotaViolations[0]?.currentUsage).toBe(15);
          expect(preview.quotaViolations[0]?.targetLimit).toBe(5);
        });
    });
  });

  describe("changePlan", () => {
    it("should successfully upgrade to enterprise plan within database transaction and emit audit log", () => {
      mockSubRepo.findById.mockResolvedValue(activeProSub);
      mockPlanRepo.findByTier.mockResolvedValue(enterprisePlan);
      mockSubRepo.save.mockImplementation(async (sub) => sub);

      return service
        .changePlan("sub-123", "user-abc", {
          targetTier: SubscriptionTier.ENTERPRISE,
          billingInterval: SubscriptionBillingInterval.MONTHLY,
        })
        .then((result) => {
          expect(result.subscription.planId).toBe(enterprisePlan.id);
          expect(result.subscription.plan?.tier).toBe(SubscriptionTier.ENTERPRISE);
          expect(result.proration.changeType).toBe(SubscriptionPlanChangeType.UPGRADE);
          expect(result.transactionId).toBeDefined();

          expect(mockTxManager.run).toHaveBeenCalledTimes(1);
          expect(mockSubRepo.save).toHaveBeenCalledTimes(1);
          expect(mockAuditLogRepo.record).toHaveBeenCalledWith(
            expect.objectContaining({
              userId: "user-abc",
              action: "SUBSCRIPTION_PLAN_CHANGE",
              entityType: "Subscription",
              entityId: "sub-123",
            }),
            expect.anything(),
          );
        });
    });

    it("should reject downgrade if animal count violates target plan quota", () => {
      mockSubRepo.findById.mockResolvedValue(activeProSub);
      mockPlanRepo.findByTier.mockResolvedValue(starterPlan);
      mockUsageRepo.countActiveAnimals.mockResolvedValue(12); // Limit is 5

      return expect(
        service.changePlan("sub-123", "user-abc", {
          targetTier: SubscriptionTier.STARTER,
          billingInterval: SubscriptionBillingInterval.MONTHLY,
        }),
      ).rejects.toThrow(QuotaExceededDomainException);
    });

    it("should throw ValidationDomainException when attempting to change plan on a canceled subscription", () => {
      activeProSub.requestCancellation({ immediate: true });
      mockSubRepo.findById.mockResolvedValue(activeProSub);
      mockPlanRepo.findByTier.mockResolvedValue(enterprisePlan);

      return expect(
        service.changePlan("sub-123", "user-abc", {
          targetTier: SubscriptionTier.ENTERPRISE,
          billingInterval: SubscriptionBillingInterval.MONTHLY,
        }),
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw EntityNotFoundException if subscription does not exist", () => {
      mockSubRepo.findById.mockResolvedValue(null);

      return expect(
        service.changePlan("non-existent", "user-abc", {
          targetTier: SubscriptionTier.ENTERPRISE,
          billingInterval: SubscriptionBillingInterval.MONTHLY,
        }),
      ).rejects.toThrow(EntityNotFoundException);
    });
  });
});
