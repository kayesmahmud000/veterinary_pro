import { Queue } from "bullmq";
import { DunningStage } from "@vetralink/shared-types";
import { SubscriptionDunningQueueService } from "./subscription-dunning-queue.service";

describe("SubscriptionDunningQueueService", () => {
  let service: SubscriptionDunningQueueService;
  let queue: jest.Mocked<Queue>;

  beforeEach(() => {
    queue = {
      add: jest.fn().mockResolvedValue({ id: "job-123" } as any),
    } as any;

    service = new SubscriptionDunningQueueService(queue);
  });

  describe("onModuleInit", () => {
    it("should register repeatable daily cron job at 07:00 UTC", async () => {
      await service.onModuleInit();

      expect(queue.add).toHaveBeenCalledWith(
        "SCAN_ALL_PAST_DUE",
        expect.objectContaining({
          jobType: "SCAN_ALL_PAST_DUE",
        }),
        expect.objectContaining({
          repeat: { pattern: "0 7 * * *" },
          jobId: "cron-daily-subscription-dunning-scan",
        }),
      );
    });
  });

  describe("dispatchScan", () => {
    it("should enqueue SCAN_ALL_PAST_DUE job with options", async () => {
      const jobId = await service.dispatchScan({ dryRun: true }, "trace-1");

      expect(jobId).toBe("job-123");
      expect(queue.add).toHaveBeenCalledWith(
        "SCAN_ALL_PAST_DUE",
        expect.objectContaining({
          jobType: "SCAN_ALL_PAST_DUE",
          dryRun: true,
          traceId: "trace-1",
        }),
        expect.objectContaining({
          attempts: 2,
        }),
      );
    });
  });

  describe("dispatchStage", () => {
    it("should enqueue DISPATCH_DUNNING_STAGE job for specific subscription", async () => {
      const jobId = await service.dispatchStage({
        subscriptionId: "sub-123",
        stage: DunningStage.DAY_1,
        gatewayInvoiceId: "in_123",
        traceId: "trace-2",
      });

      expect(jobId).toBe("job-123");
      expect(queue.add).toHaveBeenCalledWith(
        "DISPATCH_DUNNING_STAGE",
        expect.objectContaining({
          jobType: "DISPATCH_DUNNING_STAGE",
          subscriptionId: "sub-123",
          stage: DunningStage.DAY_1,
          gatewayInvoiceId: "in_123",
          traceId: "trace-2",
        }),
        expect.objectContaining({
          attempts: 3,
        }),
      );
    });
  });
});
