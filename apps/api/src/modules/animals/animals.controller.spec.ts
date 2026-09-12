import { Test, TestingModule } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import {
  AnimalGender,
  AnimalSpecies,
  AnimalStatus,
  JwtPayload,
  UserRole,
  UserStatus,
} from "@vetralink/shared-types";
import { AnimalsController } from "./animals.controller";
import {
  ANIMALS_SERVICE,
  IAnimalsService,
} from "./services/animals.service.interface";
import { TOKEN_SERVICE } from "../auth/services/token.service.interface";
import { FARM_MEMBER_REPOSITORY } from "../farms/repositories/farm-member.repository.interface";

describe("AnimalsController", () => {
  let controller: AnimalsController;
  let animalsService: jest.Mocked<IAnimalsService>;

  const mockFarmId = "11111111-1111-1111-1111-111111111111";
  const mockUser: JwtPayload = {
    sub: "user-1111-1111-1111-111111111111",
    email: "farmer@vetralink.com",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const mockAnimalResponse = {
    id: "animal-1111-1111-1111-111111111111",
    farmId: mockFarmId,
    tagNumber: "COW-001",
    rfidNumber: null,
    name: "Daisy",
    species: AnimalSpecies.COW,
    breed: "Holstein",
    gender: AnimalGender.FEMALE,
    dateOfBirth: "2023-01-15",
    ageMonths: 14,
    weightKg: 520.5,
    status: AnimalStatus.ACTIVE,
    sireId: null,
    damId: null,
    sire: null,
    dam: null,
    metadata: {},
    syncVersion: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    animalsService = {
      registerAnimal: jest.fn(),
      updateAnimal: jest.fn(),
      getAnimalById: jest.fn(),
      getAnimals: jest.fn(),
      archiveAnimal: jest.fn(),
      lookupByIdentifier: jest.fn(),
      checkTagAvailability: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnimalsController],
      providers: [
        {
          provide: ANIMALS_SERVICE,
          useValue: animalsService,
        },
        {
          provide: TOKEN_SERVICE,
          useValue: { verifyAccessToken: jest.fn() },
        },
        {
          provide: FARM_MEMBER_REPOSITORY,
          useValue: { findMembership: jest.fn() },
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<AnimalsController>(AnimalsController);
  });

  describe("registerAnimal", () => {
    it("should delegate to animalsService.registerAnimal", async () => {
      animalsService.registerAnimal.mockResolvedValueOnce(mockAnimalResponse);

      const dto = {
        tagNumber: "COW-001",
        name: "Daisy",
        species: AnimalSpecies.COW,
        gender: AnimalGender.FEMALE,
      };

      const result = await controller.registerAnimal(
        mockFarmId,
        dto,
        mockUser,
        "trace-abc"
      );

      expect(animalsService.registerAnimal).toHaveBeenCalledWith(
        mockFarmId,
        dto,
        mockUser.sub,
        "trace-abc"
      );
      expect(result).toEqual(mockAnimalResponse);
    });
  });

  describe("getAnimals", () => {
    it("should delegate to animalsService.getAnimals with query params", async () => {
      const paginatedResult = {
        items: [mockAnimalResponse],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      };
      animalsService.getAnimals.mockResolvedValueOnce(paginatedResult);

      const query = { species: AnimalSpecies.COW, page: 1, limit: 20, sortBy: "createdAt" as const, sortOrder: "desc" as const };
      const result = await controller.getAnimals(mockFarmId, query);

      expect(animalsService.getAnimals).toHaveBeenCalledWith(mockFarmId, query);
      expect(result).toEqual(paginatedResult);
    });
  });

  describe("getAnimalById", () => {
    it("should delegate to animalsService.getAnimalById", async () => {
      animalsService.getAnimalById.mockResolvedValueOnce(mockAnimalResponse);

      const result = await controller.getAnimalById(mockFarmId, mockAnimalResponse.id);

      expect(animalsService.getAnimalById).toHaveBeenCalledWith(
        mockAnimalResponse.id,
        mockFarmId
      );
      expect(result).toEqual(mockAnimalResponse);
    });
  });

  describe("updateAnimal", () => {
    it("should delegate to animalsService.updateAnimal", async () => {
      const updatedResponse = { ...mockAnimalResponse, name: "Daisy Updated" };
      animalsService.updateAnimal.mockResolvedValueOnce(updatedResponse);

      const dto = { name: "Daisy Updated" };
      const result = await controller.updateAnimal(
        mockFarmId,
        mockAnimalResponse.id,
        dto,
        mockUser,
        "trace-xyz"
      );

      expect(animalsService.updateAnimal).toHaveBeenCalledWith(
        mockAnimalResponse.id,
        mockFarmId,
        dto,
        mockUser.sub,
        "trace-xyz"
      );
      expect(result.name).toBe("Daisy Updated");
    });
  });

  describe("archiveAnimal", () => {
    it("should delegate to animalsService.archiveAnimal", async () => {
      animalsService.archiveAnimal.mockResolvedValueOnce(mockAnimalResponse);

      const result = await controller.archiveAnimal(
        mockFarmId,
        mockAnimalResponse.id,
        mockUser,
        "trace-del"
      );

      expect(animalsService.archiveAnimal).toHaveBeenCalledWith(
        mockAnimalResponse.id,
        mockFarmId,
        mockUser.sub,
        "trace-del"
      );
      expect(result).toEqual(mockAnimalResponse);
    });
  });

  describe("checkTagAvailability", () => {
    it("should delegate to animalsService.checkTagAvailability", async () => {
      const mockAvailability = {
        tagNumber: { value: "COW-001", isAvailable: true },
        rfidNumber: { value: "982000412345678", isAvailable: true },
      };
      animalsService.checkTagAvailability.mockResolvedValueOnce(mockAvailability);

      const query = {
        tagNumber: "COW-001",
        rfidNumber: "982000412345678",
      };
      const result = await controller.checkTagAvailability(mockFarmId, query);

      expect(animalsService.checkTagAvailability).toHaveBeenCalledWith(
        mockFarmId,
        query
      );
      expect(result).toEqual(mockAvailability);
    });
  });

  describe("lookupByIdentifier", () => {
    it("should delegate to animalsService.lookupByIdentifier", async () => {
      animalsService.lookupByIdentifier.mockResolvedValueOnce(mockAnimalResponse);

      const result = await controller.lookupByIdentifier(
        mockFarmId,
        "982000412345678"
      );

      expect(animalsService.lookupByIdentifier).toHaveBeenCalledWith(
        "982000412345678",
        mockFarmId
      );
      expect(result).toEqual(mockAnimalResponse);
    });
  });
});
