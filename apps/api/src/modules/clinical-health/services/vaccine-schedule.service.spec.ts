import {
  AnimalGender,
  AnimalSpecies,
  AnimalStatus,
  PreventativeScheduleStatus,
  VaccineRecordType,
} from "@vetralink/shared-types";
import {
  EntityConflictException,
  EntityNotFoundException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import { IAnimalRepository } from "../../animals/repositories/animal.repository.interface";
import { AnimalEntity } from "../../animals/entities/animal.entity";
import { IAuditLogRepository } from "../../audit/repositories/audit-log.repository.interface";
import { ITransactionManager } from "../../prisma/interfaces/transaction.interface";
import { VaccineRecordEntity } from "../entities/vaccine-record.entity";
import {
  IVaccineRecordRepository,
  VaccineScheduleCounts,
} from "../repositories/vaccine-record.repository.interface";
import { VaccineScheduleService } from "./vaccine-schedule.service";

describe("VaccineScheduleService", () => {
  let service: VaccineScheduleService;
  let vaccineRecordRepository: jest.Mocked<IVaccineRecordRepository>;
  let animalRepository: jest.Mocked<IAnimalRepository>;
  let auditLogRepository: jest.Mocked<IAuditLogRepository>;
  let transactionManager: jest.Mocked<ITransactionManager>;

  const farmId = "11111111-1111-1111-1111-111111111111";
  const animalId = "22222222-2222-2222-2222-222222222222";
  const actorId = "33333333-3333-3333-3333-333333333333";
  const recordId = "44444444-4444-4444-4444-444444444444";

  const createMockAnimal = (status: AnimalStatus = AnimalStatus.ACTIVE) =>
    AnimalEntity.reconstitute({
      id: animalId,
      farmId,
      tagNumber: "COW-042",
      rfidNumber: null,
      name: "Buttercup",
      species: AnimalSpecies.COW,
      breed: "Jersey",
      gender: AnimalGender.FEMALE,
      dateOfBirth: new Date("2022-01-01"),
      weightKg: 450,
      status,
      sireId: null,
      damId: null,
      metadata: {},
      syncVersion: 1,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

  let mockRecord: VaccineRecordEntity;

  beforeEach(() => {
    mockRecord = VaccineRecordEntity.create({
      id: recordId,
      farmId,
      animalId,
      administeredById: actorId,
      recordType: VaccineRecordType.VACCINATION,
      vaccineName: "Foot and Mouth Disease (FMD) Vaccine",
      batchNumber: "FMD-BATCH-2026-X",
      doseAmount: 2.0,
      doseUnit: "ml",
      cost: 15.0,
      notes: "Routine vaccination",
      administeredAt: new Date("2026-09-01"),
      nextDueDate: new Date("2027-03-01"),
    });

    vaccineRecordRepository = {
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findMany: jest.fn(),
      findUpcoming: jest.fn(),
      findRecordsForReminderScan: jest.fn(),
      getScheduleCounts: jest.fn(),
      delete: jest.fn(),
    };

    animalRepository = {
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findByTagNumber: jest.fn(),
      findByRfidNumber: jest.fn(),
      findMany: jest.fn(),
      softDelete: jest.fn(),
      getPedigreeLineage: jest.fn(),
    } as unknown as jest.Mocked<IAnimalRepository>;

    auditLogRepository = {
      record: jest.fn(),
    } as unknown as jest.Mocked<IAuditLogRepository>;

    transactionManager = {
      run: jest.fn().mockImplementation(async (cb) => cb({})),
    };

    service = new VaccineScheduleService(
      vaccineRecordRepository,
      animalRepository,
      auditLogRepository,
      transactionManager
    );
  });

  describe("recordAdministration", () => {
    const createDto = {
      animalId,
      recordType: VaccineRecordType.VACCINATION,
      vaccineName: "Foot and Mouth Disease (FMD) Vaccine",
      batchNumber: "FMD-BATCH-2026-X",
      doseAmount: 2.0,
      doseUnit: "ml",
      cost: 15.0,
      notes: "Routine vaccination",
      administeredAt: "2026-09-01T08:00:00.000Z",
      nextDueDate: "2027-03-01",
    };

    it("should successfully record vaccination administration with audit logging", async () => {
      animalRepository.findById.mockResolvedValueOnce(createMockAnimal());
      vaccineRecordRepository.create.mockResolvedValueOnce(mockRecord);

      const result = await service.recordAdministration(farmId, actorId, createDto);

      expect(animalRepository.findById).toHaveBeenCalledWith(animalId, farmId);
      expect(transactionManager.run).toHaveBeenCalled();
      expect(vaccineRecordRepository.create).toHaveBeenCalled();
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: actorId,
          action: "VACCINE_RECORD_CREATED",
          entityType: "VaccineRecord",
        }),
        expect.anything()
      );
      expect(result.id).toBe(recordId);
      expect(result.vaccineName).toBe(createDto.vaccineName);
      expect(result.recordType).toBe(VaccineRecordType.VACCINATION);
    });

    it("should successfully record deworming administration", async () => {
      const dewormingDto = {
        ...createDto,
        recordType: VaccineRecordType.DEWORMING,
        vaccineName: "Albendazole Oral Drench",
      };

      const dewormingRecord = VaccineRecordEntity.create({
        id: recordId,
        farmId,
        animalId,
        administeredById: actorId,
        recordType: VaccineRecordType.DEWORMING,
        vaccineName: "Albendazole Oral Drench",
        doseAmount: 10.0,
        doseUnit: "ml",
        administeredAt: new Date("2026-09-01"),
      });

      animalRepository.findById.mockResolvedValueOnce(createMockAnimal());
      vaccineRecordRepository.create.mockResolvedValueOnce(dewormingRecord);

      const result = await service.recordAdministration(farmId, actorId, dewormingDto);

      expect(result.recordType).toBe(VaccineRecordType.DEWORMING);
      expect(result.vaccineName).toBe("Albendazole Oral Drench");
    });

    it("should throw EntityNotFoundException if animal does not exist", async () => {
      animalRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.recordAdministration(farmId, actorId, createDto)
      ).rejects.toThrow(EntityNotFoundException);
      expect(transactionManager.run).not.toHaveBeenCalled();
    });

    it("should throw ValidationDomainException if animal is SOLD", async () => {
      animalRepository.findById.mockResolvedValueOnce(
        createMockAnimal(AnimalStatus.SOLD)
      );

      await expect(
        service.recordAdministration(farmId, actorId, createDto)
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if animal is DECEASED", async () => {
      animalRepository.findById.mockResolvedValueOnce(
        createMockAnimal(AnimalStatus.DECEASED)
      );

      await expect(
        service.recordAdministration(farmId, actorId, createDto)
      ).rejects.toThrow(ValidationDomainException);
    });
  });

  describe("getRecordById", () => {
    it("should return record DTO if found", async () => {
      vaccineRecordRepository.findById.mockResolvedValueOnce(mockRecord);

      const result = await service.getRecordById(recordId, farmId);

      expect(vaccineRecordRepository.findById).toHaveBeenCalledWith(recordId, farmId);
      expect(result.id).toBe(recordId);
      expect(result.vaccineName).toBe(mockRecord.vaccineName);
    });

    it("should evaluate scheduleStatus with provided asOfDate", async () => {
      vaccineRecordRepository.findById.mockResolvedValueOnce(mockRecord);

      // asOfDate is after nextDueDate (2027-03-01) -> should be OVERDUE
      const result = await service.getRecordById(recordId, farmId, "2027-04-01");

      expect(result.scheduleStatus).toBe(PreventativeScheduleStatus.OVERDUE);
    });

    it("should throw EntityNotFoundException if record not found", async () => {
      vaccineRecordRepository.findById.mockResolvedValueOnce(null);

      await expect(service.getRecordById(recordId, farmId)).rejects.toThrow(
        EntityNotFoundException
      );
    });
  });

  describe("listRecords", () => {
    it("should return paginated vaccine records", async () => {
      vaccineRecordRepository.findMany.mockResolvedValueOnce({
        items: [mockRecord],
        total: 1,
      });

      const result = await service.listRecords(farmId, {
        recordType: VaccineRecordType.VACCINATION,
        page: 1,
        limit: 10,
      });

      expect(vaccineRecordRepository.findMany).toHaveBeenCalledWith(
        farmId,
        expect.objectContaining({
          recordType: VaccineRecordType.VACCINATION,
          page: 1,
          limit: 10,
        })
      );
      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe("getScheduleSummary", () => {
    it("should aggregate schedule counts and upcoming events", async () => {
      const counts: VaccineScheduleCounts = {
        totalRecords: 10,
        totalVaccinations: 6,
        totalDewormings: 4,
        dueNext7Days: 2,
        dueNext30Days: 5,
        overdueCount: 1,
      };

      vaccineRecordRepository.getScheduleCounts.mockResolvedValueOnce(counts);
      vaccineRecordRepository.findUpcoming.mockResolvedValueOnce([mockRecord]);

      const result = await service.getScheduleSummary(farmId, {
        daysAhead: 30,
      });

      expect(vaccineRecordRepository.getScheduleCounts).toHaveBeenCalledWith(
        farmId,
        expect.any(Date)
      );
      expect(vaccineRecordRepository.findUpcoming).toHaveBeenCalledWith(
        farmId,
        30,
        10,
        expect.any(Date)
      );
      expect(result.dueNext7Days).toBe(2);
      expect(result.dueNext30Days).toBe(5);
      expect(result.overdueCount).toBe(1);
      expect(result.upcomingEvents).toHaveLength(1);
    });
  });

  describe("getSpeciesProtocols", () => {
    it("should return all species protocols when no species is provided", () => {
      const protocols = service.getSpeciesProtocols();

      expect(protocols.length).toBeGreaterThanOrEqual(6);
      expect(protocols.map((p) => p.species)).toContain(AnimalSpecies.COW);
      expect(protocols.map((p) => p.species)).toContain(AnimalSpecies.GOAT);
    });

    it("should return single protocol when species is provided", () => {
      const protocols = service.getSpeciesProtocols(AnimalSpecies.COW);

      expect(protocols).toHaveLength(1);
      expect(protocols[0]!.species).toBe(AnimalSpecies.COW);
      expect(protocols[0]!.steps.length).toBeGreaterThan(0);
    });

    it("should return empty array for species without protocols", () => {
      const protocols = service.getSpeciesProtocols("UNKNOWN" as any);

      expect(protocols).toHaveLength(0);
    });
  });

  describe("updateRecord", () => {
    const updateDto = {
      notes: "Updated booster schedule",
      nextDueDate: "2027-04-01",
      syncVersion: 1,
    };

    it("should update vaccine record inside transaction with audit log", async () => {
      vaccineRecordRepository.findById.mockResolvedValueOnce(mockRecord);
      vaccineRecordRepository.update.mockResolvedValueOnce(mockRecord);

      const result = await service.updateRecord(recordId, farmId, actorId, updateDto);

      expect(vaccineRecordRepository.findById).toHaveBeenCalledWith(recordId, farmId);
      expect(transactionManager.run).toHaveBeenCalled();
      expect(vaccineRecordRepository.update).toHaveBeenCalled();
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: actorId,
          action: "VACCINE_RECORD_UPDATED",
          entityType: "VaccineRecord",
        }),
        expect.anything()
      );
      expect(result.id).toBe(recordId);
    });

    it("should throw EntityNotFoundException if record not found", async () => {
      vaccineRecordRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.updateRecord(recordId, farmId, actorId, updateDto)
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw EntityConflictException if syncVersion does not match", async () => {
      vaccineRecordRepository.findById.mockResolvedValueOnce(mockRecord);

      await expect(
        service.updateRecord(recordId, farmId, actorId, {
          ...updateDto,
          syncVersion: 99,
        })
      ).rejects.toThrow(EntityConflictException);
    });
  });

  describe("deleteRecord", () => {
    it("should delete record inside transaction with audit log", async () => {
      vaccineRecordRepository.findById.mockResolvedValueOnce(mockRecord);
      vaccineRecordRepository.delete.mockResolvedValueOnce();

      await service.deleteRecord(recordId, farmId, actorId);

      expect(vaccineRecordRepository.findById).toHaveBeenCalledWith(recordId, farmId);
      expect(transactionManager.run).toHaveBeenCalled();
      expect(vaccineRecordRepository.delete).toHaveBeenCalledWith(
        recordId,
        farmId,
        expect.anything()
      );
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: actorId,
          action: "VACCINE_RECORD_DELETED",
          entityType: "VaccineRecord",
          entityId: recordId,
        }),
        expect.anything()
      );
    });

    it("should throw EntityNotFoundException if record to delete is not found", async () => {
      vaccineRecordRepository.findById.mockResolvedValueOnce(null);

      await expect(service.deleteRecord(recordId, farmId, actorId)).rejects.toThrow(
        EntityNotFoundException
      );
      expect(transactionManager.run).not.toHaveBeenCalled();
    });
  });
});
