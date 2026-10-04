import { Job } from "bullmq";
import {
  MilkAnomalyJobPayload,
  MilkAnomalySeverity,
  MilkAnomalyStatus,
} from "@vetralink/shared-types";
import { IMilkAnomalyService } from "../services/milk-anomaly.service.interface";
import { MilkAnomalyProcessor } from "./milk-anomaly.processor";

describe("MilkAnomalyProcessor", () => {
  let processor: MilkAnomalyProcessor;
  let anomalyService: jest.Mocked<IMilkAnomalyService>;

  const farmId = "11111111-1111-1111-1111-111111111111";
  const animalId = "22222222-2222-2222-2222-222222222222";

  beforeEach(() => {
    anomalyService = {
      evaluateAnimalYieldDrop: jest.fn(),
      runFarmDailyScan: jest.fn(),
      queryAnomalies: jest.fn(),
      getAnomalyById: jest.fn(),
      acknowledgeAnomaly: jest.fn(),
      resolveAnomaly: jest.fn(),
      triggerFarmScan: jest.fn(),
    };

    processor = new MilkAnomalyProcessor(anomalyService);
  });

  const createMockJob = (
    data: MilkAnomalyJobPayload
  ): jest.Mocked<Job<MilkAnomalyJobPayload>> => {
    return {
      id: "job-1",
      data,
      updateProgress: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<Job<MilkAnomalyJobPayload>>;
  };

  it("should process ANIMAL_DROP_CHECK job and delegate to anomalyService", async () => {
    const mockAnomaly = {
      id: "anomaly-1",
      farmId,
      animalId,
      loggedDate: "2026-09-13",
      currentYieldLiters: 10,
      baselineYieldLiters: 20,
      dropPercentage: 50,
      severity: MilkAnomalySeverity.CRITICAL,
      status: MilkAnomalyStatus.DETECTED,
      acknowledgedById: null,
      acknowledgedAt: null,
      resolvedAt: null,
      clinicalNotes: null,
      resolutionNotes: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    anomalyService.evaluateAnimalYieldDrop.mockResolvedValueOnce(mockAnomaly);

    const job = createMockJob({
      jobType: "ANIMAL_DROP_CHECK",
      farmId,
      animalId,
      loggedDate: "2026-09-13",
      traceId: "trace-123",
    });

    const result = await processor.process(job);

    expect(anomalyService.evaluateAnimalYieldDrop).toHaveBeenCalledWith(
      farmId,
      animalId,
      new Date(Date.UTC(2026, 8, 13, 0, 0, 0, 0)),
      "trace-123"
    );
    expect(result).toEqual(mockAnomaly);
    expect(job.updateProgress).toHaveBeenCalledWith(100);
  });

  it("should throw error if ANIMAL_DROP_CHECK is missing animalId", async () => {
    const job = createMockJob({
      jobType: "ANIMAL_DROP_CHECK",
      farmId,
      loggedDate: "2026-09-13",
    });

    await expect(processor.process(job)).rejects.toThrow(
      "animalId is required"
    );
  });

  it("should process FARM_DAILY_SCAN job and delegate to anomalyService", async () => {
    const scanResult = {
      farmId,
      targetDate: "2026-09-13",
      scannedAnimalsCount: 15,
      anomaliesDetectedCount: 2,
      detectedAnomalyIds: ["a-1", "a-2"],
    };

    anomalyService.runFarmDailyScan.mockResolvedValueOnce(scanResult);

    const job = createMockJob({
      jobType: "FARM_DAILY_SCAN",
      farmId,
      loggedDate: "2026-09-13",
      actorUserId: "user-1",
      traceId: "trace-scan",
    });

    const result = await processor.process(job);

    expect(anomalyService.runFarmDailyScan).toHaveBeenCalledWith(
      farmId,
      new Date(Date.UTC(2026, 8, 13, 0, 0, 0, 0)),
      "user-1",
      "trace-scan"
    );
    expect(result).toEqual(scanResult);
  });
});
