import { Test, TestingModule } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import {
  AnimalGender,
  AnimalSpecies,
  AnimalStatus,
  GrowthTrajectory,
  ImportJobStatus,
  InbreedingRiskLevel,
  JwtPayload,
  UserRole,
  UserStatus,
} from "@vetralink/shared-types";
import { AnimalsController } from "./animals.controller";
import {
  ANIMALS_SERVICE,
  IAnimalsService,
} from "./services/animals.service.interface";
import {
  ANIMAL_TAG_SERVICE,
  IAnimalTagService,
} from "./services/animal-tag.service.interface";
import { TOKEN_SERVICE } from "../auth/services/token.service.interface";
import { FARM_MEMBER_REPOSITORY } from "../farms/repositories/farm-member.repository.interface";
import { SUBSCRIPTION_QUOTA_SERVICE } from "../subscriptions/services/subscription-quota.service.interface";
import { Response } from "express";

describe("AnimalsController", () => {
  let controller: AnimalsController;
  let animalsService: jest.Mocked<IAnimalsService>;
  let tagService: jest.Mocked<IAnimalTagService>;

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
      getAnimalLineage: jest.fn(),
      recordWeight: jest.fn(),
      getWeightHistory: jest.fn(),
      getGrowthCurve: jest.fn(),
      deleteWeightLog: jest.fn(),
      createImportJob: jest.fn(),
      getImportJob: jest.fn(),
      getImportJobs: jest.fn(),
      generateImportTemplate: jest.fn(),
    };

    tagService = {
      generateQrCode: jest.fn(),
      generateQrCodePngBuffer: jest.fn(),
      generateSingleTagBadgePdf: jest.fn(),
      generateBatchTagBadgesPdf: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnimalsController],
      providers: [
        {
          provide: ANIMALS_SERVICE,
          useValue: animalsService,
        },
        {
          provide: ANIMAL_TAG_SERVICE,
          useValue: tagService,
        },
        {
          provide: TOKEN_SERVICE,
          useValue: { verifyAccessToken: jest.fn() },
        },
        {
          provide: FARM_MEMBER_REPOSITORY,
          useValue: { findMembership: jest.fn() },
        },
        {
          provide: SUBSCRIPTION_QUOTA_SERVICE,
          useValue: {
            checkQuota: jest.fn().mockResolvedValue({ allowed: true }),
            assertQuotaAvailable: jest.fn().mockResolvedValue({ allowed: true }),
            getFarmQuotaUsage: jest.fn().mockResolvedValue({
              farmId: mockFarmId,
              planTier: "PRO",
              planName: "Pro Farmer",
              isSubscriptionActive: true,
              quotas: {},
              features: {
                bulkImportExport: true,
                advancedAnalytics: true,
                customReports: false,
                teleVetPriority: "EXPEDITED",
              },
            }),
          },
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

  describe("getAnimalLineage", () => {
    it("should delegate to animalsService.getAnimalLineage with query generations", async () => {
      const mockLineage = {
        rootAnimal: {
          id: mockAnimalResponse.id,
          tagNumber: mockAnimalResponse.tagNumber,
          rfidNumber: mockAnimalResponse.rfidNumber,
          name: mockAnimalResponse.name,
          species: mockAnimalResponse.species,
          breed: mockAnimalResponse.breed,
          gender: mockAnimalResponse.gender,
          dateOfBirth: mockAnimalResponse.dateOfBirth,
          status: mockAnimalResponse.status,
          generation: 0,
          sire: null,
          dam: null,
        },
        maxGenerations: 4,
        ancestorGenerationsFound: 0,
        totalAncestors: 0,
        inbreedingCoefficient: 0,
        inbreedingRisk: InbreedingRiskLevel.LOW,
        directOffspring: [],
        totalOffspring: 0,
      };
      animalsService.getAnimalLineage.mockResolvedValueOnce(mockLineage);

      const result = await controller.getAnimalLineage(
        mockFarmId,
        mockAnimalResponse.id,
        { generations: 4 }
      );

      expect(animalsService.getAnimalLineage).toHaveBeenCalledWith(
        mockAnimalResponse.id,
        mockFarmId,
        4
      );
      expect(result).toEqual(mockLineage);
    });
  });

  describe("recordWeight", () => {
    it("should delegate to animalsService.recordWeight", async () => {
      const mockWeightLogResponse = {
        id: "weight-1111",
        farmId: mockFarmId,
        animalId: mockAnimalResponse.id,
        recordedById: mockUser.sub,
        recordedByName: "Farmer John",
        weightKg: 530,
        recordedAt: "2024-02-01T10:00:00.000Z",
        notes: "Routine check",
        ageDays: 382,
        syncVersion: 1,
        createdAt: "2024-02-01T10:00:00.000Z",
      };

      animalsService.recordWeight.mockResolvedValueOnce(mockWeightLogResponse);

      const dto = {
        weightKg: 530,
        recordedAt: "2024-02-01T10:00:00.000Z",
        notes: "Routine check",
      };

      const result = await controller.recordWeight(
        mockFarmId,
        mockAnimalResponse.id,
        dto,
        mockUser,
        "trace-weight-1"
      );

      expect(animalsService.recordWeight).toHaveBeenCalledWith(
        mockAnimalResponse.id,
        mockFarmId,
        dto,
        mockUser.sub,
        "trace-weight-1"
      );
      expect(result).toEqual(mockWeightLogResponse);
    });
  });

  describe("getWeightHistory", () => {
    it("should delegate to animalsService.getWeightHistory", async () => {
      const mockHistory = {
        items: [],
        meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      };

      animalsService.getWeightHistory.mockResolvedValueOnce(mockHistory);

      const result = await controller.getWeightHistory(
        mockFarmId,
        mockAnimalResponse.id,
        { page: 1, limit: 20 }
      );

      expect(animalsService.getWeightHistory).toHaveBeenCalledWith(
        mockAnimalResponse.id,
        mockFarmId,
        { page: 1, limit: 20 }
      );
      expect(result).toEqual(mockHistory);
    });
  });

  describe("getGrowthCurve", () => {
    it("should delegate to animalsService.getGrowthCurve", async () => {
      const mockGrowthCurve = {
        animalId: mockAnimalResponse.id,
        tagNumber: mockAnimalResponse.tagNumber,
        species: mockAnimalResponse.species,
        birthDate: "2023-01-15",
        currentAgeDays: 400,
        currentWeightKg: 520.5,
        startingWeightKg: 400,
        totalGainKg: 120.5,
        overallAdgKg: 0.301,
        trajectory: GrowthTrajectory.STEADY,
        hasWeightLossAlert: false,
        points: [],
      };

      animalsService.getGrowthCurve.mockResolvedValueOnce(mockGrowthCurve);

      const result = await controller.getGrowthCurve(
        mockFarmId,
        mockAnimalResponse.id
      );

      expect(animalsService.getGrowthCurve).toHaveBeenCalledWith(
        mockAnimalResponse.id,
        mockFarmId
      );
      expect(result).toEqual(mockGrowthCurve);
    });
  });

  describe("deleteWeightLog", () => {
    it("should delegate to animalsService.deleteWeightLog", async () => {
      animalsService.deleteWeightLog.mockResolvedValueOnce(undefined);

      const result = await controller.deleteWeightLog(
        mockFarmId,
        mockAnimalResponse.id,
        "weight-log-to-delete",
        mockUser,
        "trace-del-1"
      );

      expect(animalsService.deleteWeightLog).toHaveBeenCalledWith(
        mockAnimalResponse.id,
        "weight-log-to-delete",
        mockFarmId,
        mockUser.sub,
        "trace-del-1"
      );
      expect(result).toEqual({ message: "Weight log deleted successfully" });
    });
  });

  describe("bulkImportAnimals", () => {
    it("should delegate to animalsService.createImportJob", async () => {
      const mockJobDto = {
        id: "job-1111",
        farmId: mockFarmId,
        uploadedById: mockUser.sub,
        fileName: "herd.csv",
        fileSize: 512,
        fileType: "csv",
        status: ImportJobStatus.PENDING,
        totalRows: 0,
        processedRows: 0,
        successfulRows: 0,
        failedRows: 0,
        errorReport: null,
        progressPercentage: 0,
        startedAt: null,
        completedAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      animalsService.createImportJob.mockResolvedValueOnce(mockJobDto);

      const mockFile = { originalname: "herd.csv" } as Express.Multer.File;

      const result = await controller.bulkImportAnimals(
        mockFarmId,
        mockFile,
        mockUser,
        "trace-upload-1"
      );

      expect(animalsService.createImportJob).toHaveBeenCalledWith(
        mockFarmId,
        mockFile,
        mockUser.sub,
        "trace-upload-1"
      );
      expect(result).toEqual(mockJobDto);
    });
  });

  describe("getImportTemplate", () => {
    it("should delegate to animalsService.generateImportTemplate", () => {
      animalsService.generateImportTemplate.mockReturnValueOnce("header1,header2");

      const result = controller.getImportTemplate();

      expect(animalsService.generateImportTemplate).toHaveBeenCalled();
      expect(result).toBe("header1,header2");
    });
  });

  describe("getImportJobs", () => {
    it("should delegate to animalsService.getImportJobs", async () => {
      const mockJobs = {
        items: [],
        meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
      };

      animalsService.getImportJobs.mockResolvedValueOnce(mockJobs);

      const result = await controller.getImportJobs(mockFarmId, 1, 20);

      expect(animalsService.getImportJobs).toHaveBeenCalledWith(mockFarmId, 1, 20);
      expect(result).toEqual(mockJobs);
    });
  });

  describe("getImportJob", () => {
    it("should delegate to animalsService.getImportJob", async () => {
      const mockJobDto = {
        id: "job-1111",
        farmId: mockFarmId,
        uploadedById: mockUser.sub,
        fileName: "herd.csv",
        fileSize: 512,
        fileType: "csv",
        status: ImportJobStatus.COMPLETED,
        totalRows: 10,
        processedRows: 10,
        successfulRows: 10,
        failedRows: 0,
        errorReport: null,
        progressPercentage: 100,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      animalsService.getImportJob.mockResolvedValueOnce(mockJobDto);

      const result = await controller.getImportJob(mockFarmId, "job-1111");

      expect(animalsService.getImportJob).toHaveBeenCalledWith("job-1111", mockFarmId);
      expect(result).toEqual(mockJobDto);
    });
  });

  describe("printBatchTagBadges", () => {
    it("should stream PDF response for batch tag badges", async () => {
      const mockPdfBuffer = Buffer.from("%PDF-1.4 batch");
      tagService.generateBatchTagBadgesPdf.mockResolvedValueOnce({
        buffer: mockPdfBuffer,
        count: 5,
      });

      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        end: jest.fn(),
      } as unknown as Response;

      const dto = { animalIds: ["id-1", "id-2"] };
      await controller.printBatchTagBadges(mockFarmId, dto, res);

      expect(tagService.generateBatchTagBadgesPdf).toHaveBeenCalledWith(mockFarmId, dto);
      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.end).toHaveBeenCalledWith(mockPdfBuffer);
    });
  });

  describe("getAnimalQrCode", () => {
    it("should return JSON response with QR code metadata and data URL by default", async () => {
      const mockQrDto = {
        animalId: "animal-1",
        farmId: mockFarmId,
        tagNumber: "COW-100",
        qrCodeDataUrl: "data:image/png;base64,...",
        payload: "https://vetralink.pro/farms/f/animals/a",
      };
      tagService.generateQrCode.mockResolvedValueOnce(mockQrDto);

      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      } as unknown as Response;

      await controller.getAnimalQrCode(mockFarmId, "animal-1", {}, res);

      expect(tagService.generateQrCode).toHaveBeenCalledWith(mockFarmId, "animal-1");
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          data: mockQrDto,
        })
      );
    });

    it("should stream binary PNG when format=png query param is passed", async () => {
      const mockPngBuffer = Buffer.from("png-bytes");
      tagService.generateQrCodePngBuffer.mockResolvedValueOnce({
        buffer: mockPngBuffer,
        tagNumber: "COW-100",
      });

      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        end: jest.fn(),
      } as unknown as Response;

      await controller.getAnimalQrCode(mockFarmId, "animal-1", { format: "png" }, res);

      expect(tagService.generateQrCodePngBuffer).toHaveBeenCalledWith(mockFarmId, "animal-1");
      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/png");
      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        'inline; filename="qr-COW-100.png"'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.end).toHaveBeenCalledWith(mockPngBuffer);
    });
  });

  describe("getAnimalTagBadgePdf", () => {
    it("should stream PDF response for single tag badge placard", async () => {
      const mockPdfBuffer = Buffer.from("%PDF-1.4 placard");
      tagService.generateSingleTagBadgePdf.mockResolvedValueOnce({
        buffer: mockPdfBuffer,
        tagNumber: "COW-100",
      });

      const res = {
        setHeader: jest.fn(),
        status: jest.fn().mockReturnThis(),
        end: jest.fn(),
      } as unknown as Response;

      await controller.getAnimalTagBadgePdf(mockFarmId, "animal-1", res);

      expect(tagService.generateSingleTagBadgePdf).toHaveBeenCalledWith(mockFarmId, "animal-1");
      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Disposition",
        'inline; filename="tag-COW-100.pdf"'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.end).toHaveBeenCalledWith(mockPdfBuffer);
    });
  });
});

