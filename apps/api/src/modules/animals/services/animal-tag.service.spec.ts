import { Test, TestingModule } from "@nestjs/testing";
import { ConfigService } from "@nestjs/config";
import {
  AnimalGender,
  AnimalSpecies,
  AnimalStatus,
  TagBadgeLayout,
  TagBadgePageSize,
} from "@vetralink/shared-types";
import { AnimalTagService } from "./animal-tag.service";
import {
  ANIMAL_REPOSITORY,
  IAnimalRepository,
} from "../repositories/animal.repository.interface";
import { AnimalEntity } from "../entities/animal.entity";
import {
  EntityNotFoundException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";

describe("AnimalTagService", () => {
  let service: AnimalTagService;
  let animalRepository: jest.Mocked<IAnimalRepository>;

  const mockFarmId = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
  const mockAnimalId = "11111111-1111-1111-1111-111111111111";

  const createMockAnimal = (overrides?: Partial<Parameters<typeof AnimalEntity.reconstitute>[0]>): AnimalEntity => {
    return AnimalEntity.reconstitute({
      id: mockAnimalId,
      farmId: mockFarmId,
      tagNumber: "COW-100",
      rfidNumber: "982000123456789",
      name: "Bella",
      species: AnimalSpecies.COW,
      breed: "Holstein Friesian",
      gender: AnimalGender.FEMALE,
      dateOfBirth: new Date("2023-01-15T00:00:00Z"),
      weightKg: 450,
      status: AnimalStatus.ACTIVE,
      sireId: "22222222-2222-2222-2222-222222222222",
      damId: "33333333-3333-3333-3333-333333333333",
      sire: { id: "22222222-2222-2222-2222-222222222222", tagNumber: "BULL-01", name: "Atlas" },
      dam: { id: "33333333-3333-3333-3333-333333333333", tagNumber: "COW-05", name: "Daisy" },
      metadata: {},
      syncVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
      ...overrides,
    });
  };

  beforeEach(async () => {
    animalRepository = {
      create: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      findByTagNumber: jest.fn(),
      findByRfidNumber: jest.fn(),
      findByIdentifier: jest.fn(),
      findMany: jest.fn(),
      findManyByIds: jest.fn(),
      existsActiveTag: jest.fn(),
      existsActiveRfid: jest.fn(),
      softDelete: jest.fn(),
      findAncestors: jest.fn(),
      findDirectOffspring: jest.fn(),
      getFarmName: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnimalTagService,
        {
          provide: ANIMAL_REPOSITORY,
          useValue: animalRepository,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === "APP_URL") return "https://vetralink.pro";
              return null;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AnimalTagService>(AnimalTagService);
  });

  describe("generateQrCode", () => {
    it("should return QR code DTO with data URL and canonical URL payload", async () => {
      const mockAnimal = createMockAnimal();
      animalRepository.findById.mockResolvedValue(mockAnimal);

      const result = await service.generateQrCode(mockFarmId, mockAnimalId);

      expect(result.animalId).toBe(mockAnimalId);
      expect(result.farmId).toBe(mockFarmId);
      expect(result.tagNumber).toBe("COW-100");
      expect(result.payload).toBe(
        `https://vetralink.pro/farms/${mockFarmId}/animals/${mockAnimalId}?tag=COW-100`
      );
      expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    });

    it("should throw EntityNotFoundException if animal does not belong to farm", async () => {
      animalRepository.findById.mockResolvedValue(null);

      await expect(service.generateQrCode(mockFarmId, mockAnimalId)).rejects.toThrow(
        EntityNotFoundException
      );
    });
  });

  describe("generateQrCodePngBuffer", () => {
    it("should generate valid binary PNG buffer with tagNumber", async () => {
      const mockAnimal = createMockAnimal();
      animalRepository.findById.mockResolvedValue(mockAnimal);

      const result = await service.generateQrCodePngBuffer(mockFarmId, mockAnimalId);

      expect(result.tagNumber).toBe("COW-100");
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      // Verify PNG magic header: 0x89 0x50 0x4E 0x47
      expect(result.buffer[0]).toBe(0x89);
      expect(result.buffer[1]).toBe(0x50);
      expect(result.buffer[2]).toBe(0x4e);
      expect(result.buffer[3]).toBe(0x47);
    });
  });

  describe("generateSingleTagBadgePdf", () => {
    it("should generate valid PDF buffer for single placard", async () => {
      const mockAnimal = createMockAnimal();
      animalRepository.findById.mockResolvedValue(mockAnimal);
      animalRepository.getFarmName.mockResolvedValue("Green Valley Dairy");

      const result = await service.generateSingleTagBadgePdf(mockFarmId, mockAnimalId);

      expect(result.tagNumber).toBe("COW-100");
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      // Verify PDF magic header: %PDF-
      const pdfHeader = result.buffer.subarray(0, 5).toString("ascii");
      expect(pdfHeader).toBe("%PDF-");
    });

    it("should handle missing optional attributes without error", async () => {
      const mockAnimal = createMockAnimal({
        rfidNumber: null,
        name: null,
        breed: null,
        dateOfBirth: null,
        sire: null,
        dam: null,
      });
      animalRepository.findById.mockResolvedValue(mockAnimal);
      animalRepository.getFarmName.mockResolvedValue(null);

      const result = await service.generateSingleTagBadgePdf(mockFarmId, mockAnimalId, {
        includePedigree: false,
      });

      expect(result.tagNumber).toBe("COW-100");
      expect(result.buffer.length).toBeGreaterThan(1000);
    });
  });

  describe("generateBatchTagBadgesPdf", () => {
    it("should throw ValidationDomainException if more than 100 animals requested", async () => {
      const longList = Array.from({ length: 101 }, (_, i) => `uuid-${i}`);

      await expect(
        service.generateBatchTagBadgesPdf(mockFarmId, { animalIds: longList })
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if no animals found", async () => {
      animalRepository.findManyByIds.mockResolvedValue([]);

      await expect(
        service.generateBatchTagBadgesPdf(mockFarmId, {
          animalIds: ["non-existent-id"],
        })
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should generate multi-page grid PDF for requested animal IDs", async () => {
      const animals = Array.from({ length: 9 }, (_, i) =>
        createMockAnimal({
          id: `animal-${i}`,
          tagNumber: `COW-${100 + i}`,
        })
      );
      animalRepository.findManyByIds.mockResolvedValue(animals);
      animalRepository.getFarmName.mockResolvedValue("Sunrise Farms");

      const result = await service.generateBatchTagBadgesPdf(mockFarmId, {
        animalIds: animals.map((a) => a.id),
        layout: TagBadgeLayout.GRID_2X3,
        pageSize: TagBadgePageSize.A4,
      });

      expect(result.count).toBe(9);
      expect(Buffer.isBuffer(result.buffer)).toBe(true);
      const pdfHeader = result.buffer.subarray(0, 5).toString("ascii");
      expect(pdfHeader).toBe("%PDF-");
    }, 20000);

    it("should generate grid PDF when filtering by species and status", async () => {
      const animals = [createMockAnimal()];
      animalRepository.findMany.mockResolvedValue({ items: animals, total: 1 });
      animalRepository.getFarmName.mockResolvedValue("Highland Herd");

      const result = await service.generateBatchTagBadgesPdf(mockFarmId, {
        species: AnimalSpecies.COW,
        status: AnimalStatus.ACTIVE,
        layout: TagBadgeLayout.GRID_2X4,
        pageSize: TagBadgePageSize.LETTER,
      });

      expect(result.count).toBe(1);
      expect(result.buffer.length).toBeGreaterThan(1000);
    });
  });
});
