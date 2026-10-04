import { Job } from "bullmq";
import { DunningJobPayload, DunningStage } from "@vetralink/shared-types";
import { ISubscriptionDunningService } from "../services/subscription-dunning.service.interface";
import { SubscriptionDunningProcessor } from "./subscription-dunning.processor";

describe("SubscriptionDunningProcessor", () => {
  let processor: SubscriptionDunningProcessor;
  let dunningService: jest.Mocked<ISubscriptionDunningService>;

  beforeEach(() => {
    dunningService = {
      scanAndDispatchDunning: jest.fn().mockResolvedValue({
        scannedCount: 1,
        eligibleCount: 1,
        dispatchedCount: 1,
        skippedCount: 0,
        failedCount: 0,
        details: [],
      }),
      dispatchDunningStage: jest.fn().mockResolvedValue({
        id: "log-1",
        subscriptionId: "sub-1",
        stage: DunningStage.DAY_1,
      } as any),
      getDunningLogs: jest.fn(),
    };

    processor = new SubscriptionDunningProcessor(dunningService);
  });

  it("should process SCAN_ALL_PAST_DUE job", async () => {
    const job = {
      id: "job-1",
      name: "SCAN_ALL_PAST_DUE",
      data: {
        jobType: "SCAN_ALL_PAST_DUE",
        dryRun: false,
        traceId: "trace-1",
      } as DunningJobPayload,
      updateProgress: jest.fn().mockResolvedValue(undefined),
    } as unknown as Job<DunningJobPayload>;

    const result = await processor.process(job);

    expect(dunningService.scanAndDispatchDunning).toHaveBeenCalledWith(
      expect.objectContaining({ dryRun: false }),
      "trace-1",
    );
    expect(job.updateProgress).toHaveBeenCalledWith(100);
    expect(result).toBeDefined();
  });

  it("should process DISPATCH_DUNNING_STAGE job", async () => {
    const job = {
      id: "job-2",
      name: "DISPATCH_DUNNING_STAGE",
      data: {
        jobType: "DISPATCH_DUNNING_STAGE",
        subscriptionId: "sub-123",
        stage: DunningStage.DAY_1,
        gatewayInvoiceId: "in_123",
        traceId: "trace-2",
      } as DunningJobPayload,
      updateProgress: jest.fn().mockResolvedValue(undefined),
    } as unknown as Job<DunningJobPayload>;

    const result = await processor.process(job);

    expect(dunningService.dispatchDunningStage).toHaveBeenCalledWith(
      expect.objectContaining({
        subscriptionId: "sub-123",
        stage: DunningStage.DAY_1,
        gatewayInvoiceId: "in_123",
        traceId: "trace-2",
      }),
    );
    expect(job.updateProgress).toHaveBeenCalledWith(100);
    expect(result).toBeDefined();
  });

  it("should throw error if subscriptionId is missing in DISPATCH_DUNNING_STAGE", async () => {
    const job = {
      id: "job-3",
      name: "DISPATCH_DUNNING_STAGE",
      data: {
        jobType: "DISPATCH_DUNNING_STAGE",
        stage: DunningStage.DAY_1,
      } as DunningJobPayload,
      updateProgress: jest.fn().mockResolvedValue(undefined),
    } as unknown as Job<DunningJobPayload>;

    await expect(processor.process(job)).rejects.toThrow(
      /DISPATCH_DUNNING_STAGE requires subscriptionId and stage/,
    );
  });
});
