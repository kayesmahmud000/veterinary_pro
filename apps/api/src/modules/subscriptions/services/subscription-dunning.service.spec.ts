import {
  DunningChannel,
  DunningStage,
  DunningStatus,
  SubscriptionStatus,
} from "@vetralink/shared-types";
import { EntityNotFoundException } from "../../../common/exceptions/domain.exception";
import { EnvService } from "../../../config/env.service";
import { IAuditLogRepository } from "../../audit/repositories/audit-log.repository.interface";
import { IEmailProvider } from "../../mail/interfaces/mail-provider.interface";
import { IUserRepository } from "../../users/repositories/user.repository.interface";
import { SubscriptionDunningLogEntity } from "../entities/subscription-dunning-log.entity";
import { SubscriptionEntity } from "../entities/subscription.entity";
import { ISubscriptionDunningLogRepository } from "../repositories/subscription-dunning-log.repository.interface";
import { ISubscriptionRepository } from "../repositories/subscription.repository.interface";
import { IStripePortalService } from "./stripe-portal.service.interface";
import { SubscriptionDunningService } from "./subscription-dunning.service";

describe("SubscriptionDunningService", () => {
  let service: SubscriptionDunningService;
  let subRepo: jest.Mocked<ISubscriptionRepository>;
  let dunningLogRepo: jest.Mocked<ISubscriptionDunningLogRepository>;
  let userRepo: jest.Mocked<IUserRepository>;
  let auditLogRepo: jest.Mocked<IAuditLogRepository>;
  let emailProvider: jest.Mocked<IEmailProvider>;
  let envService: jest.Mocked<EnvService>;
  let stripePortalService: jest.Mocked<IStripePortalService>;

  const mockUser = {
    id: "user-123",
    email: "farmer@vetralink.pro",
    name: "John Farmer",
  };

  const createMockPastDueSub = (daysPastDue: number, subId = "sub-123") => {
    const now = new Date("2026-09-20T12:00:00Z");
    const periodEnd = new Date(
      now.getTime() - daysPastDue * 24 * 60 * 60 * 1000,
    );
    const periodStart = new Date(
      periodEnd.getTime() - 30 * 24 * 60 * 60 * 1000,
    );

    return SubscriptionEntity.fromPersistence({
      id: subId,
      userId: mockUser.id,
      farmId: "farm-456",
      planId: "plan-pro",
      status: SubscriptionStatus.PAST_DUE,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      gatewaySubId: "sub_stripe_123",
      cancelAtPeriodEnd: false,
      createdAt: periodStart,
      updatedAt: periodEnd,
      user: mockUser,
      farm: { id: "farm-456", name: "Green Acres Dairy" },
      plan: {
        id: "plan-pro",
        name: "Pro Dairy",
        tier: "PRO",
        priceMonthlyCents: 4900,
        priceAnnualCents: 49000,
        maxAnimals: 30,
        features: {},
        isActive: true,
        createdAt: periodStart,
      },
    });
  };

  beforeEach(() => {
    subRepo = {
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

    dunningLogRepo = {
      findById: jest.fn(),
      findBySubscriptionAndStage: jest.fn(),
      findLatestBySubscription: jest.fn(),
      findMany: jest.fn(),
      save: jest.fn().mockImplementation((entity) => Promise.resolve(entity)),
    };

    userRepo = {
      findById: jest.fn().mockResolvedValue(mockUser as any),
      findByEmail: jest.fn(),
      findByPhoneHash: jest.fn(),
      save: jest.fn(),
    } as any;

    auditLogRepo = {
      record: jest.fn().mockResolvedValue(undefined),
      findRecentByEntity: jest.fn(),
    } as any;

    emailProvider = {
      providerName: "mock",
      sendEmail: jest.fn().mockResolvedValue({
        success: true,
        messageId: "msg-123",
        provider: "mock",
      }),
    };

    envService = {
      apiBaseUrl: "https://api.vetralink.pro",
      corsOrigins: ["https://vetralink.pro"],
    } as any;

    stripePortalService = {
      createCustomerPortalSession: jest.fn().mockResolvedValue({
        url: "https://billing.stripe.com/session/test_123",
      }),
    } as any;

    service = new SubscriptionDunningService(
      subRepo,
      dunningLogRepo,
      userRepo,
      auditLogRepo,
      emailProvider,
      envService,
      stripePortalService,
    );
  });

  describe("dispatchDunningStage", () => {
    it("should successfully dispatch DAY_1 dunning email and record log and audit", () => {
      const sub = createMockPastDueSub(1);
      subRepo.findById.mockResolvedValue(sub);
      dunningLogRepo.findBySubscriptionAndStage.mockResolvedValue(null);

      return service
        .dispatchDunningStage({
          subscriptionId: sub.id,
          stage: DunningStage.DAY_1,
          gatewayInvoiceId: "in_123",
        })
        .then((result) => {
          expect(result.subscriptionId).toBe(sub.id);
          expect(result.stage).toBe(DunningStage.DAY_1);
          expect(result.status).toBe(DunningStatus.SENT);
          expect(result.recipientEmail).toBe(mockUser.email);
          expect(emailProvider.sendEmail).toHaveBeenCalledWith(
            expect.objectContaining({
              to: mockUser.email,
              subject: expect.stringContaining("Action Required: Payment failed"),
            }),
          );
          expect(dunningLogRepo.save).toHaveBeenCalled();
          expect(auditLogRepo.record).toHaveBeenCalledWith(
            expect.objectContaining({
              action: "DUNNING_NOTIFICATION_SENT",
              entityId: sub.id,
            }),
          );
        });
    });

    it("should return existing log if stage was already sent today (idempotency)", () => {
      const sub = createMockPastDueSub(1);
      const existingLog = SubscriptionDunningLogEntity.create({
        subscriptionId: sub.id,
        userId: mockUser.id,
        stage: DunningStage.DAY_1,
        recipientEmail: mockUser.email,
        subject: "Notice",
        message: "Message",
      });

      dunningLogRepo.findBySubscriptionAndStage.mockResolvedValue(existingLog);

      return service
        .dispatchDunningStage({
          subscriptionId: sub.id,
          stage: DunningStage.DAY_1,
        })
        .then((result) => {
          expect(result.id).toBe(existingLog.id);
          expect(emailProvider.sendEmail).not.toHaveBeenCalled();
          expect(auditLogRepo.record).not.toHaveBeenCalled();
        });
    });

    it("should throw EntityNotFoundException if subscription does not exist", () => {
      subRepo.findById.mockResolvedValue(null);
      dunningLogRepo.findBySubscriptionAndStage.mockResolvedValue(null);

      return expect(
        service.dispatchDunningStage({
          subscriptionId: "nonexistent",
          stage: DunningStage.DAY_1,
        }),
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should mark log FAILED and record failure audit log if emailProvider fails", () => {
      const sub = createMockPastDueSub(3);
      subRepo.findById.mockResolvedValue(sub);
      dunningLogRepo.findBySubscriptionAndStage.mockResolvedValue(null);
      emailProvider.sendEmail.mockResolvedValue({
        success: false,
        error: "SMTP server unavailable",
        provider: "mock",
      });

      return service
        .dispatchDunningStage({
          subscriptionId: sub.id,
          stage: DunningStage.DAY_3,
        })
        .then((result) => {
          expect(result.status).toBe(DunningStatus.FAILED);
          expect(result.errorMessage).toBe("SMTP server unavailable");
          expect(auditLogRepo.record).toHaveBeenCalledWith(
            expect.objectContaining({
              action: "DUNNING_NOTIFICATION_FAILED",
            }),
          );
        });
    });
  });

  describe("scanAndDispatchDunning", () => {
    it("should scan past-due subscriptions and dispatch appropriate stages", () => {
      const subDay1 = createMockPastDueSub(1, "sub-day-1");
      const subDay3 = createMockPastDueSub(3, "sub-day-3");
      const subDay7 = createMockPastDueSub(7, "sub-day-7");

      subRepo.findPastDueSubscriptions.mockResolvedValue([
        subDay1,
        subDay3,
        subDay7,
      ]);
      subRepo.findById.mockImplementation((id) => {
        if (id === "sub-day-1") return Promise.resolve(subDay1);
        if (id === "sub-day-3") return Promise.resolve(subDay3);
        if (id === "sub-day-7") return Promise.resolve(subDay7);
        return Promise.resolve(null);
      });
      dunningLogRepo.findBySubscriptionAndStage.mockResolvedValue(null);

      return service
        .scanAndDispatchDunning({ asOfDate: "2026-09-20T12:00:00Z" })
        .then((result) => {
          expect(result.scannedCount).toBe(3);
          expect(result.eligibleCount).toBe(3);
          expect(result.dispatchedCount).toBe(3);
          expect(result.skippedCount).toBe(0);
          expect(result.failedCount).toBe(0);
          expect(emailProvider.sendEmail).toHaveBeenCalledTimes(3);
        });
    });

    it("should skip already dispatched stages in same calendar day", () => {
      const subDay1 = createMockPastDueSub(1, "sub-day-1");
      subRepo.findPastDueSubscriptions.mockResolvedValue([subDay1]);

      const existingLog = SubscriptionDunningLogEntity.create({
        subscriptionId: subDay1.id,
        userId: mockUser.id,
        stage: DunningStage.DAY_1,
        status: DunningStatus.SENT,
        recipientEmail: mockUser.email,
        subject: "Notice",
        message: "Message",
        dispatchedDate: "2026-09-20",
      });
      dunningLogRepo.findBySubscriptionAndStage.mockResolvedValue(existingLog);

      return service
        .scanAndDispatchDunning({ asOfDate: "2026-09-20T12:00:00Z" })
        .then((result) => {
          expect(result.scannedCount).toBe(1);
          expect(result.eligibleCount).toBe(1);
          expect(result.dispatchedCount).toBe(0);
          expect(result.skippedCount).toBe(1);
          expect(emailProvider.sendEmail).not.toHaveBeenCalled();
        });
    });

    it("should respect dryRun without sending emails", () => {
      const subDay3 = createMockPastDueSub(3, "sub-day-3");
      subRepo.findPastDueSubscriptions.mockResolvedValue([subDay3]);
      dunningLogRepo.findBySubscriptionAndStage.mockResolvedValue(null);

      return service
        .scanAndDispatchDunning({
          asOfDate: "2026-09-20T12:00:00Z",
          dryRun: true,
        })
        .then((result) => {
          expect(result.scannedCount).toBe(1);
          expect(result.eligibleCount).toBe(1);
          expect(result.dispatchedCount).toBe(0);
          expect(result.skippedCount).toBe(1);
          expect(result.details[0]?.message).toContain("[DryRun]");
          expect(emailProvider.sendEmail).not.toHaveBeenCalled();
        });
    });
  });

  describe("getDunningLogs", () => {
    it("should return formatted dunning logs and total count", () => {
      const log = SubscriptionDunningLogEntity.create({
        subscriptionId: "sub-1",
        userId: mockUser.id,
        stage: DunningStage.DAY_1,
        recipientEmail: mockUser.email,
        subject: "Subject",
        message: "Message",
      });

      dunningLogRepo.findMany.mockResolvedValue({
        items: [log],
        total: 1,
      });

      return service.getDunningLogs({ page: 1, limit: 10 }).then((res) => {
        expect(res.total).toBe(1);
        expect(res.items[0]?.id).toBe(log.id);
        expect(res.items[0]?.stage).toBe(DunningStage.DAY_1);
      });
    });
  });
});
