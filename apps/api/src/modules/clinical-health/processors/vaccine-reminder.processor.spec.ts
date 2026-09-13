import { Job } from "bullmq";
import {
  ReminderMilestone,
  VaccineReminderJobPayload,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { IVaccineNotificationService } from "../services/vaccine-notification.service.interface";
import { VaccineReminderProcessor } from "./vaccine-reminder.processor";

describe("VaccineReminderProcessor", () => {
  let processor: VaccineReminderProcessor;
  let notificationService: jest.Mocked<IVaccineNotificationService>;
  let prisma: {
    farm: {
      findMany: jest.Mock;
    };
  };

  const farmId = "11111111-1111-1111-1111-111111111111";

  beforeEach(() => {
    notificationService = {
      processFarmDueReminders: jest.fn().mockResolvedValue({
        farmId,
        scanDate: "2026-09-13",
        totalScanned: 5,
        dueWithinHorizon: 2,
        remindersDispatched: 2,
        remindersSkipped: 0,
        remindersFailed: 0,
        details: [],
      }),
      dispatchReminderForRecord: jest.fn().mockResolvedValue([]),
      listReminderLogs: jest.fn(),
    };

    prisma = {
      farm: {
        findMany: jest.fn().mockResolvedValue([
          { id: farmId, name: "Green Valley Farm" },
        ]),
      },
    };

    processor = new VaccineReminderProcessor(
      notificationService,
      prisma as unknown as PrismaService
    );
  });

  describe("process", () => {
    it("should process SCAN_ALL_FARMS job across active farms", async () => {
      const job = {
        id: "job-1",
        data: {
          jobType: "SCAN_ALL_FARMS",
          asOfDate: "2026-09-13",
          daysAhead: 7,
          traceId: "trace-1",
        },
        updateProgress: jest.fn(),
      } as unknown as Job<VaccineReminderJobPayload>;

      const result = (await processor.process(job)) as any;

      expect(prisma.farm.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        select: { id: true, name: true },
      });
      expect(notificationService.processFarmDueReminders).toHaveBeenCalledWith(
        farmId,
        expect.any(Date),
        7,
        false,
        "trace-1"
      );
      expect(result.totalFarms).toBe(1);
      expect(result.processedFarms).toBe(1);
    });

    it("should process SCAN_FARM job for single farm", async () => {
      const job = {
        id: "job-2",
        data: {
          jobType: "SCAN_FARM",
          farmId,
          asOfDate: "2026-09-13",
          daysAhead: 7,
          dryRun: true,
          traceId: "trace-2",
        },
        updateProgress: jest.fn(),
      } as unknown as Job<VaccineReminderJobPayload>;

      const result = await processor.process(job);

      expect(notificationService.processFarmDueReminders).toHaveBeenCalledWith(
        farmId,
        expect.any(Date),
        7,
        true,
        "trace-2"
      );
      expect(result).toBeDefined();
    });

    it("should throw if farmId is missing for SCAN_FARM", async () => {
      const job = {
        id: "job-3",
        data: {
          jobType: "SCAN_FARM",
        },
        updateProgress: jest.fn(),
      } as unknown as Job<VaccineReminderJobPayload>;

      await expect(processor.process(job)).rejects.toThrow(
        "Invalid SCAN_FARM job"
      );
    });

    it("should process DISPATCH_REMINDER job", async () => {
      const job = {
        id: "job-4",
        data: {
          jobType: "DISPATCH_REMINDER",
          reminderDetails: {
            farmId,
            vaccineRecordId: "rec-1",
            animalId: "anim-1",
            tagNumber: "COW-042",
            species: "COW",
            recordType: "VACCINATION",
            vaccineName: "FMD",
            dueDate: "2026-09-20",
            milestone: ReminderMilestone.SEVEN_DAYS,
          },
          traceId: "trace-4",
        },
        updateProgress: jest.fn(),
      } as unknown as Job<VaccineReminderJobPayload>;

      await processor.process(job);

      expect(notificationService.dispatchReminderForRecord).toHaveBeenCalledWith(
        "rec-1",
        farmId,
        ReminderMilestone.SEVEN_DAYS,
        undefined,
        undefined,
        "trace-4"
      );
    });

    it("should throw for unsupported jobType", async () => {
      const job = {
        id: "job-5",
        data: {
          jobType: "UNSUPPORTED" as any,
        },
        updateProgress: jest.fn(),
      } as unknown as Job<VaccineReminderJobPayload>;

      await expect(processor.process(job)).rejects.toThrow(
        "Unsupported vaccine reminder jobType"
      );
    });
  });
});
