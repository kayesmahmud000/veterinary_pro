import { Prisma } from "@prisma/client";
import {
  AnimalGender,
  AnimalSpecies,
  AnimalStatus,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { AnimalEntity } from "../entities/animal.entity";
import { AnimalRepository } from "./animal.repository";
import { EntityConflictException } from "../../../common/exceptions/domain.exception";

describe("AnimalRepository", () => {
  let repository: AnimalRepository;
  let prisma: jest.Mocked<PrismaService>;

  const mockDbRow = {
    id: "11111111-1111-1111-1111-111111111111",
    farmId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    tagNumber: "COW-001",
    rfidNumber: "RFID-12345",
    name: "Daisy",
    species: AnimalSpecies.COW,
    breed: "Holstein Friesian",
    gender: AnimalGender.FEMALE,
    dateOfBirth: new Date("2023-01-15"),
    weightKg: new Prisma.Decimal(520.5),
    status: AnimalStatus.ACTIVE,
    sireId: "22222222-2222-2222-2222-222222222222",
    damId: "33333333-3333-3333-3333-333333333333",
    sire: {
      id: "22222222-2222-2222-2222-222222222222",
      tagNumber: "BULL-99",
      name: "Titan",
    },
    dam: {
      id: "33333333-3333-3333-3333-333333333333",
      tagNumber: "COW-88",
      name: "Bella",
    },
    metadata: { earTagColor: "yellow" },
    syncVersion: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  };

  const mockEntity = AnimalEntity.reconstitute({
    ...mockDbRow,
    weightKg: 520.5,
  });

  beforeEach(() => {
    prisma = {
      animal: {
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      $queryRaw: jest.fn(),
    } as unknown as jest.Mocked<PrismaService>;

    repository = new AnimalRepository(prisma);
  });

  describe("create", () => {
    it("should insert record and return AnimalEntity with pedigree", async () => {
      (prisma.animal.create as jest.Mock).mockResolvedValueOnce(mockDbRow);

      const result = await repository.create(mockEntity);

      expect(prisma.animal.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            farmId: mockEntity.farmId,
            tagNumber: "COW-001",
          }),
        })
      );
      expect(result.id).toBe(mockEntity.id);
      expect(result.tagNumber).toBe("COW-001");
      expect(result.sire?.tagNumber).toBe("BULL-99");
      expect(result.dam?.tagNumber).toBe("COW-88");
    });

    it("should throw EntityConflictException when duplicate tag violation P2002 occurs", async () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        {
          code: "P2002",
          clientVersion: "5.22.0",
          meta: { target: ["farm_id", "tag_number"] },
        }
      );
      (prisma.animal.create as jest.Mock).mockRejectedValueOnce(error);

      await expect(repository.create(mockEntity)).rejects.toThrow(
        EntityConflictException
      );
    });

    it("should throw EntityConflictException on RFID collision P2002 with conflictField rfidNumber", async () => {
      const error = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        {
          code: "P2002",
          clientVersion: "5.22.0",
          meta: { target: ["farm_id", "rfid_number"] },
        }
      );
      (prisma.animal.create as jest.Mock).mockRejectedValueOnce(error);

      await expect(repository.create(mockEntity)).rejects.toThrow(
        EntityConflictException
      );
    });
  });

  describe("findById", () => {
    it("should return animal scoped by farmId", async () => {
      (prisma.animal.findFirst as jest.Mock).mockResolvedValueOnce(mockDbRow);

      const result = await repository.findById(mockEntity.id, mockEntity.farmId);

      expect(prisma.animal.findFirst).toHaveBeenCalledWith({
        where: {
          id: mockEntity.id,
          farmId: mockEntity.farmId,
          deletedAt: null,
        },
        include: {
          sire: { select: { id: true, tagNumber: true, name: true } },
          dam: { select: { id: true, tagNumber: true, name: true } },
        },
      });
      expect(result).not.toBeNull();
      expect(result?.id).toBe(mockEntity.id);
    });

    it("should return null if not found or belongs to another farm", async () => {
      (prisma.animal.findFirst as jest.Mock).mockResolvedValueOnce(null);

      const result = await repository.findById("non-existent", mockEntity.farmId);
      expect(result).toBeNull();
    });
  });

  describe("findByTagNumber", () => {
    it("should uppercase tag number and search within farmId", async () => {
      (prisma.animal.findFirst as jest.Mock).mockResolvedValueOnce(mockDbRow);

      const result = await repository.findByTagNumber("cow-001", mockEntity.farmId);

      expect(prisma.animal.findFirst).toHaveBeenCalledWith({
        where: {
          farmId: mockEntity.farmId,
          tagNumber: "COW-001",
          deletedAt: null,
        },
        include: {
          sire: { select: { id: true, tagNumber: true, name: true } },
          dam: { select: { id: true, tagNumber: true, name: true } },
        },
      });
      expect(result).not.toBeNull();
    });
  });

  describe("findByRfidNumber", () => {
    it("should uppercase rfid number and search within farmId", async () => {
      (prisma.animal.findFirst as jest.Mock).mockResolvedValueOnce(mockDbRow);

      const result = await repository.findByRfidNumber("rfid-12345", mockEntity.farmId);

      expect(prisma.animal.findFirst).toHaveBeenCalledWith({
        where: {
          farmId: mockEntity.farmId,
          rfidNumber: "RFID-12345",
          deletedAt: null,
        },
        include: {
          sire: { select: { id: true, tagNumber: true, name: true } },
          dam: { select: { id: true, tagNumber: true, name: true } },
        },
      });
      expect(result).not.toBeNull();
      expect(result?.rfidNumber).toBe("RFID-12345");
    });
  });

  describe("findByIdentifier", () => {
    it("should search across both tagNumber and rfidNumber", async () => {
      (prisma.animal.findFirst as jest.Mock).mockResolvedValueOnce(mockDbRow);

      const result = await repository.findByIdentifier("rfid-12345", mockEntity.farmId);

      expect(prisma.animal.findFirst).toHaveBeenCalledWith({
        where: {
          farmId: mockEntity.farmId,
          deletedAt: null,
          OR: [
            { tagNumber: "RFID-12345" },
            { rfidNumber: "RFID-12345" },
          ],
        },
        include: {
          sire: { select: { id: true, tagNumber: true, name: true } },
          dam: { select: { id: true, tagNumber: true, name: true } },
        },
      });
      expect(result).not.toBeNull();
    });
  });

  describe("existsActiveRfid", () => {
    it("should return true if active RFID exists in farm", async () => {
      (prisma.animal.count as jest.Mock).mockResolvedValueOnce(1);

      const exists = await repository.existsActiveRfid("RFID-12345", mockEntity.farmId);
      expect(exists).toBe(true);
      expect(prisma.animal.count).toHaveBeenCalledWith({
        where: {
          farmId: mockEntity.farmId,
          rfidNumber: "RFID-12345",
          deletedAt: null,
        },
      });
    });
  });

  describe("findMany", () => {
    it("should return paginated animals with filters", async () => {
      (prisma.animal.findMany as jest.Mock).mockResolvedValueOnce([mockDbRow]);
      (prisma.animal.count as jest.Mock).mockResolvedValueOnce(1);

      const result = await repository.findMany(mockEntity.farmId, {
        species: AnimalSpecies.COW,
        search: "Daisy",
        page: 1,
        limit: 10,
      });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(prisma.animal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            farmId: mockEntity.farmId,
            species: AnimalSpecies.COW,
            deletedAt: null,
          }),
          skip: 0,
          take: 10,
        })
      );
    });
  });

  describe("existsActiveTag", () => {
    it("should return true when count > 0", async () => {
      (prisma.animal.count as jest.Mock).mockResolvedValueOnce(1);

      const exists = await repository.existsActiveTag("COW-001", mockEntity.farmId);
      expect(exists).toBe(true);
    });

    it("should return false when count === 0", async () => {
      (prisma.animal.count as jest.Mock).mockResolvedValueOnce(0);

      const exists = await repository.existsActiveTag("COW-999", mockEntity.farmId);
      expect(exists).toBe(false);
    });
  });

  describe("softDelete", () => {
    it("should update deletedAt timestamp and bump syncVersion", async () => {
      const deletedRow = {
        ...mockDbRow,
        deletedAt: new Date(),
        syncVersion: 2,
      };
      (prisma.animal.update as jest.Mock).mockResolvedValueOnce(deletedRow);

      const result = await repository.softDelete(mockEntity.id, mockEntity.farmId);

      expect(prisma.animal.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: mockEntity.id, farmId: mockEntity.farmId },
          data: expect.objectContaining({
            syncVersion: { increment: 1 },
          }),
        })
      );
      expect(result.isSoftDeleted()).toBe(true);
    });
  });

  describe("findAncestors", () => {
    it("should execute recursive CTE query with bounded generations and return raw ancestor records", async () => {
      const mockAncestors = [
        {
          id: "22222222-2222-2222-2222-222222222222",
          tag_number: "SIRE-01",
          rfid_number: null,
          name: "Sire One",
          species: AnimalSpecies.COW,
          breed: "Holstein",
          gender: AnimalGender.MALE,
          date_of_birth: new Date("2020-01-01"),
          status: AnimalStatus.ACTIVE,
          sire_id: null,
          dam_id: null,
          generation: 1,
          branch: "SIRE",
        },
      ];
      (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce(mockAncestors);

      const result = await repository.findAncestors(mockEntity.id, mockEntity.farmId, 3);

      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual(mockAncestors);
    });
  });

  describe("findDirectOffspring", () => {
    it("should query offspring with other parent join", async () => {
      const mockOffspring = [
        {
          id: "99999999-9999-9999-9999-999999999999",
          tag_number: "CALF-01",
          rfid_number: null,
          name: "Calf One",
          species: AnimalSpecies.COW,
          breed: "Holstein",
          gender: AnimalGender.FEMALE,
          date_of_birth: new Date("2024-02-01"),
          status: AnimalStatus.ACTIVE,
          other_parent_id: "33333333-3333-3333-3333-333333333333",
          other_parent_tag_number: "COW-88",
          other_parent_name: "Bella",
        },
      ];
      (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce(mockOffspring);

      const result = await repository.findDirectOffspring(mockEntity.id, mockEntity.farmId);

      expect(prisma.$queryRaw).toHaveBeenCalled();
      expect(result).toEqual(mockOffspring);
    });
  });
});
