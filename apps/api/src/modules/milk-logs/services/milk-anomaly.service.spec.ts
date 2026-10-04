import {
  AnimalGender,
  AnimalSpecies,
  AnimalStatus,
  MilkAnomalySeverity,
  MilkAnomalyStatus,
  MilkSession,
} from "@vetralink/shared-types";
import {
  EntityNotFoundException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import { AnimalEntity } from "../../animals/entities/animal.entity";
import { IAnimalRepository } from "../../animals/repositories/animal.repository.interface";
import { IAuditLogRepository } from "../../audit/repositories/audit-log.repository.interface";
import { ITransactionManager } from "../../prisma/interfaces/transaction.interface";
import { MilkLogEntity } from "../entities/milk-log.entity";
import { MilkYieldAnomalyEntity } from "../entities/milk-yield-anomaly.entity";
import { IMilkLogRepository } from "../repositories/milk-log.repository.interface";
import { IMilkYieldAnomalyRepository } from "../repositories/milk-yield-anomaly.repository.interface";
import { IMilkAnomalyQueueService } from "./milk-anomaly-queue.service.interface";
import { MilkAnomalyService } from "./milk-anomaly.service";
import { parseYmdToDate } from "../utils/milk-yield-analytics.util";

describe("MilkAnomalyService", () => {
  let service: MilkAnomalyService;
  let anomalyRepository: jest.Mocked<IMilkYieldAnomalyRepository>;
  let milkLogRepository: jest.Mocked<IMilkLogRepository>;
  let animalRepository: jest.Mocked<IAnimalRepository>;
  let auditLogRepository: jest.Mocked<IAuditLogRepository>;
  let anomalyQueueService: jest.Mocked<IMilkAnomalyQueueService>;
  let transactionManager: jest.Mocked<ITransactionManager>;

  const farmId = "11111111-1111-1111-1111-111111111111";
  const animalId = "22222222-2222-2222-2222-222222222222";
  const vetUserId = "33333333-3333-3333-3333-333333333333";
  const targetDate = parseYmdToDate("2026-09-13");

  const mockCow = AnimalEntity.create({
    id: animalId,
    farmId,
    tagNumber: "COW-001",
    species: AnimalSpecies.COW,
    gender: AnimalGender.FEMALE,
    status: AnimalStatus.ACTIVE,
  });

  const createMockMilkLog = (
    dateStr: string,
    yieldLiters: number,
    session: MilkSession = MilkSession.MORNING
  ): MilkLogEntity => {
    return new MilkLogEntity({
      id: crypto.randomUUID(),
      farmId,
      animalId,
      recordedById: vetUserId,
      session,
      yieldLiters,
      fatPercent: null,
      snfPercent: null,
      loggedDate: parseYmdToDate(dateStr),
      syncVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  beforeEach(() => {
    anomalyRepository = {
      upsert: jest.fn().mockImplementation((e) => Promise.resolve(e)),
      save: jest.fn().mockImplementation((e) => Promise.resolve(e)),
      findById: jest.fn(),
      findByAnimalAndDate: jest.fn(),
      findMany: jest.fn(),
    };

    milkLogRepository = {
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findById: jest.fn(),
      findBySessionAndDate: jest.fn(),
      findBulkBySessionAndDate: jest.fn(),
      findMany: jest.fn(),
      findLogsForAnalytics: jest.fn(),
      findLogsForExport: jest.fn(),
    };

    animalRepository = {
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findByTagNumber: jest.fn(),
      findByRfidNumber: jest.fn(),
      findByIdentifier: jest.fn(),
      findMany: jest.fn(),
      existsActiveTag: jest.fn(),
      existsActiveRfid: jest.fn(),
      softDelete: jest.fn(),
      findAncestors: jest.fn(),
      findDirectOffspring: jest.fn(),
      findManyByIds: jest.fn(),
      getFarmName: jest.fn(),
    };

    auditLogRepository = {
      record: jest.fn().mockResolvedValue(undefined as any),
      findByEntity: jest.fn(),
      findByTraceId: jest.fn(),
      query: jest.fn(),
    };

    anomalyQueueService = {
      dispatchAnimalDropCheck: jest.fn().mockResolvedValue("job-1"),
      dispatchFarmDailyScan: jest.fn().mockResolvedValue("job-scan-1"),
    };

    transactionManager = {
      run: jest.fn().mockImplementation((cb) => cb({} as any)),
    };

    service = new MilkAnomalyService(
      anomalyRepository,
      milkLogRepository,
      animalRepository,
      auditLogRepository,
      anomalyQueueService,
      transactionManager
    );
  });

  describe("evaluateAnimalYieldDrop", () => {
    it("should return null if animal does not exist in farm", async () => {
      animalRepository.findById.mockResolvedValueOnce(null);

      const result = await service.evaluateAnimalYieldDrop(
        farmId,
        animalId,
        targetDate
      );
      expect(result).toBeNull();
    });

    it("should return null if animal is biologically male", async () => {
      const bull = AnimalEntity.create({
        id: "bull-1",
        farmId,
        tagNumber: "BULL-1",
        species: AnimalSpecies.COW,
        gender: AnimalGender.MALE,
        status: AnimalStatus.ACTIVE,
      });
      animalRepository.findById.mockResolvedValueOnce(bull);

      const result = await service.evaluateAnimalYieldDrop(
        farmId,
        "bull-1",
        targetDate
      );
      expect(result).toBeNull();
    });

    it("should return null if target day has zero milk logs recorded", async () => {
      animalRepository.findById.mockResolvedValueOnce(mockCow);
      milkLogRepository.findLogsForAnalytics.mockResolvedValueOnce([]); // No current day logs

      const result = await service.evaluateAnimalYieldDrop(
        farmId,
        animalId,
        targetDate
      );
      expect(result).toBeNull();
    });

    it("should return null if fewer than 2 active baseline days exist in trailing 7 days", async () => {
      animalRepository.findById.mockResolvedValueOnce(mockCow);

      // Current logs: 15L today
      milkLogRepository.findLogsForAnalytics
        .mockResolvedValueOnce([createMockMilkLog("2026-09-13", 15)])
        // Baseline logs: only 1 day of history
        .mockResolvedValueOnce([createMockMilkLog("2026-09-12", 20)]);

      const result = await service.evaluateAnimalYieldDrop(
        farmId,
        animalId,
        targetDate
      );
      expect(result).toBeNull();
    });

    it("should return null if baseline yield is below 2.0L (e.g. dry or weaning cow)", async () => {
      animalRepository.findById.mockResolvedValueOnce(mockCow);

      // Current logs: 0.8L today
      milkLogRepository.findLogsForAnalytics
        .mockResolvedValueOnce([createMockMilkLog("2026-09-13", 0.8)])
        // Baseline logs: 1.5L daily average
        .mockResolvedValueOnce([
          createMockMilkLog("2026-09-11", 1.5),
          createMockMilkLog("2026-09-12", 1.5),
        ]);

      const result = await service.evaluateAnimalYieldDrop(
        farmId,
        animalId,
        targetDate
      );
      expect(result).toBeNull();
    });

    it("should return null if drop percentage is under 20% (normal variation)", async () => {
      animalRepository.findById.mockResolvedValueOnce(mockCow);

      // Current logs: 18L today
      milkLogRepository.findLogsForAnalytics
        .mockResolvedValueOnce([createMockMilkLog("2026-09-13", 18)])
        // Baseline: 20L average (drop = 10%)
        .mockResolvedValueOnce([
          createMockMilkLog("2026-09-10", 20),
          createMockMilkLog("2026-09-11", 20),
          createMockMilkLog("2026-09-12", 20),
        ]);

      const result = await service.evaluateAnimalYieldDrop(
        farmId,
        animalId,
        targetDate
      );
      expect(result).toBeNull();
    });

    it("should flag LOW severity anomaly if drop is between 20% and 29%", async () => {
      animalRepository.findById.mockResolvedValueOnce(mockCow);

      // Current: 15L today (20L baseline -> 25% drop)
      milkLogRepository.findLogsForAnalytics
        .mockResolvedValueOnce([createMockMilkLog("2026-09-13", 15)])
        .mockResolvedValueOnce([
          createMockMilkLog("2026-09-11", 20),
          createMockMilkLog("2026-09-12", 20),
        ]);

      anomalyRepository.findByAnimalAndDate.mockResolvedValueOnce(null);

      const result = await service.evaluateAnimalYieldDrop(
        farmId,
        animalId,
        targetDate
      );

      expect(result).not.toBeNull();
      expect(result!.severity).toBe(MilkAnomalySeverity.LOW);
      expect(result!.dropPercentage).toBe(25);
      expect(result!.currentYieldLiters).toBe(15);
      expect(result!.baselineYieldLiters).toBe(20);
      expect(anomalyRepository.upsert).toHaveBeenCalled();
      expect(auditLogRepository.record).toHaveBeenCalled();
    });

    it("should flag MEDIUM severity anomaly if drop is between 30% and 49%", async () => {
      animalRepository.findById.mockResolvedValueOnce(mockCow);

      // Current: 12L today (20L baseline -> 40% drop)
      milkLogRepository.findLogsForAnalytics
        .mockResolvedValueOnce([createMockMilkLog("2026-09-13", 12)])
        .mockResolvedValueOnce([
          createMockMilkLog("2026-09-11", 20),
          createMockMilkLog("2026-09-12", 20),
        ]);

      anomalyRepository.findByAnimalAndDate.mockResolvedValueOnce(null);

      const result = await service.evaluateAnimalYieldDrop(
        farmId,
        animalId,
        targetDate
      );

      expect(result).not.toBeNull();
      expect(result!.severity).toBe(MilkAnomalySeverity.MEDIUM);
      expect(result!.dropPercentage).toBe(40);
    });

    it("should flag CRITICAL severity anomaly if drop is >= 50%", async () => {
      animalRepository.findById.mockResolvedValueOnce(mockCow);

      // Current: 8L today (20L baseline -> 60% drop)
      milkLogRepository.findLogsForAnalytics
        .mockResolvedValueOnce([createMockMilkLog("2026-09-13", 8)])
        .mockResolvedValueOnce([
          createMockMilkLog("2026-09-11", 20),
          createMockMilkLog("2026-09-12", 20),
        ]);

      anomalyRepository.findByAnimalAndDate.mockResolvedValueOnce(null);

      const result = await service.evaluateAnimalYieldDrop(
        farmId,
        animalId,
        targetDate
      );

      expect(result).not.toBeNull();
      expect(result!.severity).toBe(MilkAnomalySeverity.CRITICAL);
      expect(result!.dropPercentage).toBe(60);
    });

    it("should update existing anomaly if already recorded for the same date", async () => {
      animalRepository.findById.mockResolvedValueOnce(mockCow);

      // Previously recorded anomaly for 2026-09-13
      const existing = MilkYieldAnomalyEntity.create({
        farmId,
        animalId,
        loggedDate: targetDate,
        currentYieldLiters: 10,
        baselineYieldLiters: 20,
        dropPercentage: 50,
        severity: MilkAnomalySeverity.CRITICAL,
      });

      milkLogRepository.findLogsForAnalytics
        .mockResolvedValueOnce([
          createMockMilkLog("2026-09-13", 10, MilkSession.MORNING),
          createMockMilkLog("2026-09-13", 4, MilkSession.AFTERNOON),
        ])
        .mockResolvedValueOnce([
          createMockMilkLog("2026-09-11", 20),
          createMockMilkLog("2026-09-12", 20),
        ]);

      anomalyRepository.findByAnimalAndDate.mockResolvedValueOnce(existing);

      const result = await service.evaluateAnimalYieldDrop(
        farmId,
        animalId,
        targetDate
      );

      expect(anomalyRepository.save).toHaveBeenCalledWith(existing);
      expect(result!.currentYieldLiters).toBe(14);
      expect(result!.dropPercentage).toBe(30);
      expect(result!.severity).toBe(MilkAnomalySeverity.MEDIUM);
    });
  });

  describe("runFarmDailyScan", () => {
    it("should scan all active female animals and return summary count", async () => {
      animalRepository.findMany.mockResolvedValueOnce({
        items: [mockCow],
        total: 1,
      });

      // Target day logs: 8L
      milkLogRepository.findLogsForAnalytics
        .mockResolvedValueOnce([createMockMilkLog("2026-09-13", 8)])
        .mockResolvedValueOnce([
          createMockMilkLog("2026-09-11", 20),
          createMockMilkLog("2026-09-12", 20),
        ]);
      animalRepository.findById.mockResolvedValueOnce(mockCow);
      anomalyRepository.findByAnimalAndDate.mockResolvedValueOnce(null);

      const result = await service.runFarmDailyScan(
        farmId,
        targetDate,
        vetUserId
      );

      expect(result.scannedAnimalsCount).toBe(1);
      expect(result.anomaliesDetectedCount).toBe(1);
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({ action: "FARM_ANOMALY_SCAN_EXECUTED" })
      );
    });
  });

  describe("acknowledgeAnomaly & resolveAnomaly", () => {
    const existing = MilkYieldAnomalyEntity.create({
      id: "anomaly-123",
      farmId,
      animalId,
      loggedDate: targetDate,
      currentYieldLiters: 10,
      baselineYieldLiters: 20,
      dropPercentage: 50,
      severity: MilkAnomalySeverity.CRITICAL,
    });

    it("should acknowledge anomaly and save", async () => {
      anomalyRepository.findById.mockResolvedValueOnce(existing);

      const result = await service.acknowledgeAnomaly(
        "anomaly-123",
        farmId,
        vetUserId,
        { clinicalNotes: "Examined cow" }
      );

      expect(result.status).toBe(MilkAnomalyStatus.ACKNOWLEDGED);
      expect(result.clinicalNotes).toBe("Examined cow");
      expect(anomalyRepository.save).toHaveBeenCalled();
    });

    it("should throw EntityNotFoundException when acknowledging non-existent anomaly", async () => {
      anomalyRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.acknowledgeAnomaly("anomaly-123", farmId, vetUserId, {})
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should resolve anomaly and save", async () => {
      anomalyRepository.findById.mockResolvedValueOnce(existing);

      const result = await service.resolveAnomaly(
        "anomaly-123",
        farmId,
        vetUserId,
        { resolutionNotes: "Treated and cured" }
      );

      expect(result.status).toBe(MilkAnomalyStatus.RESOLVED);
      expect(result.resolutionNotes).toBe("Treated and cured");
      expect(anomalyRepository.save).toHaveBeenCalled();
    });
  });

  describe("triggerFarmScan", () => {
    it("should dispatch BullMQ job and return job metadata", async () => {
      const result = await service.triggerFarmScan(farmId, vetUserId, {
        targetDate: "2026-09-13",
      });

      expect(anomalyQueueService.dispatchFarmDailyScan).toHaveBeenCalledWith(
        farmId,
        "2026-09-13",
        vetUserId
      );
      expect(result.jobId).toBe("job-scan-1");
      expect(result.targetDate).toBe("2026-09-13");
    });

    it("should reject future dates with ValidationDomainException", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);

      await expect(
        service.triggerFarmScan(farmId, vetUserId, {
          targetDate: futureDate.toISOString().split("T")[0]!,
        })
      ).rejects.toThrow(ValidationDomainException);
    });
  });
});
