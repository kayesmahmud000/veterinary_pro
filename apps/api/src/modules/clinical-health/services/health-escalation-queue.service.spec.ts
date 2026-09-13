import { Queue } from "bullmq";
import {
  HealthEscalationAction,
  HealthEscalationJobPayload,
  HealthEscalationLevel,
} from "@vetralink/shared-types";
import { HealthEscalationQueueService } from "./health-escalation-queue.service";

describe("HealthEscalationQueueService", () => {
  let service: HealthEscalationQueueService;
  let queue: {
    add: jest.Mock;
  };

  const farmId = "11111111-1111-1111-1111-111111111111";

  beforeEach(() => {
    queue = {
      add: jest.fn().mockResolvedValue({ id: "job-esc-123" }),
    };

    service = new HealthEscalationQueueService(
      queue as unknown as Queue<HealthEscalationJobPayload>
    );
  });

  describe("onModuleInit", () => {
    it("should register repeatable 6-hour cron job", async () => {
      await service.onModuleInit();

      expect(queue.add).toHaveBeenCalledWith(
        "SCAN_ALL_FARMS",
        expect.objectContaining({
          jobType: "SCAN_ALL_FARMS",
        }),
        expect.objectContaining({
          repeat: { pattern: "0 */6 * * *" },
          jobId: "cron-health-escalation-scan",
        })
      );
    });
  });

  describe("dispatchAllFarmsScan", () => {
    it("should enqueue SCAN_ALL_FARMS job and return job id", async () => {
      const jobId = await service.dispatchAllFarmsScan("trace-esc-1");

      expect(queue.add).toHaveBeenCalledWith(
        "SCAN_ALL_FARMS",
        expect.objectContaining({
          jobType: "SCAN_ALL_FARMS",
          traceId: "trace-esc-1",
        }),
        expect.anything()
      );
      expect(jobId).toBe("job-esc-123");
    });
  });

  describe("dispatchFarmScan", () => {
    it("should enqueue SCAN_FARM job with params", async () => {
      const jobId = await service.dispatchFarmScan(
        farmId,
        "2026-09-13",
        true,
        "trace-esc-2"
      );

      expect(queue.add).toHaveBeenCalledWith(
        "SCAN_FARM",
        expect.objectContaining({
          jobType: "SCAN_FARM",
          farmId,
          asOfDate: "2026-09-13",
          dryRun: true,
          traceId: "trace-esc-2",
        }),
        expect.anything()
      );
      expect(jobId).toBe("job-esc-123");
    });
  });

  describe("dispatchEscalation", () => {
    it("should enqueue ESCALATE_INCIDENT job", async () => {
      const payload: HealthEscalationJobPayload = {
        jobType: "ESCALATE_INCIDENT",
        incidentDetails: {
          farmId,
          healthRecordId: "rec-1",
          animalId: "anim-1",
          tagNumber: "COW-042",
          species: "COW",
          severity: "CRITICAL",
          symptoms: "High fever",
          diagnosis: "BRD",
          targetLevel: HealthEscalationLevel.LEVEL_1_STAFF_ALERT,
          hoursUnresolved: 24,
        },
      };

      const jobId = await service.dispatchEscalation(payload);

      expect(queue.add).toHaveBeenCalledWith(
        "ESCALATE_INCIDENT",
        payload,
        expect.anything()
      );
      expect(jobId).toBe("job-esc-123");
    });
  });
});
