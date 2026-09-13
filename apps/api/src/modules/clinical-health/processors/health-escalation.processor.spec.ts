import { Job } from "bullmq";
import { HealthEscalationJobPayload } from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { IHealthEscalationService } from "../services/health-escalation.service.interface";
import { HealthEscalationProcessor } from "./health-escalation.processor";

describe("HealthEscalationProcessor", () => {
  let processor: HealthEscalationProcessor;
  let escalationService: jest.Mocked<IHealthEscalationService>;
  let prisma: {
    farm: {
      findMany: jest.Mock;
    };
  };

  const farmId = "11111111-1111-1111-1111-111111111111";

  beforeEach(() => {
    escalationService = {
      processFarmEscalations: jest.fn().mockResolvedValue({
        farmId,
        scanDate: "2026-09-13",
        totalUnresolvedScanned: 5,
        totalEligibleForEscalation: 2,
        escalationsDispatched: 2,
        escalationsSkipped: 0,
        escalationsFailed: 0,
        details: [],
      }),
      listEscalationLogs: jest.fn(),
      listActiveEscalations: jest.fn(),
    };

    prisma = {
      farm: {
        findMany: jest.fn().mockResolvedValue([
          { id: farmId, name: "Green Valley Farm" },
        ]),
      },
    };

    processor = new HealthEscalationProcessor(
      escalationService,
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
          traceId: "trace-1",
        },
        updateProgress: jest.fn(),
      } as unknown as Job<HealthEscalationJobPayload>;

      const result = (await processor.process(job)) as any;

      expect(prisma.farm.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        select: { id: true, name: true },
      });
      expect(escalationService.processFarmEscalations).toHaveBeenCalledWith(
        farmId,
        expect.any(Date),
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
          dryRun: true,
          traceId: "trace-2",
        },
        updateProgress: jest.fn(),
      } as unknown as Job<HealthEscalationJobPayload>;

      const result = await processor.process(job);

      expect(escalationService.processFarmEscalations).toHaveBeenCalledWith(
        farmId,
        expect.any(Date),
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
      } as unknown as Job<HealthEscalationJobPayload>;

      await expect(processor.process(job)).rejects.toThrow(
        "Invalid SCAN_FARM job"
      );
    });

    it("should process ESCALATE_INCIDENT job", async () => {
      const job = {
        id: "job-4",
        data: {
          jobType: "ESCALATE_INCIDENT",
          farmId,
          traceId: "trace-4",
        },
        updateProgress: jest.fn(),
      } as unknown as Job<HealthEscalationJobPayload>;

      await processor.process(job);

      expect(escalationService.processFarmEscalations).toHaveBeenCalledWith(
        farmId,
        undefined,
        false,
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
      } as unknown as Job<HealthEscalationJobPayload>;

      await expect(processor.process(job)).rejects.toThrow(
        "Unsupported job type [UNSUPPORTED]"
      );
    });
  });
});
