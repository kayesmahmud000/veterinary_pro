import {
  AnimalGender,
  AnimalSpecies,
  AnimalStatus,
} from "@vetralink/shared-types";
import { AnimalsService } from "./animals.service";
import { IAnimalRepository } from "../repositories/animal.repository.interface";
import { IAuditLogRepository } from "../../audit/repositories/audit-log.repository.interface";
import { ITransactionManager } from "../../prisma/interfaces/transaction.interface";
import { AnimalEntity } from "../entities/animal.entity";
import {
  EntityConflictException,
  EntityNotFoundException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";

describe("AnimalsService", () => {
  let service: AnimalsService;
  let animalRepository: jest.Mocked<IAnimalRepository>;
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
});
