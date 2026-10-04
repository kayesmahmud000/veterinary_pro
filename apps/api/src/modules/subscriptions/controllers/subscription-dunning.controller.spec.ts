import {
  DunningStage,
  DunningStatus,
  SubscriptionStatus,
  UserRole,
} from "@vetralink/shared-types";
import { SubscriptionDunningController } from "./subscription-dunning.controller";
import { ISubscriptionDunningQueueService } from "../services/subscription-dunning-queue.service.interface";
import { ISubscriptionDunningService } from "../services/subscription-dunning.service.interface";
import { ISubscriptionGracePeriodService } from "../services/subscription-grace-period.service.interface";

describe("SubscriptionDunningController", () => {
  let controller: SubscriptionDunningController;
  let dunningService: jest.Mocked<ISubscriptionDunningService>;
  let dunningQueueService: jest.Mocked<ISubscriptionDunningQueueService>;
  let gracePeriodService: jest.Mocked<ISubscriptionGracePeriodService>;

  const mockAdminUser = {
    sub: "admin-1",
    email: "admin@vetralink.pro",
    role: UserRole.SUPER_ADMIN,
  };

  const mockFarmerUser = {
    sub: "farmer-1",
    email: "farmer@vetralink.pro",
    role: UserRole.FARMER,
  };

  beforeEach(() => {
    dunningService = {
      scanAndDispatchDunning: jest.fn().mockResolvedValue({
        scannedCount: 2,
        eligibleCount: 2,
        dispatchedCount: 2,
        skippedCount: 0,
        failedCount: 0,
        details: [],
      }),
      dispatchDunningStage: jest.fn().mockResolvedValue({
        id: "log-1",
        subscriptionId: "sub-1",
        stage: DunningStage.DAY_1,
        status: DunningStatus.SENT,
        recipientEmail: "farmer@vetralink.pro",
      } as any),
      getDunningLogs: jest.fn().mockResolvedValue({
        items: [],
        total: 0,
      }),
    };

    dunningQueueService = {
      dispatchScan: jest.fn().mockResolvedValue("job-scan-123"),
      dispatchStage: jest.fn().mockResolvedValue("job-stage-456"),
    };

    gracePeriodService = {
      getAccessStatus: jest.fn(),
      assertWriteAccess: jest.fn(),
      assertReadAccess: jest.fn(),
      processSuspensions: jest.fn().mockResolvedValue({
        scannedCount: 3,
        suspendedCount: 1,
        details: [
          {
            subscriptionId: "sub-expired",
            userId: "user-1",
            farmId: "farm-1",
            status: SubscriptionStatus.EXPIRED,
            daysPastDue: 8,
            message: "Subscription suspended and marked EXPIRED",
          },
        ],
      }),
    };

    controller = new SubscriptionDunningController(
      dunningService,
      dunningQueueService,
      gracePeriodService,
    );
  });

  describe("processSuspensions", () => {
    it("should process suspensions for accounts past 7 days overdue", async () => {
      const result = await controller.processSuspensions(mockAdminUser as any);

      expect(gracePeriodService.processSuspensions).toHaveBeenCalledWith(
        undefined,
        `user-${mockAdminUser.sub}`,
      );
      expect(result.suspendedCount).toBe(1);
    });
  });

  describe("triggerScan", () => {
    it("should trigger synchronous dunning scan", async () => {
      const result = await controller.triggerScan(
        { dryRun: false },
        mockAdminUser as any,
      );

      expect(dunningService.scanAndDispatchDunning).toHaveBeenCalledWith(
        { dryRun: false },
        `user-${mockAdminUser.sub}`,
      );
      expect(result.scannedCount).toBe(2);
    });
  });

  describe("queueScan", () => {
    it("should enqueue background scan in BullMQ", async () => {
      const result = await controller.queueScan(
        { dryRun: true },
        mockAdminUser as any,
      );

      expect(dunningQueueService.dispatchScan).toHaveBeenCalledWith(
        { dryRun: true },
        `user-${mockAdminUser.sub}`,
      );
      expect(result.jobId).toBe("job-scan-123");
    });
  });

  describe("dispatchStage", () => {
    it("should dispatch a specific dunning stage", async () => {
      const result = await controller.dispatchStage(
        {
          subscriptionId: "sub-1",
          stage: DunningStage.DAY_1,
          gatewayInvoiceId: "in_123",
        },
        mockAdminUser as any,
      );

      expect(dunningService.dispatchDunningStage).toHaveBeenCalledWith({
        subscriptionId: "sub-1",
        stage: DunningStage.DAY_1,
        channel: undefined,
        gatewayInvoiceId: "in_123",
        traceId: `user-${mockAdminUser.sub}`,
      });
      expect(result.id).toBe("log-1");
    });
  });

  describe("getLogs", () => {
    it("should allow admin to query logs for any user", async () => {
      await controller.getLogs(
        { userId: "other-user", page: 1, limit: 10 },
        mockAdminUser as any,
      );

      expect(dunningService.getDunningLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "other-user",
        }),
      );
    });

    it("should restrict non-admin to their own userId", async () => {
      await controller.getLogs(
        { userId: "other-user", page: 1, limit: 10 },
        mockFarmerUser as any,
      );

      expect(dunningService.getDunningLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockFarmerUser.sub,
        }),
      );
    });
  });
});
