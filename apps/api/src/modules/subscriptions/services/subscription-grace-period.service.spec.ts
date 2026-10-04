import {
  SubscriptionAccessMode,
  SubscriptionStatus,
} from "@vetralink/shared-types";
import {
  SubscriptionReadOnlyException,
  SubscriptionSuspendedException,
} from "../../../common/exceptions/domain.exception";
import { EnvService } from "../../../config/env.service";
import { IAuditLogRepository } from "../../audit/repositories/audit-log.repository.interface";
import { ITransactionManager } from "../../prisma/interfaces/transaction.interface";
import { SubscriptionEntity } from "../entities/subscription.entity";
import { ISubscriptionRepository } from "../repositories/subscription.repository.interface";
import { IStripePortalService } from "./stripe-portal.service.interface";
import { SubscriptionGracePeriodService } from "./subscription-grace-period.service";

describe("SubscriptionGracePeriodService", () => {
  let service: SubscriptionGracePeriodService;
  let subRepo: jest.Mocked<ISubscriptionRepository>;
  let auditLogRepo: jest.Mocked<IAuditLogRepository>;
  let txManager: jest.Mocked<ITransactionManager>;
  let envService: jest.Mocked<EnvService>;
  let stripePortalService: jest.Mocked<IStripePortalService>;

  const now = new Date("2026-09-20T12:00:00.000Z");

  const createSubWithPastDueDays = (days: number, subId = "sub-123") => {
    const periodEnd = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
    const periodStart = new Date(periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000);

    return SubscriptionEntity.fromPersistence({
      id: subId,
      userId: "user-123",
      farmId: "farm-123",
      planId: "plan-pro",
      status: SubscriptionStatus.PAST_DUE,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      gatewaySubId: "sub_stripe",
      cancelAtPeriodEnd: false,
      createdAt: periodStart,
      updatedAt: periodEnd,
    });
  };

  beforeEach(() => {
    subRepo = {
      findById: jest.fn(),
      findByFarmId: jest.fn(),
      findByUserId: jest.fn(),
      findByGatewaySubId: jest.fn(),
      save: jest.fn().mockImplementation((s) => Promise.resolve(s)),
      findExpiredSubscriptions: jest.fn(),
      findPastDueSubscriptions: jest.fn(),
      findAllWithPlan: jest.fn(),
      findHistoricalSubscriptions: jest.fn(),
    };

    auditLogRepo = {
      record: jest.fn().mockResolvedValue(undefined),
      findByEntity: jest.fn(),
      findByTraceId: jest.fn(),
      query: jest.fn(),
    } as any;

    txManager = {
      run: jest.fn().mockImplementation(async (cb) => cb({} as any)),
    };

    envService = {
      corsOrigins: ["https://vetralink.pro"],
      apiBaseUrl: "https://api.vetralink.pro",
    } as any;

    stripePortalService = {
      createCustomerPortalSession: jest.fn().mockResolvedValue({
        url: "https://billing.stripe.com/session/test",
      }),
    } as any;

    service = new SubscriptionGracePeriodService(
      subRepo,
      auditLogRepo,
      txManager,
      envService,
      stripePortalService,
    );
  });

  describe("getAccessStatus", () => {
    it("should return FULL_ACCESS for active subscription", async () => {
      const activeSub = SubscriptionEntity.createActive({
        userId: "user-1",
        farmId: "farm-123",
        planId: "plan-pro",
        periodEnd: new Date("2026-10-01T00:00:00Z"),
        now,
      });
      subRepo.findByFarmId.mockResolvedValue(activeSub);

      const status = await service.getAccessStatus("farm-123", now);

      expect(status.accessMode).toBe(SubscriptionAccessMode.FULL_ACCESS);
      expect(status.canWrite).toBe(true);
      expect(status.canRead).toBe(true);
    });

    it("should return GRACE_PERIOD during Days 1-3 of PAST_DUE", async () => {
      const sub = createSubWithPastDueDays(2);
      subRepo.findByFarmId.mockResolvedValue(sub);

      const status = await service.getAccessStatus("farm-123", now);

      expect(status.accessMode).toBe(SubscriptionAccessMode.GRACE_PERIOD);
      expect(status.canWrite).toBe(true);
      expect(status.canRead).toBe(true);
      expect(status.gracePeriodDaysRemaining).toBe(1);
    });

    it("should return READ_ONLY during Days 4-7 of PAST_DUE", async () => {
      const sub = createSubWithPastDueDays(5);
      subRepo.findByFarmId.mockResolvedValue(sub);

      const status = await service.getAccessStatus("farm-123", now);

      expect(status.accessMode).toBe(SubscriptionAccessMode.READ_ONLY);
      expect(status.canWrite).toBe(false);
      expect(status.canRead).toBe(true);
      expect(status.daysPastDue).toBe(5);
    });

    it("should return SUSPENDED after Day 7 of PAST_DUE", async () => {
      const sub = createSubWithPastDueDays(8);
      subRepo.findByFarmId.mockResolvedValue(sub);

      const status = await service.getAccessStatus("farm-123", now);

      expect(status.accessMode).toBe(SubscriptionAccessMode.SUSPENDED);
      expect(status.canWrite).toBe(false);
      expect(status.canRead).toBe(false);
    });

    it("should return SUSPENDED when no subscription exists", async () => {
      subRepo.findByFarmId.mockResolvedValue(null);

      const status = await service.getAccessStatus("farm-123", now);

      expect(status.accessMode).toBe(SubscriptionAccessMode.SUSPENDED);
      expect(status.canWrite).toBe(false);
      expect(status.canRead).toBe(false);
    });
  });

  describe("assertWriteAccess", () => {
    it("should allow write access when in GRACE_PERIOD", async () => {
      const sub = createSubWithPastDueDays(1);
      subRepo.findByFarmId.mockResolvedValue(sub);

      await expect(
        service.assertWriteAccess("farm-123", now),
      ).resolves.not.toThrow();
    });

    it("should throw SubscriptionReadOnlyException when in READ_ONLY mode", async () => {
      const sub = createSubWithPastDueDays(4);
      subRepo.findByFarmId.mockResolvedValue(sub);

      await expect(service.assertWriteAccess("farm-123", now)).rejects.toThrow(
        SubscriptionReadOnlyException,
      );
    });

    it("should throw SubscriptionSuspendedException when in SUSPENDED mode", async () => {
      const sub = createSubWithPastDueDays(9);
      subRepo.findByFarmId.mockResolvedValue(sub);

      await expect(service.assertWriteAccess("farm-123", now)).rejects.toThrow(
        SubscriptionSuspendedException,
      );
    });
  });

  describe("assertReadAccess", () => {
    it("should allow read access when in READ_ONLY mode", async () => {
      const sub = createSubWithPastDueDays(5);
      subRepo.findByFarmId.mockResolvedValue(sub);

      await expect(
        service.assertReadAccess("farm-123", now),
      ).resolves.not.toThrow();
    });

    it("should throw SubscriptionSuspendedException when in SUSPENDED mode", async () => {
      const sub = createSubWithPastDueDays(10);
      subRepo.findByFarmId.mockResolvedValue(sub);

      await expect(service.assertReadAccess("farm-123", now)).rejects.toThrow(
        SubscriptionSuspendedException,
      );
    });
  });

  describe("processSuspensions", () => {
    it("should suspend subscriptions past Day 7 and record audit log", async () => {
      const subDay2 = createSubWithPastDueDays(2, "sub-day-2");
      const subDay9 = createSubWithPastDueDays(9, "sub-day-9");

      subRepo.findPastDueSubscriptions.mockResolvedValue([subDay2, subDay9]);

      const result = await service.processSuspensions(now, "trace-suspension");

      expect(result.scannedCount).toBe(2);
      expect(result.suspendedCount).toBe(1);
      expect(result.details[0]?.subscriptionId).toBe("sub-day-9");
      expect(subDay9.status).toBe(SubscriptionStatus.EXPIRED);
      expect(subDay2.status).toBe(SubscriptionStatus.PAST_DUE);
      expect(auditLogRepo.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "SUBSCRIPTION_SUSPENDED_DUE_TO_DUNNING",
          entityId: "sub-day-9",
        }),
        expect.anything(),
      );
    });
  });
});
