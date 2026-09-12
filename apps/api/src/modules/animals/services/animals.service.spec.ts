import {
  AnimalGender,
  AnimalSpecies,
  AnimalStatus,
  GrowthTrajectory,
  ImportJobStatus,
  InbreedingRiskLevel,
} from "@vetralink/shared-types";
import { AnimalsService } from "./animals.service";
import { IAnimalRepository } from "../repositories/animal.repository.interface";
import { IAnimalWeightRepository } from "../repositories/animal-weight.repository.interface";
import { IAnimalImportJobRepository } from "../repositories/animal-import-job.repository.interface";
import { IAnimalImportQueueService } from "./animal-import-queue.service.interface";
import { IAuditLogRepository } from "../../audit/repositories/audit-log.repository.interface";
import { ITransactionManager } from "../../prisma/interfaces/transaction.interface";
import { AnimalEntity } from "../entities/animal.entity";
import { AnimalWeightLogEntity } from "../entities/animal-weight-log.entity";
import { AnimalImportJobEntity } from "../entities/animal-import-job.entity";
import {
  EntityConflictException,
  EntityNotFoundException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";

describe("AnimalsService", () => {
  let service: AnimalsService;
  let animalRepository: jest.Mocked<IAnimalRepository>;
  let animalWeightRepository: jest.Mocked<IAnimalWeightRepository>;
  let importJobRepository: jest.Mocked<IAnimalImportJobRepository>;
  let importQueueService: jest.Mocked<IAnimalImportQueueService>;
  let auditLogRepository: jest.Mocked<IAuditLogRepository>;
  let transactionManager: jest.Mocked<ITransactionManager>;

  const farmId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const actorUserId = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

  const sireMock = AnimalEntity.create({
    id: "22222222-2222-2222-2222-222222222222",
    farmId,
    tagNumber: "BULL-01",
    species: AnimalSpecies.COW,
    gender: AnimalGender.MALE,
  });

  const damMock = AnimalEntity.create({
    id: "33333333-3333-3333-3333-333333333333",
    farmId,
    tagNumber: "COW-01",
    species: AnimalSpecies.COW,
    gender: AnimalGender.FEMALE,
  });

  beforeEach(() => {
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

    animalWeightRepository = {
      create: jest.fn(),
      findByAnimalId: jest.fn(),
      findAllChronological: jest.fn(),
      findLatestByAnimalId: jest.fn(),
      findById: jest.fn(),
      delete: jest.fn(),
    };

    importJobRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByFarmId: jest.fn(),
      update: jest.fn(),
    };

    importQueueService = {
      enqueueImportJob: jest.fn(),
    };

    auditLogRepository = {
      record: jest.fn(),
      findByEntity: jest.fn(),
      findByTraceId: jest.fn(),
      query: jest.fn(),
    };

    transactionManager = {
      run: jest.fn().mockImplementation(async (callback) => {
        return callback({} as any);
      }),
    };

    service = new AnimalsService(
      animalRepository,
      animalWeightRepository,
      importJobRepository,
      importQueueService,
      auditLogRepository,
      transactionManager
    );
  });

  describe("registerAnimal", () => {
    const validDto = {
      tagNumber: "COW-100",
      name: "Bella",
      species: AnimalSpecies.COW,
      gender: AnimalGender.FEMALE,
      dateOfBirth: "2023-05-10",
      weightKg: 450,
      sireId: sireMock.id,
      damId: damMock.id,
    };

    it("should register animal, execute in transaction, and record audit log", async () => {
      animalRepository.existsActiveTag.mockResolvedValueOnce(false);
      animalRepository.findById.mockResolvedValueOnce(sireMock); // sire lookup
      animalRepository.findById.mockResolvedValueOnce(damMock); // dam lookup

      const createdEntity = AnimalEntity.create({
        ...validDto,
        farmId,
        dateOfBirth: new Date(validDto.dateOfBirth),
      });
      animalRepository.create.mockResolvedValueOnce(createdEntity);

      const result = await service.registerAnimal(farmId, validDto, actorUserId);

      expect(animalRepository.existsActiveTag).toHaveBeenCalledWith(
        "COW-100",
        farmId
      );
      expect(transactionManager.run).toHaveBeenCalled();
      expect(animalRepository.create).toHaveBeenCalled();
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: actorUserId,
          action: "ANIMAL_REGISTERED",
          entityType: "Animal",
          entityId: createdEntity.id,
        }),
        expect.anything()
      );
      expect(result.tagNumber).toBe("COW-100");
    });

    it("should throw EntityConflictException if active tag already exists in the farm", async () => {
      animalRepository.existsActiveTag.mockResolvedValueOnce(true);

      await expect(
        service.registerAnimal(farmId, validDto, actorUserId)
      ).rejects.toThrow(EntityConflictException);

      expect(animalRepository.create).not.toHaveBeenCalled();
    });

    it("should throw EntityConflictException if active rfidNumber already exists in the farm", async () => {
      animalRepository.existsActiveTag.mockResolvedValueOnce(false);
      animalRepository.existsActiveRfid.mockResolvedValueOnce(true);

      await expect(
        service.registerAnimal(farmId, { ...validDto, rfidNumber: "RFID-999" }, actorUserId)
      ).rejects.toThrow(EntityConflictException);

      expect(animalRepository.create).not.toHaveBeenCalled();
    });

    it("should throw EntityNotFoundException if sire does not exist in farm", async () => {
      animalRepository.existsActiveTag.mockResolvedValueOnce(false);
      animalRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.registerAnimal(farmId, validDto, actorUserId)
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw ValidationDomainException if sire is not male", async () => {
      animalRepository.existsActiveTag.mockResolvedValueOnce(false);
      const femaleSire = AnimalEntity.create({
        id: "22222222-2222-2222-2222-222222222222",
        farmId,
        tagNumber: "NOT-A-BULL",
        species: AnimalSpecies.COW,
        gender: AnimalGender.FEMALE,
      });
      animalRepository.findById.mockResolvedValueOnce(femaleSire);

      await expect(
        service.registerAnimal(farmId, validDto, actorUserId)
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if sire species does not match offspring species", async () => {
      animalRepository.existsActiveTag.mockResolvedValueOnce(false);
      const goatSire = AnimalEntity.create({
        id: "22222222-2222-2222-2222-222222222222",
        farmId,
        tagNumber: "GOAT-01",
        species: AnimalSpecies.GOAT,
        gender: AnimalGender.MALE,
      });
      animalRepository.findById.mockResolvedValueOnce(goatSire);

      await expect(
        service.registerAnimal(farmId, validDto, actorUserId)
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if date of birth is in the future", async () => {
      animalRepository.existsActiveTag.mockResolvedValueOnce(false);
      const futureDateDto = {
        ...validDto,
        sireId: undefined,
        damId: undefined,
        dateOfBirth: "2099-01-01",
      };

      await expect(
        service.registerAnimal(farmId, futureDateDto, actorUserId)
      ).rejects.toThrow(ValidationDomainException);
    });
  });

  describe("updateAnimal", () => {
    it("should update animal and record audit log with old and new values", async () => {
      const existing = AnimalEntity.create({
        id: "55555555-5555-5555-5555-555555555555",
        farmId,
        tagNumber: "COW-100",
        species: AnimalSpecies.COW,
        gender: AnimalGender.FEMALE,
      });
      animalRepository.findById.mockResolvedValueOnce(existing);
      animalRepository.update.mockResolvedValueOnce(existing);

      const result = await service.updateAnimal(
        existing.id,
        farmId,
        { name: "Updated Daisy", weightKg: 580 },
        actorUserId
      );

      expect(animalRepository.update).toHaveBeenCalled();
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ANIMAL_UPDATED",
          entityId: existing.id,
        }),
        expect.anything()
      );
      expect(result.name).toBe("Updated Daisy");
    });

    it("should throw EntityNotFoundException if animal does not exist", async () => {
      animalRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.updateAnimal("non-existent", farmId, { name: "Test" })
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw EntityConflictException if updating tagNumber to one already used", async () => {
      const existing = AnimalEntity.create({
        id: "55555555-5555-5555-5555-555555555555",
        farmId,
        tagNumber: "COW-100",
        species: AnimalSpecies.COW,
        gender: AnimalGender.FEMALE,
      });
      animalRepository.findById.mockResolvedValueOnce(existing);
      animalRepository.existsActiveTag.mockResolvedValueOnce(true);

      await expect(
        service.updateAnimal(existing.id, farmId, { tagNumber: "COW-200" }, actorUserId)
      ).rejects.toThrow(EntityConflictException);
    });

    it("should throw EntityConflictException if updating rfidNumber to one already used", async () => {
      const existing = AnimalEntity.create({
        id: "55555555-5555-5555-5555-555555555555",
        farmId,
        tagNumber: "COW-100",
        species: AnimalSpecies.COW,
        gender: AnimalGender.FEMALE,
      });
      animalRepository.findById.mockResolvedValueOnce(existing);
      animalRepository.existsActiveRfid.mockResolvedValueOnce(true);

      await expect(
        service.updateAnimal(existing.id, farmId, { rfidNumber: "RFID-CONFLICT" }, actorUserId)
      ).rejects.toThrow(EntityConflictException);
    });
  });

  describe("getAnimalById", () => {
    it("should return animal response dto if found", async () => {
      const existing = AnimalEntity.create({
        farmId,
        tagNumber: "COW-100",
        species: AnimalSpecies.COW,
        gender: AnimalGender.FEMALE,
      });
      animalRepository.findById.mockResolvedValueOnce(existing);

      const result = await service.getAnimalById(existing.id, farmId);
      expect(result.id).toBe(existing.id);
      expect(result.tagNumber).toBe("COW-100");
    });

    it("should throw EntityNotFoundException if not found", async () => {
      animalRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.getAnimalById("non-existent", farmId)
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe("getAnimals", () => {
    it("should return paginated animals", async () => {
      const existing = AnimalEntity.create({
        farmId,
        tagNumber: "COW-100",
        species: AnimalSpecies.COW,
        gender: AnimalGender.FEMALE,
      });
      animalRepository.findMany.mockResolvedValueOnce({
        items: [existing],
        total: 1,
      });

      const result = await service.getAnimals(farmId, { page: 1, limit: 20 });
      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe("archiveAnimal", () => {
    it("should soft-delete animal and emit ANIMAL_ARCHIVED audit log", async () => {
      const existing = AnimalEntity.create({
        id: "55555555-5555-5555-5555-555555555555",
        farmId,
        tagNumber: "COW-100",
        species: AnimalSpecies.COW,
        gender: AnimalGender.FEMALE,
      });
      animalRepository.findById.mockResolvedValueOnce(existing);

      const deleted = AnimalEntity.create({
        id: existing.id,
        farmId,
        tagNumber: "COW-100",
        species: AnimalSpecies.COW,
        gender: AnimalGender.FEMALE,
      });
      deleted.softDelete();
      animalRepository.softDelete.mockResolvedValueOnce(deleted);

      const result = await service.archiveAnimal(
        existing.id,
        farmId,
        actorUserId
      );

      expect(animalRepository.softDelete).toHaveBeenCalled();
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ANIMAL_ARCHIVED",
          entityId: existing.id,
        }),
        expect.anything()
      );
      expect(result.status).toBeDefined();
    });
  });

  describe("lookupByIdentifier", () => {
    it("should return animal response dto when found by identifier", async () => {
      const existing = AnimalEntity.create({
        farmId,
        tagNumber: "COW-100",
        rfidNumber: "982000412345678",
        species: AnimalSpecies.COW,
        gender: AnimalGender.FEMALE,
      });
      animalRepository.findByIdentifier.mockResolvedValueOnce(existing);

      const result = await service.lookupByIdentifier("982000412345678", farmId);
      expect(animalRepository.findByIdentifier).toHaveBeenCalledWith(
        "982000412345678",
        farmId
      );
      expect(result.rfidNumber).toBe("982000412345678");
      expect(result.tagNumber).toBe("COW-100");
    });

    it("should throw EntityNotFoundException when identifier not found", async () => {
      animalRepository.findByIdentifier.mockResolvedValueOnce(null);

      await expect(
        service.lookupByIdentifier("NON-EXISTENT", farmId)
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe("checkTagAvailability", () => {
    it("should report tag and rfid as available when neither exists", async () => {
      animalRepository.findByTagNumber.mockResolvedValueOnce(null);
      animalRepository.findByRfidNumber.mockResolvedValueOnce(null);

      const result = await service.checkTagAvailability(farmId, {
        tagNumber: "COW-NEW",
        rfidNumber: "RFID-NEW",
      });

      expect(result.tagNumber).toEqual({
        value: "COW-NEW",
        isAvailable: true,
      });
      expect(result.rfidNumber).toEqual({
        value: "RFID-NEW",
        isAvailable: true,
      });
    });

    it("should report tag as unavailable when active tag exists in farm", async () => {
      const takenAnimal = AnimalEntity.create({
        id: "66666666-6666-6666-6666-666666666666",
        farmId,
        tagNumber: "COW-TAKEN",
        species: AnimalSpecies.COW,
        gender: AnimalGender.FEMALE,
      });
      animalRepository.findByTagNumber.mockResolvedValueOnce(takenAnimal);

      const result = await service.checkTagAvailability(farmId, {
        tagNumber: "COW-TAKEN",
      });

      expect(result.tagNumber).toEqual({
        value: "COW-TAKEN",
        isAvailable: false,
        conflictingAnimalId: takenAnimal.id,
      });
      expect(result.rfidNumber).toBeUndefined();
    });

    it("should report rfid as unavailable when active rfid exists in farm", async () => {
      const takenAnimal = AnimalEntity.create({
        id: "77777777-7777-7777-7777-777777777777",
        farmId,
        tagNumber: "COW-OTHER",
        rfidNumber: "RFID-TAKEN",
        species: AnimalSpecies.COW,
        gender: AnimalGender.FEMALE,
      });
      animalRepository.findByRfidNumber.mockResolvedValueOnce(takenAnimal);

      const result = await service.checkTagAvailability(farmId, {
        rfidNumber: "RFID-TAKEN",
      });

      expect(result.tagNumber).toBeUndefined();
      expect(result.rfidNumber).toEqual({
        value: "RFID-TAKEN",
        isAvailable: false,
        conflictingAnimalId: takenAnimal.id,
      });
    });
  });

  describe("getAnimalLineage", () => {
    const rootAnimal = AnimalEntity.create({
      id: "11111111-1111-1111-1111-111111111111",
      farmId,
      tagNumber: "CALF-100",
      species: AnimalSpecies.COW,
      gender: AnimalGender.FEMALE,
      sireId: "22222222-2222-2222-2222-222222222222",
      damId: "33333333-3333-3333-3333-333333333333",
    });

    it("should throw EntityNotFoundException if animal is not found", async () => {
      animalRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.getAnimalLineage("non-existent", farmId)
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should return lineage for animal without pedigree", async () => {
      const orphan = AnimalEntity.create({
        id: "44444444-4444-4444-4444-444444444444",
        farmId,
        tagNumber: "ORPHAN-01",
        species: AnimalSpecies.COW,
        gender: AnimalGender.FEMALE,
      });
      animalRepository.findById.mockResolvedValueOnce(orphan);
      animalRepository.findAncestors.mockResolvedValueOnce([]);
      animalRepository.findDirectOffspring.mockResolvedValueOnce([]);

      const result = await service.getAnimalLineage(orphan.id, farmId);

      expect(result.rootAnimal.id).toBe(orphan.id);
      expect(result.rootAnimal.sire).toBeNull();
      expect(result.rootAnimal.dam).toBeNull();
      expect(result.inbreedingCoefficient).toBe(0);
      expect(result.inbreedingRisk).toBe(InbreedingRiskLevel.LOW);
      expect(result.totalAncestors).toBe(0);
      expect(result.directOffspring).toHaveLength(0);
    });

    it("should return multi-generation hierarchical pedigree with parents and grandparents", async () => {
      animalRepository.findById.mockResolvedValueOnce(rootAnimal);

      const mockAncestors = [
        {
          id: "22222222-2222-2222-2222-222222222222",
          tag_number: "SIRE-01",
          rfid_number: null,
          name: "Titan",
          species: AnimalSpecies.COW,
          breed: "Holstein",
          gender: AnimalGender.MALE,
          date_of_birth: new Date("2020-01-01"),
          status: AnimalStatus.ACTIVE,
          sire_id: "55555555-5555-5555-5555-555555555555",
          dam_id: null,
          generation: 1,
          branch: "SIRE" as const,
        },
        {
          id: "33333333-3333-3333-3333-333333333333",
          tag_number: "DAM-01",
          rfid_number: null,
          name: "Bella",
          species: AnimalSpecies.COW,
          breed: "Holstein",
          gender: AnimalGender.FEMALE,
          date_of_birth: new Date("2020-02-01"),
          status: AnimalStatus.ACTIVE,
          sire_id: null,
          dam_id: null,
          generation: 1,
          branch: "DAM" as const,
        },
        {
          id: "55555555-5555-5555-5555-555555555555",
          tag_number: "GRAND-SIRE",
          rfid_number: null,
          name: "Goliath",
          species: AnimalSpecies.COW,
          breed: "Holstein",
          gender: AnimalGender.MALE,
          date_of_birth: new Date("2017-01-01"),
          status: AnimalStatus.ACTIVE,
          sire_id: null,
          dam_id: null,
          generation: 2,
          branch: "SIRE" as const,
        },
      ];

      animalRepository.findAncestors.mockResolvedValueOnce(mockAncestors);
      animalRepository.findDirectOffspring.mockResolvedValueOnce([]);

      const result = await service.getAnimalLineage(rootAnimal.id, farmId);

      expect(result.rootAnimal.tagNumber).toBe("CALF-100");
      expect(result.rootAnimal.sire).toBeDefined();
      expect(result.rootAnimal.sire?.tagNumber).toBe("SIRE-01");
      expect(result.rootAnimal.sire?.sire?.tagNumber).toBe("GRAND-SIRE");
      expect(result.rootAnimal.dam?.tagNumber).toBe("DAM-01");
      expect(result.totalAncestors).toBe(3);
      expect(result.ancestorGenerationsFound).toBe(2);
      expect(result.inbreedingCoefficient).toBe(0);
      expect(result.inbreedingRisk).toBe(InbreedingRiskLevel.LOW);
    });

    it("should compute Wright's inbreeding coefficient for half-siblings sharing a sire", async () => {
      // Inbred animal whose sire and dam share the same sire (GRAND-BULL)
      animalRepository.findById.mockResolvedValueOnce(rootAnimal);

      const commonSireId = "99999999-9999-9999-9999-999999999999";
      const mockAncestors = [
        {
          id: "22222222-2222-2222-2222-222222222222", // Sire
          tag_number: "SIRE-01",
          rfid_number: null,
          name: "Sire One",
          species: AnimalSpecies.COW,
          breed: "Holstein",
          gender: AnimalGender.MALE,
          date_of_birth: new Date("2020-01-01"),
          status: AnimalStatus.ACTIVE,
          sire_id: commonSireId,
          dam_id: null,
          generation: 1,
          branch: "SIRE" as const,
        },
        {
          id: "33333333-3333-3333-3333-333333333333", // Dam
          tag_number: "DAM-01",
          rfid_number: null,
          name: "Dam One",
          species: AnimalSpecies.COW,
          breed: "Holstein",
          gender: AnimalGender.FEMALE,
          date_of_birth: new Date("2020-02-01"),
          status: AnimalStatus.ACTIVE,
          sire_id: commonSireId,
          dam_id: null,
          generation: 1,
          branch: "DAM" as const,
        },
        {
          id: commonSireId, // Common grandfather
          tag_number: "GRAND-BULL",
          rfid_number: null,
          name: "Common Bull",
          species: AnimalSpecies.COW,
          breed: "Holstein",
          gender: AnimalGender.MALE,
          date_of_birth: new Date("2016-01-01"),
          status: AnimalStatus.ACTIVE,
          sire_id: null,
          dam_id: null,
          generation: 2,
          branch: "SIRE" as const,
        },
        {
          id: commonSireId, // Common grandfather reached through DAM
          tag_number: "GRAND-BULL",
          rfid_number: null,
          name: "Common Bull",
          species: AnimalSpecies.COW,
          breed: "Holstein",
          gender: AnimalGender.MALE,
          date_of_birth: new Date("2016-01-01"),
          status: AnimalStatus.ACTIVE,
          sire_id: null,
          dam_id: null,
          generation: 2,
          branch: "DAM" as const,
        },
      ];

      animalRepository.findAncestors.mockResolvedValueOnce(mockAncestors);
      animalRepository.findDirectOffspring.mockResolvedValueOnce([]);

      const result = await service.getAnimalLineage(rootAnimal.id, farmId);

      // n1 = 2 - 1 = 1, n2 = 2 - 1 = 1. Coeff = (0.5)^(1+1+1) = 0.125
      expect(result.inbreedingCoefficient).toBe(0.125);
      expect(result.inbreedingRisk).toBe(InbreedingRiskLevel.CRITICAL);
    });

    it("should handle circular references gracefully without infinite loops", async () => {
      animalRepository.findById.mockResolvedValueOnce(rootAnimal);

      // Mutually referencing nodes
      const cyclicAncestors = [
        {
          id: "22222222-2222-2222-2222-222222222222",
          tag_number: "CYCLE-A",
          rfid_number: null,
          name: null,
          species: AnimalSpecies.COW,
          breed: null,
          gender: AnimalGender.MALE,
          date_of_birth: null,
          status: AnimalStatus.ACTIVE,
          sire_id: "33333333-3333-3333-3333-333333333333",
          dam_id: null,
          generation: 1,
          branch: "SIRE" as const,
        },
        {
          id: "33333333-3333-3333-3333-333333333333",
          tag_number: "CYCLE-B",
          rfid_number: null,
          name: null,
          species: AnimalSpecies.COW,
          breed: null,
          gender: AnimalGender.FEMALE,
          date_of_birth: null,
          status: AnimalStatus.ACTIVE,
          sire_id: "22222222-2222-2222-2222-222222222222",
          dam_id: null,
          generation: 2,
          branch: "SIRE" as const,
        },
      ];

      animalRepository.findAncestors.mockResolvedValueOnce(cyclicAncestors);
      animalRepository.findDirectOffspring.mockResolvedValueOnce([]);

      const result = await service.getAnimalLineage(rootAnimal.id, farmId);
      expect(result.rootAnimal.sire?.tagNumber).toBe("CYCLE-A");
      expect(result.rootAnimal.sire?.sire?.tagNumber).toBe("CYCLE-B");
      // Cycle terminated
      expect(result.rootAnimal.sire?.sire?.sire).toBeNull();
    });

    it("should include direct offspring with other parent metadata", async () => {
      animalRepository.findById.mockResolvedValueOnce(rootAnimal);
      animalRepository.findAncestors.mockResolvedValueOnce([]);

      const mockOffspring = [
        {
          id: "88888888-8888-8888-8888-888888888888",
          tag_number: "CALF-01",
          rfid_number: "982000111222333",
          name: "Baby Daisy",
          species: AnimalSpecies.COW,
          breed: "Holstein",
          gender: AnimalGender.FEMALE,
          date_of_birth: new Date("2024-03-01"),
          status: AnimalStatus.ACTIVE,
          other_parent_id: "99999999-9999-9999-9999-999999999999",
          other_parent_tag_number: "BULL-55",
          other_parent_name: "Champion",
        },
      ];
      animalRepository.findDirectOffspring.mockResolvedValueOnce(mockOffspring);

      const result = await service.getAnimalLineage(rootAnimal.id, farmId);

      expect(result.directOffspring).toHaveLength(1);
      expect(result.directOffspring[0].tagNumber).toBe("CALF-01");
      expect(result.directOffspring[0].rfidNumber).toBe("982000111222333");
      expect(result.directOffspring[0].otherParentTagNumber).toBe("BULL-55");
      expect(result.directOffspring[0].otherParentName).toBe("Champion");
      expect(result.totalOffspring).toBe(1);
    });
  });

  describe("recordWeight", () => {
    const testAnimal = AnimalEntity.create({
      id: "11111111-1111-1111-1111-111111111111",
      farmId,
      tagNumber: "COW-100",
      species: AnimalSpecies.COW,
      gender: AnimalGender.FEMALE,
      dateOfBirth: new Date("2023-01-01"),
      weightKg: 400,
    });

    it("should throw EntityNotFoundException if animal not found", async () => {
      animalRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.recordWeight(
          "unknown-id",
          farmId,
          { weightKg: 450, recordedAt: new Date().toISOString() },
          actorUserId
        )
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw ValidationDomainException if recordedAt is in the future", async () => {
      animalRepository.findById.mockResolvedValueOnce(testAnimal);

      const futureDate = new Date(Date.now() + 10000000).toISOString();

      await expect(
        service.recordWeight(
          testAnimal.id,
          farmId,
          { weightKg: 450, recordedAt: futureDate },
          actorUserId
        )
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should record weight, update animal current weight if it is latest, and record audit log", async () => {
      const animalInstance = AnimalEntity.create({
        id: "11111111-1111-1111-1111-111111111111",
        farmId,
        tagNumber: "COW-100",
        species: AnimalSpecies.COW,
        gender: AnimalGender.FEMALE,
        dateOfBirth: new Date("2023-01-01"),
        weightKg: 400,
      });

      animalRepository.findById.mockResolvedValueOnce(animalInstance);

      const createdEntity = AnimalWeightLogEntity.create({
        id: "weight-log-01",
        farmId,
        animalId: animalInstance.id,
        recordedById: actorUserId,
        weightKg: 450,
        recordedAt: new Date("2024-01-01T10:00:00.000Z"),
        notes: "Routine weigh-in",
      });

      animalWeightRepository.create.mockResolvedValueOnce(createdEntity);
      animalWeightRepository.findLatestByAnimalId.mockResolvedValueOnce(createdEntity);
      animalRepository.update.mockResolvedValueOnce(animalInstance);

      const result = await service.recordWeight(
        animalInstance.id,
        farmId,
        {
          weightKg: 450,
          recordedAt: "2024-01-01T10:00:00.000Z",
          notes: "Routine weigh-in",
        },
        actorUserId,
        "trace-1"
      );

      expect(result.id).toBe("weight-log-01");
      expect(result.weightKg).toBe(450);
      expect(result.ageDays).toBeGreaterThan(0);
      expect(animalInstance.weightKg).toBe(450);
      expect(animalRepository.update).toHaveBeenCalledWith(
        animalInstance,
        expect.anything()
      );
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: actorUserId,
          action: "ANIMAL_WEIGHT_RECORDED",
          entityType: "AnimalWeightLog",
          entityId: "weight-log-01",
        }),
        expect.anything()
      );
    });

    it("should not update animal current weight if newly recorded weight is older than latest", async () => {
      const animalInstance = AnimalEntity.create({
        id: "11111111-1111-1111-1111-111111111111",
        farmId,
        tagNumber: "COW-100",
        species: AnimalSpecies.COW,
        gender: AnimalGender.FEMALE,
        dateOfBirth: new Date("2023-01-01"),
        weightKg: 500,
      });

      animalRepository.findById.mockResolvedValueOnce(animalInstance);

      const createdEntity = AnimalWeightLogEntity.create({
        id: "weight-log-old",
        farmId,
        animalId: animalInstance.id,
        recordedById: actorUserId,
        weightKg: 420,
        recordedAt: new Date("2023-06-01T10:00:00.000Z"),
      });

      const existingLatest = AnimalWeightLogEntity.create({
        id: "weight-log-latest",
        farmId,
        animalId: animalInstance.id,
        recordedById: actorUserId,
        weightKg: 500,
        recordedAt: new Date("2024-01-01T10:00:00.000Z"),
      });

      animalWeightRepository.create.mockResolvedValueOnce(createdEntity);
      animalWeightRepository.findLatestByAnimalId.mockResolvedValueOnce(existingLatest);

      const result = await service.recordWeight(
        animalInstance.id,
        farmId,
        {
          weightKg: 420,
          recordedAt: "2023-06-01T10:00:00.000Z",
        },
        actorUserId
      );

      expect(result.id).toBe("weight-log-old");
      expect(animalInstance.weightKg).toBe(500); // Unchanged
      expect(animalRepository.update).not.toHaveBeenCalled();
    });
  });

  describe("getWeightHistory", () => {
    const testAnimal = AnimalEntity.create({
      id: "11111111-1111-1111-1111-111111111111",
      farmId,
      tagNumber: "COW-100",
      species: AnimalSpecies.COW,
      gender: AnimalGender.FEMALE,
      dateOfBirth: new Date("2023-01-01"),
    });

    it("should throw EntityNotFoundException if animal does not exist", async () => {
      animalRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.getWeightHistory("unknown-id", farmId)
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should return paginated weight history with age calculation", async () => {
      animalRepository.findById.mockResolvedValueOnce(testAnimal);

      const log = AnimalWeightLogEntity.create({
        id: "log-1",
        farmId,
        animalId: testAnimal.id,
        recordedById: actorUserId,
        weightKg: 450,
        recordedAt: new Date("2023-07-01T00:00:00.000Z"),
      });

      animalWeightRepository.findByAnimalId.mockResolvedValueOnce({
        items: [log],
        total: 1,
      });

      const result = await service.getWeightHistory(testAnimal.id, farmId, {
        page: 1,
        limit: 10,
      });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe("log-1");
      expect(result.items[0].ageDays).toBe(181);
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });
  });

  describe("getGrowthCurve", () => {
    const testAnimal = AnimalEntity.create({
      id: "11111111-1111-1111-1111-111111111111",
      farmId,
      tagNumber: "COW-100",
      species: AnimalSpecies.COW,
      gender: AnimalGender.FEMALE,
      dateOfBirth: new Date("2023-01-01"),
      weightKg: 450,
    });

    it("should throw EntityNotFoundException if animal does not exist", async () => {
      animalRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.getGrowthCurve("unknown-id", farmId)
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should return empty growth curve when no weigh-ins exist", async () => {
      animalRepository.findById.mockResolvedValueOnce(testAnimal);
      animalWeightRepository.findAllChronological.mockResolvedValueOnce([]);

      const result = await service.getGrowthCurve(testAnimal.id, farmId);

      expect(result.points).toEqual([]);
      expect(result.startingWeightKg).toBeNull();
      expect(result.totalGainKg).toBeNull();
      expect(result.overallAdgKg).toBeNull();
      expect(result.trajectory).toBe(GrowthTrajectory.STEADY);
      expect(result.hasWeightLossAlert).toBe(false);
    });

    it("should return single-point growth curve with STEADY trajectory and 0 ADG", async () => {
      animalRepository.findById.mockResolvedValueOnce(testAnimal);

      const log = AnimalWeightLogEntity.create({
        id: "log-1",
        farmId,
        animalId: testAnimal.id,
        recordedById: actorUserId,
        weightKg: 300,
        recordedAt: new Date("2023-06-01T00:00:00.000Z"),
      });

      animalWeightRepository.findAllChronological.mockResolvedValueOnce([log]);

      const result = await service.getGrowthCurve(testAnimal.id, farmId);

      expect(result.points).toHaveLength(1);
      expect(result.points[0].intervalAdgKg).toBe(0);
      expect(result.startingWeightKg).toBe(300);
      expect(result.currentWeightKg).toBe(300);
      expect(result.overallAdgKg).toBe(0);
      expect(result.trajectory).toBe(GrowthTrajectory.STEADY);
      expect(result.hasWeightLossAlert).toBe(false);
    });

    it("should calculate multi-point ADG, total gain, and detect ACCELERATING trajectory", async () => {
      animalRepository.findById.mockResolvedValueOnce(testAnimal);

      // Point 1: Day 0, 100kg
      // Point 2: Day 50, 150kg (ADG = 50kg / 50d = 1.0 kg/day)
      // Point 3: Day 100, 230kg (ADG = 80kg / 50d = 1.6 kg/day)
      // Overall: (230 - 100) / 100 = 1.3 kg/day
      // Latest ADG (1.6) > overall (1.3 * 1.1 = 1.43) => ACCELERATING
      const log1 = AnimalWeightLogEntity.create({
        id: "log-1",
        farmId,
        animalId: testAnimal.id,
        recordedById: actorUserId,
        weightKg: 100,
        recordedAt: new Date("2023-01-01T00:00:00.000Z"),
      });
      const log2 = AnimalWeightLogEntity.create({
        id: "log-2",
        farmId,
        animalId: testAnimal.id,
        recordedById: actorUserId,
        weightKg: 150,
        recordedAt: new Date("2023-02-20T00:00:00.000Z"), // +50 days
      });
      const log3 = AnimalWeightLogEntity.create({
        id: "log-3",
        farmId,
        animalId: testAnimal.id,
        recordedById: actorUserId,
        weightKg: 230,
        recordedAt: new Date("2023-04-11T00:00:00.000Z"), // +50 days
      });

      animalWeightRepository.findAllChronological.mockResolvedValueOnce([log1, log2, log3]);

      const result = await service.getGrowthCurve(testAnimal.id, farmId);

      expect(result.points).toHaveLength(3);
      expect(result.startingWeightKg).toBe(100);
      expect(result.currentWeightKg).toBe(230);
      expect(result.totalGainKg).toBe(130);
      expect(result.overallAdgKg).toBe(1.3);
      expect(result.points[1].weightChangeKg).toBe(50);
      expect(result.points[1].intervalAdgKg).toBe(1);
      expect(result.points[2].weightChangeKg).toBe(80);
      expect(result.points[2].intervalAdgKg).toBe(1.6);
      expect(result.trajectory).toBe(GrowthTrajectory.ACCELERATING);
      expect(result.hasWeightLossAlert).toBe(false);
    });

    it("should detect SLOWING trajectory when latest ADG drops significantly", async () => {
      animalRepository.findById.mockResolvedValueOnce(testAnimal);

      // Point 1: Day 0, 100kg
      // Point 2: Day 50, 180kg (ADG = 1.6 kg/day)
      // Point 3: Day 100, 200kg (ADG = 20/50 = 0.4 kg/day)
      // Overall: (200 - 100) / 100 = 1.0 kg/day
      // Latest ADG (0.4) < overall (1.0 * 0.9 = 0.9) => SLOWING
      const log1 = AnimalWeightLogEntity.create({
        id: "log-1",
        farmId,
        animalId: testAnimal.id,
        recordedById: actorUserId,
        weightKg: 100,
        recordedAt: new Date("2023-01-01T00:00:00.000Z"),
      });
      const log2 = AnimalWeightLogEntity.create({
        id: "log-2",
        farmId,
        animalId: testAnimal.id,
        recordedById: actorUserId,
        weightKg: 180,
        recordedAt: new Date("2023-02-20T00:00:00.000Z"),
      });
      const log3 = AnimalWeightLogEntity.create({
        id: "log-3",
        farmId,
        animalId: testAnimal.id,
        recordedById: actorUserId,
        weightKg: 200,
        recordedAt: new Date("2023-04-11T00:00:00.000Z"),
      });

      animalWeightRepository.findAllChronological.mockResolvedValueOnce([log1, log2, log3]);

      const result = await service.getGrowthCurve(testAnimal.id, farmId);

      expect(result.trajectory).toBe(GrowthTrajectory.SLOWING);
      expect(result.hasWeightLossAlert).toBe(false);
    });

    it("should detect WEIGHT_LOSS trajectory and flag hasWeightLossAlert when weight drops", async () => {
      animalRepository.findById.mockResolvedValueOnce(testAnimal);

      // Point 1: Day 0, 200kg
      // Point 2: Day 30, 220kg
      // Point 3: Day 60, 210kg (Drop of 10kg)
      const log1 = AnimalWeightLogEntity.create({
        id: "log-1",
        farmId,
        animalId: testAnimal.id,
        recordedById: actorUserId,
        weightKg: 200,
        recordedAt: new Date("2023-01-01T00:00:00.000Z"),
      });
      const log2 = AnimalWeightLogEntity.create({
        id: "log-2",
        farmId,
        animalId: testAnimal.id,
        recordedById: actorUserId,
        weightKg: 220,
        recordedAt: new Date("2023-01-31T00:00:00.000Z"),
      });
      const log3 = AnimalWeightLogEntity.create({
        id: "log-3",
        farmId,
        animalId: testAnimal.id,
        recordedById: actorUserId,
        weightKg: 210,
        recordedAt: new Date("2023-03-02T00:00:00.000Z"),
      });

      animalWeightRepository.findAllChronological.mockResolvedValueOnce([log1, log2, log3]);

      const result = await service.getGrowthCurve(testAnimal.id, farmId);

      expect(result.trajectory).toBe(GrowthTrajectory.WEIGHT_LOSS);
      expect(result.hasWeightLossAlert).toBe(true);
      expect(result.points[2].weightChangeKg).toBe(-10);
    });
  });

  describe("deleteWeightLog", () => {
    const testAnimal = AnimalEntity.create({
      id: "11111111-1111-1111-1111-111111111111",
      farmId,
      tagNumber: "COW-100",
      species: AnimalSpecies.COW,
      gender: AnimalGender.FEMALE,
      dateOfBirth: new Date("2023-01-01"),
      weightKg: 450,
    });

    it("should throw EntityNotFoundException if animal does not exist", async () => {
      animalRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.deleteWeightLog("unknown-id", "log-id", farmId, actorUserId)
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw EntityNotFoundException if weight log does not exist or belongs to another animal", async () => {
      animalRepository.findById.mockResolvedValueOnce(testAnimal);
      animalWeightRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.deleteWeightLog(testAnimal.id, "unknown-log", farmId, actorUserId)
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should delete weight log, recalibrate animal weight to previous latest log, and record audit log", async () => {
      const animalInstance = AnimalEntity.create({
        id: "11111111-1111-1111-1111-111111111111",
        farmId,
        tagNumber: "COW-100",
        species: AnimalSpecies.COW,
        gender: AnimalGender.FEMALE,
        dateOfBirth: new Date("2023-01-01"),
        weightKg: 450,
      });

      const logToDelete = AnimalWeightLogEntity.create({
        id: "log-latest",
        farmId,
        animalId: animalInstance.id,
        recordedById: actorUserId,
        weightKg: 450,
        recordedAt: new Date("2024-01-01T00:00:00.000Z"),
      });

      const previousLog = AnimalWeightLogEntity.create({
        id: "log-previous",
        farmId,
        animalId: animalInstance.id,
        recordedById: actorUserId,
        weightKg: 420,
        recordedAt: new Date("2023-10-01T00:00:00.000Z"),
      });

      animalRepository.findById.mockResolvedValueOnce(animalInstance);
      animalWeightRepository.findById.mockResolvedValueOnce(logToDelete);
      animalWeightRepository.findLatestByAnimalId.mockResolvedValueOnce(previousLog);
      animalRepository.update.mockResolvedValueOnce(animalInstance);

      await service.deleteWeightLog(
        animalInstance.id,
        logToDelete.id,
        farmId,
        actorUserId,
        "trace-del-1"
      );

      expect(animalWeightRepository.delete).toHaveBeenCalledWith(
        logToDelete.id,
        farmId,
        expect.anything()
      );
      expect(animalInstance.weightKg).toBe(420); // Recalibrated to previous measurement
      expect(animalRepository.update).toHaveBeenCalledWith(
        animalInstance,
        expect.anything()
      );
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: actorUserId,
          action: "ANIMAL_WEIGHT_DELETED",
          entityType: "AnimalWeightLog",
          entityId: logToDelete.id,
        }),
        expect.anything()
      );
    });

    it("should set animal weight to null if deleted log was the only weight measurement", async () => {
      const animalInstance = AnimalEntity.create({
        id: "11111111-1111-1111-1111-111111111111",
        farmId,
        tagNumber: "COW-100",
        species: AnimalSpecies.COW,
        gender: AnimalGender.FEMALE,
        dateOfBirth: new Date("2023-01-01"),
        weightKg: 450,
      });

      const logToDelete = AnimalWeightLogEntity.create({
        id: "log-only",
        farmId,
        animalId: animalInstance.id,
        recordedById: actorUserId,
        weightKg: 450,
        recordedAt: new Date("2024-01-01T00:00:00.000Z"),
      });

      animalRepository.findById.mockResolvedValueOnce(animalInstance);
      animalWeightRepository.findById.mockResolvedValueOnce(logToDelete);
      animalWeightRepository.findLatestByAnimalId.mockResolvedValueOnce(null); // No remaining logs

      await service.deleteWeightLog(
        animalInstance.id,
        logToDelete.id,
        farmId,
        actorUserId
      );

      expect(animalInstance.weightKg).toBeNull();
      expect(animalRepository.update).toHaveBeenCalledWith(
        animalInstance,
        expect.anything()
      );
    });
  });

  describe("createImportJob", () => {
    const mockFile: Express.Multer.File = {
      fieldname: "file",
      originalname: "herd.csv",
      encoding: "7bit",
      mimetype: "text/csv",
      size: 512,
      buffer: Buffer.from("tagNumber,species,gender\nCOW-01,COW,FEMALE"),
      destination: "",
      filename: "herd.csv",
      path: "",
      stream: null as any,
    };

    it("should throw ValidationDomainException if no file is provided", async () => {
      await expect(
        service.createImportJob(farmId, null as any, actorUserId)
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if file size exceeds 10MB limit", async () => {
      const hugeFile = { ...mockFile, size: 15 * 1024 * 1024 };

      await expect(
        service.createImportJob(farmId, hugeFile, actorUserId)
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException for unsupported file extensions", async () => {
      const badFile = { ...mockFile, originalname: "herd.txt" };

      await expect(
        service.createImportJob(farmId, badFile, actorUserId)
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should create import job, write staging file, and enqueue job", async () => {
      const createdEntity = AnimalImportJobEntity.create({
        farmId,
        uploadedById: actorUserId,
        fileName: "herd.csv",
        fileSize: 512,
        fileType: "csv",
        filePath: "/tmp/staging.csv",
      });

      importJobRepository.create.mockResolvedValueOnce(createdEntity);
      importQueueService.enqueueImportJob.mockResolvedValueOnce(undefined);

      const result = await service.createImportJob(
        farmId,
        mockFile,
        actorUserId,
        "trace-import-1"
      );

      expect(result.id).toBe(createdEntity.id);
      expect(result.status).toBe(ImportJobStatus.PENDING);
      expect(importJobRepository.create).toHaveBeenCalled();
      expect(importQueueService.enqueueImportJob).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: createdEntity.id,
          farmId,
          actorUserId,
          traceId: "trace-import-1",
        })
      );
    });
  });

  describe("getImportJob", () => {
    it("should throw EntityNotFoundException if job not found", async () => {
      importJobRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.getImportJob("non-existent-job", farmId)
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should return job DTO if found", async () => {
      const jobEntity = AnimalImportJobEntity.create({
        farmId,
        uploadedById: actorUserId,
        fileName: "herd.csv",
        fileSize: 512,
        fileType: "csv",
      });

      importJobRepository.findById.mockResolvedValueOnce(jobEntity);

      const result = await service.getImportJob(jobEntity.id, farmId);

      expect(result.id).toBe(jobEntity.id);
      expect(result.fileName).toBe("herd.csv");
    });
  });

  describe("getImportJobs", () => {
    it("should return paginated import jobs", async () => {
      const jobEntity = AnimalImportJobEntity.create({
        farmId,
        uploadedById: actorUserId,
        fileName: "herd.csv",
        fileSize: 512,
        fileType: "csv",
      });

      importJobRepository.findByFarmId.mockResolvedValueOnce({
        items: [jobEntity],
        total: 1,
      });

      const result = await service.getImportJobs(farmId, 1, 10);

      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
    });
  });

  describe("generateImportTemplate", () => {
    it("should return a formatted CSV template with required headers", () => {
      const template = service.generateImportTemplate();

      expect(template).toContain("tagNumber,name,species,breed,gender,dateOfBirth,weightKg,rfidNumber,sireTag,damTag");
      expect(template).toContain("COW-001");
      expect(template).toContain("BULL-002");
    });
  });
});
