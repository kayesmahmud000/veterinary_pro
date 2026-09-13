import { Queue } from "bullmq";
import { VaccineReminderJobPayload } from "@vetralink/shared-types";
import { VaccineReminderQueueService } from "./vaccine-reminder-queue.service";

describe("VaccineReminderQueueService", () => {
  let service: VaccineReminderQueueService;
  let queue: {
    add: jest.Mock;
  };

  const farmId = "11111111-1111-1111-1111-111111111111";

  beforeEach(() => {
    queue = {
      add: jest.fn().mockResolvedValue({ id: "job-123" }),
    };

    service = new VaccineReminderQueueService(
      queue as unknown as Queue<VaccineReminderJobPayload>
    );
  });

  describe("onModuleInit", () => {
    it("should register repeatable daily cron job", async () => {
      await service.onModuleInit();

      expect(queue.add).toHaveBeenCalledWith(
        "SCAN_ALL_FARMS",
        expect.objectContaining({
          jobType: "SCAN_ALL_FARMS",
        }),
        expect.objectContaining({
          repeat: { pattern: "0 6 * * *" },
          jobId: "cron-daily-vaccine-reminder-scan",
        })
      );
    });
  });

  describe("dispatchAllFarmsScan", () => {
    it("should enqueue SCAN_ALL_FARMS job and return job id", async () => {
      const jobId = await service.dispatchAllFarmsScan("trace-1");

      expect(queue.add).toHaveBeenCalledWith(
        "SCAN_ALL_FARMS",
        expect.objectContaining({
          jobType: "SCAN_ALL_FARMS",
          traceId: "trace-1",
        }),
        expect.anything()
      );
      expect(jobId).toBe("job-123");
    });
  });

  describe("dispatchFarmScan", () => {
    it("should enqueue SCAN_FARM job with params", async () => {
      const jobId = await service.dispatchFarmScan(
        farmId,
        "2026-09-13",
        7,
        false,
        "trace-2"
      );

      expect(queue.add).toHaveBeenCalledWith(
        "SCAN_FARM",
        expect.objectContaining({
          jobType: "SCAN_FARM",
          farmId,
          asOfDate: "2026-09-13",
          daysAhead: 7,
          dryRun: false,
          traceId: "trace-2",
        }),
        expect.anything()
      );
      expect(jobId).toBe("job-123");
    });
  });

  describe("dispatchReminder", () => {
    it("should enqueue DISPATCH_REMINDER job", async () => {
      const payload: VaccineReminderJobPayload = {
        jobType: "DISPATCH_REMINDER",
        reminderDetails: {
          farmId,
          vaccineRecordId: "rec-1",
          animalId: "anim-1",
          tagNumber: "COW-001",
          species: "COW",
          recordType: "VACCINATION",
          vaccineName: "FMD",
          dueDate: "2026-09-20",
          milestone: "SEVEN_DAYS" as any,
        },
      };

      const jobId = await service.dispatchReminder(payload);

      expect(queue.add).toHaveBeenCalledWith(
        "DISPATCH_REMINDER",
        payload,
        expect.anything()
      );
      expect(jobId).toBe("job-123");
    });
  });
});
