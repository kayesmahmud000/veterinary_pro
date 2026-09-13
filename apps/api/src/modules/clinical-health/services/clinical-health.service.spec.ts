import {
  AnimalGender,
  AnimalSpecies,
  AnimalStatus,
  HealthEventType,
  SeverityLevel,
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
import { IUserRepository } from "../../users/repositories/user.repository.interface";
import { HealthRecordEntity } from "../entities/health-record.entity";
import { IHealthRecordRepository } from "../repositories/health-record.repository.interface";
import { ClinicalHealthService } from "./clinical-health.service";

describe("ClinicalHealthService", () => {
  let service: ClinicalHealthService;
  let healthRecordRepository: jest.Mocked<IHealthRecordRepository>;
  let animalRepository: jest.Mocked<IAnimalRepository>;
  let userRepository: jest.Mocked<IUserRepository>;
  let auditLogRepository: jest.Mocked<IAuditLogRepository>;
  let transactionManager: jest.Mocked<ITransactionManager>;

  const farmId = "11111111-1111-1111-1111-111111111111";
  const animalId = "22222222-2222-2222-2222-222222222222";
  const actorId = "33333333-3333-3333-3333-333333333333";
  const vetId = "44444444-4444-4444-4444-444444444444";
  const incidentId = "55555555-5555-5555-5555-555555555555";

  const mockAnimal = AnimalEntity.reconstitute({
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
    status: AnimalStatus.ACTIVE,
    sireId: null,
    damId: null,
    metadata: {},
    syncVersion: 1,
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  let mockEntity: HealthRecordEntity;

  beforeEach(() => {
    mockEntity = HealthRecordEntity.create({
      id: incidentId,
      farmId,
      animalId,
      recordedById: actorId,
      attendingVetId: vetId,
      eventType: HealthEventType.ILLNESS,
      severity: SeverityLevel.MEDIUM,
      symptoms: "Mastitis signs in rear-left quarter with mild swelling",
      diagnosis: "Clinical Mastitis",
      treatment: "Intramammary antibiotic infusion",
      cost: 35.0,
    });

    healthRecordRepository = {
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findMany: jest.fn(),
      findUnresolvedCriticalCases: jest.fn(),
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

    userRepository = {
      findById: jest.fn(),
    } as unknown as jest.Mocked<IUserRepository>;

    auditLogRepository = {
      record: jest.fn(),
    } as unknown as jest.Mocked<IAuditLogRepository>;

    transactionManager = {
      run: jest.fn().mockImplementation(async (cb) => cb({})),
    };

    service = new ClinicalHealthService(
      healthRecordRepository,
      animalRepository,
      userRepository,
      auditLogRepository,
      transactionManager
    );
  });

  describe("createIncident", () => {
    const createDto = {
      animalId,
      eventType: HealthEventType.ILLNESS,
      severity: SeverityLevel.MEDIUM,
      symptoms: "Mastitis signs in rear-left quarter with mild swelling",
      diagnosis: "Clinical Mastitis",
      treatment: "Intramammary antibiotic infusion",
      cost: 35.0,
      attendingVetId: vetId,
    };

    it("should successfully log health incident inside a transaction with audit record", async () => {
      animalRepository.findById.mockResolvedValueOnce(mockAnimal);
      userRepository.findById.mockResolvedValueOnce({ id: vetId } as any);
      healthRecordRepository.create.mockResolvedValueOnce(mockEntity);

      const result = await service.createIncident(farmId, actorId, createDto);

      expect(animalRepository.findById).toHaveBeenCalledWith(animalId, farmId);
      expect(userRepository.findById).toHaveBeenCalledWith(vetId);
      expect(transactionManager.run).toHaveBeenCalled();
      expect(healthRecordRepository.create).toHaveBeenCalled();
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: actorId,
          action: "HEALTH_RECORD_CREATED",
          entityType: "HealthRecord",
        }),
        expect.anything()
      );
      expect(result.id).toBe(incidentId);
      expect(result.symptoms).toBe(createDto.symptoms);
    });

    it("should throw EntityNotFoundException if animal does not exist", async () => {
      animalRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.createIncident(farmId, actorId, createDto)
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw ValidationDomainException if animal is DECEASED", async () => {
      const deceasedAnimal = AnimalEntity.reconstitute({
        ...mockAnimal,
        id: animalId,
        farmId,
        tagNumber: "COW-042",
        rfidNumber: null,
        name: "Buttercup",
        species: AnimalSpecies.COW,
        breed: "Jersey",
        gender: AnimalGender.FEMALE,
        dateOfBirth: null,
        weightKg: null,
        status: AnimalStatus.DECEASED,
        sireId: null,
        damId: null,
        metadata: {},
        syncVersion: 1,
        deletedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      animalRepository.findById.mockResolvedValueOnce(deceasedAnimal);

      await expect(
        service.createIncident(farmId, actorId, createDto)
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw EntityNotFoundException if attendingVet does not exist", async () => {
      animalRepository.findById.mockResolvedValueOnce(mockAnimal);
      userRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.createIncident(farmId, actorId, createDto)
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe("getIncidentById", () => {
    it("should return the incident response dto when found", async () => {
      healthRecordRepository.findById.mockResolvedValueOnce(mockEntity);

      const result = await service.getIncidentById(incidentId, farmId);

      expect(healthRecordRepository.findById).toHaveBeenCalledWith(incidentId, farmId);
      expect(result.id).toBe(incidentId);
    });

    it("should throw EntityNotFoundException when incident does not exist", async () => {
      healthRecordRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.getIncidentById(incidentId, farmId)
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe("listIncidents", () => {
    it("should return paginated incidents and metadata", async () => {
      healthRecordRepository.findMany.mockResolvedValueOnce({
        items: [mockEntity],
        total: 1,
      });

      const result = await service.listIncidents(farmId, { page: 1, limit: 10 });

      expect(healthRecordRepository.findMany).toHaveBeenCalled();
      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe("updateIncident", () => {
    it("should update incident and emit audit log", async () => {
      healthRecordRepository.findById.mockResolvedValueOnce(mockEntity);
      healthRecordRepository.update.mockResolvedValueOnce(mockEntity);

      const result = await service.updateIncident(incidentId, farmId, actorId, {
        cost: 60.0,
        syncVersion: 1,
      });

      expect(transactionManager.run).toHaveBeenCalled();
      expect(healthRecordRepository.update).toHaveBeenCalled();
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: actorId,
          action: "HEALTH_RECORD_UPDATED",
        }),
        expect.anything()
      );
      expect(result.id).toBe(incidentId);
    });

    it("should throw EntityConflictException on version mismatch", async () => {
      healthRecordRepository.findById.mockResolvedValueOnce(mockEntity);

      await expect(
        service.updateIncident(incidentId, farmId, actorId, {
          syncVersion: 99,
        })
      ).rejects.toThrow(EntityConflictException);
    });
  });

  describe("resolveIncident", () => {
    it("should resolve incident and emit audit log", async () => {
      healthRecordRepository.findById.mockResolvedValueOnce(mockEntity);
      healthRecordRepository.update.mockResolvedValueOnce(mockEntity);

      const result = await service.resolveIncident(incidentId, farmId, actorId, {
        treatment: "Discharged cured",
        syncVersion: 1,
      });

      expect(transactionManager.run).toHaveBeenCalled();
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: actorId,
          action: "HEALTH_RECORD_RESOLVED",
        }),
        expect.anything()
      );
      expect(result.id).toBe(incidentId);
    });
  });

  describe("deleteIncident", () => {
    it("should delete incident and record audit log", async () => {
      healthRecordRepository.findById.mockResolvedValueOnce(mockEntity);
      healthRecordRepository.delete.mockResolvedValueOnce();

      await service.deleteIncident(incidentId, farmId, actorId);

      expect(transactionManager.run).toHaveBeenCalled();
      expect(healthRecordRepository.delete).toHaveBeenCalledWith(
        incidentId,
        farmId,
        expect.anything()
      );
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "HEALTH_RECORD_DELETED",
          entityId: incidentId,
        }),
        expect.anything()
      );
    });

    it("should throw EntityNotFoundException if incident does not exist", async () => {
      healthRecordRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.deleteIncident(incidentId, farmId, actorId)
      ).rejects.toThrow(EntityNotFoundException);
    });
  });
});
