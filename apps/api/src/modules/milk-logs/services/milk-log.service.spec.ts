import {
  AnimalGender,
  AnimalSpecies,
  AnimalStatus,
  MilkSession,
} from "@vetralink/shared-types";
import {
  EntityConflictException,
  EntityNotFoundException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import { AnimalEntity } from "../../animals/entities/animal.entity";
import { IAnimalRepository } from "../../animals/repositories/animal.repository.interface";
import { IAuditLogRepository } from "../../audit/repositories/audit-log.repository.interface";
import { ITransactionManager } from "../../prisma/interfaces/transaction.interface";
import { MilkLogEntity } from "../entities/milk-log.entity";
import { IMilkLogRepository } from "../repositories/milk-log.repository.interface";
import { MilkLogService } from "./milk-log.service";

describe("MilkLogService", () => {
  let service: MilkLogService;
  let milkLogRepository: jest.Mocked<IMilkLogRepository>;
  let animalRepository: jest.Mocked<IAnimalRepository>;
  let auditLogRepository: jest.Mocked<IAuditLogRepository>;
  let transactionManager: jest.Mocked<ITransactionManager>;

  const farmId = "11111111-1111-1111-1111-111111111111";
  const actorUserId = "22222222-2222-2222-2222-222222222222";
  const femaleCowId = "33333333-3333-3333-3333-333333333333";
  const maleBullId = "44444444-4444-4444-4444-444444444444";
  const chickenId = "55555555-5555-5555-5555-555555555555";

  const femaleCow = AnimalEntity.create({
    id: femaleCowId,
    farmId,
    tagNumber: "COW-001",
    species: AnimalSpecies.COW,
    gender: AnimalGender.FEMALE,
    status: AnimalStatus.ACTIVE,
  });

  const maleBull = AnimalEntity.create({
    id: maleBullId,
    farmId,
    tagNumber: "BULL-001",
    species: AnimalSpecies.COW,
    gender: AnimalGender.MALE,
    status: AnimalStatus.ACTIVE,
  });

  const chicken = AnimalEntity.create({
    id: chickenId,
    farmId,
    tagNumber: "HEN-001",
    species: AnimalSpecies.POULTRY,
    gender: AnimalGender.FEMALE,
    status: AnimalStatus.ACTIVE,
  });

  beforeEach(() => {
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

    transactionManager = {
      run: jest.fn().mockImplementation((cb) => cb({} as any)),
    };

    const anomalyQueueService = {
      dispatchAnimalDropCheck: jest.fn().mockResolvedValue("job-1"),
      dispatchFarmDailyScan: jest.fn().mockResolvedValue("job-scan-1"),
    };

    service = new MilkLogService(
      milkLogRepository,
      animalRepository,
      auditLogRepository,
      anomalyQueueService,
      transactionManager
    );
  });

  describe("createMilkLog", () => {
    it("should successfully record a session milk yield for an active female dairy cow", async () => {
      animalRepository.findById.mockResolvedValue(femaleCow);
      milkLogRepository.findBySessionAndDate.mockResolvedValue(null);

      const savedEntity = MilkLogEntity.create({
        id: "log-1",
        farmId,
        animalId: femaleCowId,
        recordedById: actorUserId,
        session: MilkSession.MORNING,
        yieldLiters: 14.5,
        fatPercent: 3.8,
        snfPercent: 8.5,
        loggedDate: new Date("2026-09-13"),
      });

      milkLogRepository.create.mockResolvedValue(savedEntity);

      const result = await service.createMilkLog(farmId, actorUserId, {
        animalId: femaleCowId,
        session: MilkSession.MORNING,
        yieldLiters: 14.5,
        fatPercent: 3.8,
        snfPercent: 8.5,
        loggedDate: "2026-09-13",
      });

      expect(result.id).toBe("log-1");
      expect(result.yieldLiters).toBe(14.5);
      expect(result.session).toBe(MilkSession.MORNING);
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "MILK_LOG_RECORDED",
          entityType: "MilkLog",
        }),
        expect.anything()
      );
    });

    it("should throw EntityNotFoundException when animal does not exist in the farm", async () => {
      animalRepository.findById.mockResolvedValue(null);

      await expect(
        service.createMilkLog(farmId, actorUserId, {
          animalId: "non-existent-id",
          session: MilkSession.MORNING,
          yieldLiters: 12.0,
          loggedDate: "2026-09-13",
        })
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should reject milk logging for male animals with ValidationDomainException", async () => {
      animalRepository.findById.mockResolvedValue(maleBull);

      await expect(
        service.createMilkLog(farmId, actorUserId, {
          animalId: maleBullId,
          session: MilkSession.MORNING,
          yieldLiters: 10.0,
          loggedDate: "2026-09-13",
        })
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should reject milk logging for non-dairy species with ValidationDomainException", async () => {
      animalRepository.findById.mockResolvedValue(chicken);

      await expect(
        service.createMilkLog(farmId, actorUserId, {
          animalId: chickenId,
          session: MilkSession.MORNING,
          yieldLiters: 1.0,
          loggedDate: "2026-09-13",
        })
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should reject milk logging for deceased or sold animals", async () => {
      const deceasedCow = AnimalEntity.create({
        id: femaleCowId,
        farmId,
        tagNumber: "COW-DEC",
        species: AnimalSpecies.COW,
        gender: AnimalGender.FEMALE,
        status: AnimalStatus.DECEASED,
      });
      animalRepository.findById.mockResolvedValue(deceasedCow);

      await expect(
        service.createMilkLog(farmId, actorUserId, {
          animalId: femaleCowId,
          session: MilkSession.MORNING,
          yieldLiters: 10.0,
          loggedDate: "2026-09-13",
        })
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw EntityConflictException when duplicate session is entered for the same date", async () => {
      animalRepository.findById.mockResolvedValue(femaleCow);

      const existingLog = MilkLogEntity.create({
        farmId,
        animalId: femaleCowId,
        recordedById: actorUserId,
        session: MilkSession.MORNING,
        yieldLiters: 12.0,
        loggedDate: new Date("2026-09-13"),
      });
      milkLogRepository.findBySessionAndDate.mockResolvedValue(existingLog);

      await expect(
        service.createMilkLog(farmId, actorUserId, {
          animalId: femaleCowId,
          session: MilkSession.MORNING,
          yieldLiters: 14.0,
          loggedDate: "2026-09-13",
        })
      ).rejects.toThrow(EntityConflictException);
    });

    it("should reject future dates with ValidationDomainException", async () => {
      animalRepository.findById.mockResolvedValue(femaleCow);

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const futureDateString = futureDate.toISOString().split("T")[0]!;

      await expect(
        service.createMilkLog(farmId, actorUserId, {
          animalId: femaleCowId,
          session: MilkSession.MORNING,
          yieldLiters: 14.0,
          loggedDate: futureDateString,
        })
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should reject physiological yield extremes (>100L)", async () => {
      animalRepository.findById.mockResolvedValue(femaleCow);
      milkLogRepository.findBySessionAndDate.mockResolvedValue(null);

      await expect(
        service.createMilkLog(farmId, actorUserId, {
          animalId: femaleCowId,
          session: MilkSession.MORNING,
          yieldLiters: 150.0,
          loggedDate: "2026-09-13",
        })
      ).rejects.toThrow(ValidationDomainException);
    });
  });

  describe("updateMilkLog", () => {
    it("should successfully update milk yield and emit audit log", async () => {
      const existing = MilkLogEntity.create({
        id: "log-1",
        farmId,
        animalId: femaleCowId,
        recordedById: actorUserId,
        session: MilkSession.MORNING,
        yieldLiters: 14.0,
        loggedDate: new Date("2026-09-13"),
      });

      milkLogRepository.findById.mockResolvedValue(existing);
      milkLogRepository.update.mockResolvedValue(existing);

      const result = await service.updateMilkLog("log-1", farmId, actorUserId, {
        yieldLiters: 16.5,
        fatPercent: 4.2,
      });

      expect(result.yieldLiters).toBe(16.5);
      expect(result.fatPercent).toBe(4.2);
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "MILK_LOG_UPDATED",
          entityType: "MilkLog",
        }),
        expect.anything()
      );
    });

    it("should throw EntityNotFoundException when updating non-existent log", async () => {
      milkLogRepository.findById.mockResolvedValue(null);

      await expect(
        service.updateMilkLog("missing-id", farmId, actorUserId, {
          yieldLiters: 15.0,
        })
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe("deleteMilkLog", () => {
    it("should delete milk log and record audit log entry", async () => {
      const existing = MilkLogEntity.create({
        id: "log-1",
        farmId,
        animalId: femaleCowId,
        recordedById: actorUserId,
        session: MilkSession.MORNING,
        yieldLiters: 14.0,
        loggedDate: new Date("2026-09-13"),
      });

      milkLogRepository.findById.mockResolvedValue(existing);
      milkLogRepository.delete.mockResolvedValue(undefined);

      await service.deleteMilkLog("log-1", farmId, actorUserId);

      expect(milkLogRepository.delete).toHaveBeenCalledWith("log-1", farmId, expect.anything());
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "MILK_LOG_DELETED",
          entityId: "log-1",
        }),
        expect.anything()
      );
    });

    it("should throw EntityNotFoundException when deleting non-existent log", async () => {
      milkLogRepository.findById.mockResolvedValue(null);

      await expect(
        service.deleteMilkLog("missing-id", farmId, actorUserId)
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe("getMilkLogById", () => {
    it("should return milk log DTO when found", async () => {
      const existing = MilkLogEntity.create({
        id: "log-1",
        farmId,
        animalId: femaleCowId,
        recordedById: actorUserId,
        session: MilkSession.MORNING,
        yieldLiters: 14.0,
        loggedDate: new Date("2026-09-13"),
      });

      milkLogRepository.findById.mockResolvedValue(existing);

      const result = await service.getMilkLogById("log-1", farmId);
      expect(result.id).toBe("log-1");
      expect(result.yieldLiters).toBe(14.0);
    });

    it("should throw EntityNotFoundException when not found", async () => {
      milkLogRepository.findById.mockResolvedValue(null);

      await expect(service.getMilkLogById("missing-id", farmId)).rejects.toThrow(
        EntityNotFoundException
      );
    });
  });

  describe("queryMilkLogs", () => {
    it("should return paginated milk logs with metadata", async () => {
      const log1 = MilkLogEntity.create({
        id: "log-1",
        farmId,
        animalId: femaleCowId,
        recordedById: actorUserId,
        session: MilkSession.MORNING,
        yieldLiters: 14.0,
        loggedDate: new Date("2026-09-13"),
      });

      milkLogRepository.findMany.mockResolvedValue({
        items: [log1],
        total: 1,
      });

      const result = await service.queryMilkLogs(farmId, {
        page: 1,
        limit: 20,
      });

      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.pageSize).toBe(20);
    });
  });

  describe("createBulkMilkLog", () => {
    it("should successfully record a bulk herd milk collection with metadata", async () => {
      milkLogRepository.findBulkBySessionAndDate.mockResolvedValue(null);

      const savedBulkEntity = MilkLogEntity.create({
        id: "bulk-1",
        farmId,
        animalId: null,
        recordedById: actorUserId,
        session: MilkSession.MORNING,
        yieldLiters: 1250.75,
        fatPercent: 4.05,
        snfPercent: 8.85,
        loggedDate: new Date("2026-09-13"),
      });

      milkLogRepository.create.mockResolvedValue(savedBulkEntity);

      const result = await service.createBulkMilkLog(farmId, actorUserId, {
        session: MilkSession.MORNING,
        yieldLiters: 1250.75,
        fatPercent: 4.05,
        snfPercent: 8.85,
        loggedDate: "2026-09-13",
        milkingAnimalsCount: 85,
        tankTemperatureCelsius: 3.8,
        notes: "Morning cooling tank test",
      });

      expect(result.id).toBe("bulk-1");
      expect(result.animalId).toBeNull();
      expect(result.yieldLiters).toBe(1250.75);
      expect(result.session).toBe(MilkSession.MORNING);
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "BULK_MILK_LOG_RECORDED",
          entityType: "MilkLog",
        }),
        expect.anything()
      );
    });

    it("should throw EntityConflictException if duplicate bulk session exists", async () => {
      const existingBulk = MilkLogEntity.create({
        farmId,
        animalId: null,
        recordedById: actorUserId,
        session: MilkSession.MORNING,
        yieldLiters: 1000.0,
        loggedDate: new Date("2026-09-13"),
      });
      milkLogRepository.findBulkBySessionAndDate.mockResolvedValue(existingBulk);

      await expect(
        service.createBulkMilkLog(farmId, actorUserId, {
          session: MilkSession.MORNING,
          yieldLiters: 1200.0,
          loggedDate: "2026-09-13",
        })
      ).rejects.toThrow(EntityConflictException);
    });

    it("should throw ValidationDomainException when bulk yield exceeds 100,000L", async () => {
      await expect(
        service.createBulkMilkLog(farmId, actorUserId, {
          session: MilkSession.MORNING,
          yieldLiters: 150000.0,
          loggedDate: "2026-09-13",
        })
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException when date is in the future", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 3);

      await expect(
        service.createBulkMilkLog(farmId, actorUserId, {
          session: MilkSession.MORNING,
          yieldLiters: 500.0,
          loggedDate: futureDate.toISOString().split("T")[0]!,
        })
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException when tank temperature is outside -5C to 45C", async () => {
      milkLogRepository.findBulkBySessionAndDate.mockResolvedValue(null);

      await expect(
        service.createBulkMilkLog(farmId, actorUserId, {
          session: MilkSession.MORNING,
          yieldLiters: 500.0,
          loggedDate: "2026-09-13",
          tankTemperatureCelsius: -15.0,
        })
      ).rejects.toThrow(ValidationDomainException);
    });
  });

  describe("getYieldAnalytics", () => {
    it("should throw EntityNotFoundException when requested animal does not exist in farm", async () => {
      animalRepository.findById.mockResolvedValue(null);

      await expect(
        service.getYieldAnalytics(farmId, {
          animalId: "non-existent-animal-id",
        })
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw ValidationDomainException when endDate is in the future", async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 5);
      const futureDateStr = futureDate.toISOString().split("T")[0]!;

      await expect(
        service.getYieldAnalytics(farmId, {
          endDate: futureDateStr,
        })
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException when startDate is after endDate", async () => {
      await expect(
        service.getYieldAnalytics(farmId, {
          startDate: "2026-09-10",
          endDate: "2026-09-05",
        })
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException when date range exceeds 730 days", async () => {
      await expect(
        service.getYieldAnalytics(farmId, {
          startDate: "2024-01-01",
          endDate: "2026-09-10",
        })
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException on malformed date string", async () => {
      await expect(
        service.getYieldAnalytics(farmId, {
          startDate: "not-a-date",
          endDate: "2026-09-10",
        })
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should query logs with 6-day lookback window and return aggregated analytics", async () => {
      const mockLogs = [
        new MilkLogEntity({
          id: "log-1",
          farmId,
          animalId: femaleCowId,
          recordedById: actorUserId,
          session: MilkSession.MORNING,
          yieldLiters: 15,
          fatPercent: 3.8,
          snfPercent: 8.5,
          loggedDate: new Date("2026-09-07T00:00:00.000Z"),
          syncVersion: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
        new MilkLogEntity({
          id: "log-2",
          farmId,
          animalId: femaleCowId,
          recordedById: actorUserId,
          session: MilkSession.AFTERNOON,
          yieldLiters: 10,
          fatPercent: 4.0,
          snfPercent: 8.7,
          loggedDate: new Date("2026-09-07T00:00:00.000Z"),
          syncVersion: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      ];

      animalRepository.findById.mockResolvedValue(femaleCow);
      milkLogRepository.findLogsForAnalytics.mockResolvedValue(mockLogs);

      const result = await service.getYieldAnalytics(farmId, {
        animalId: femaleCowId,
        startDate: "2026-09-07",
        endDate: "2026-09-07",
      });

      expect(milkLogRepository.findLogsForAnalytics).toHaveBeenCalledWith(
        farmId,
        expect.objectContaining({
          animalId: femaleCowId,
          startDate: new Date(Date.UTC(2026, 8, 1, 0, 0, 0, 0)), // 2026-09-01 (6 days lookback)
          endDate: new Date(Date.UTC(2026, 8, 7, 0, 0, 0, 0)),
        })
      );

      expect(result.farmId).toBe(farmId);
      expect(result.animalId).toBe(femaleCowId);
      expect(result.startDate).toBe("2026-09-07");
      expect(result.endDate).toBe("2026-09-07");
      expect(result.summary.totalYieldLiters).toBe(25);
      expect(result.summary.activeDays).toBe(1);
      expect(result.summary.totalRecords).toBe(2);
      expect(result.daily).toHaveLength(1);
      expect(result.daily[0]!.totalYieldLiters).toBe(25);
      expect(result.weekly).toHaveLength(1);
      expect(result.monthly).toHaveLength(1);
    });

    it("should default to 30 days trailing window when dates are not specified", async () => {
      milkLogRepository.findLogsForAnalytics.mockResolvedValue([]);

      const result = await service.getYieldAnalytics(farmId, {});

      expect(result.farmId).toBe(farmId);
      expect(result.animalId).toBeNull();
      expect(result.daily).toHaveLength(30);
      expect(result.summary.totalYieldLiters).toBe(0);
      expect(result.summary.trendDirection).toBe("STABLE");
    });
  });
});
