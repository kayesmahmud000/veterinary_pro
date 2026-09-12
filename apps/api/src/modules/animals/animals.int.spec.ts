import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import * as supertest from "supertest";

const request =
  typeof supertest === "function"
    ? supertest
    : ((supertest as any).default ?? supertest);

import {
  AnimalGender,
  AnimalSpecies,
  AnimalStatus,
  FarmRole,
  GrowthTrajectory,
  ImportJobStatus,
  InbreedingRiskLevel,
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
import {
  ITokenService,
  TOKEN_SERVICE,
} from "../auth/services/token.service.interface";
import {
  FARM_MEMBER_REPOSITORY,
  IFarmMemberRepository,
} from "../farms/repositories/farm-member.repository.interface";
import { FarmMemberEntity } from "../farms/entities/farm-member.entity";
import { ResponseInterceptor } from "../../common/interceptors/response.interceptor";
import { GlobalExceptionFilter } from "../../common/filters/global-exception.filter";
import { EntityNotFoundException } from "../../common/exceptions/domain.exception";

describe("AnimalsController (Integration via Supertest)", () => {
  let app: INestApplication;
  let animalsService: jest.Mocked<IAnimalsService>;
  let tagService: jest.Mocked<IAnimalTagService>;
  let tokenService: jest.Mocked<ITokenService>;
  let farmMemberRepository: jest.Mocked<IFarmMemberRepository>;

  const farmId = "11111111-1111-1111-1111-111111111111";
  const ownerUserId = "22222222-2222-2222-2222-222222222222";
  const herdsmanUserId = "33333333-3333-3333-3333-333333333333";
  const nonMemberUserId = "44444444-4444-4444-4444-444444444444";

  const ownerPayload = {
    sub: ownerUserId,
    email: "owner@vetralink.com",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const herdsmanPayload = {
    sub: herdsmanUserId,
    email: "herdsman@vetralink.com",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const nonMemberPayload = {
    sub: nonMemberUserId,
    email: "stranger@vetralink.com",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const mockAnimalResponse = {
    id: "99999999-9999-9999-9999-999999999999",
    farmId,
    tagNumber: "COW-001",
    rfidNumber: null,
    name: "Daisy",
    species: AnimalSpecies.COW,
    breed: "Holstein Friesian",
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

  beforeAll(async () => {
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

    tokenService = {
      generateTokens: jest.fn(),
      generateAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
      verifyAccessToken: jest.fn().mockImplementation(async (token: string) => {
        if (token === "owner-token") return ownerPayload;
        if (token === "herdsman-token") return herdsmanPayload;
        if (token === "non-member-token") return nonMemberPayload;
        throw new Error("Invalid token");
      }),
      hashRefreshToken: jest.fn(),
      getRefreshTokenExpiresAt: jest.fn(),
    };

    farmMemberRepository = {
      findMembership: jest.fn().mockImplementation(async (targetFarmId: string, targetUserId: string) => {
        if (targetFarmId === farmId) {
          if (targetUserId === ownerUserId) {
            return FarmMemberEntity.create({
              farmId,
              userId: ownerUserId,
              role: FarmRole.OWNER,
            });
          }
          if (targetUserId === herdsmanUserId) {
            return FarmMemberEntity.create({
              farmId,
              userId: herdsmanUserId,
              role: FarmRole.HERDSMAN,
            });
          }
        }
        return null;
      }),
      findUserFarms: jest.fn(),
      create: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
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
          useValue: tokenService,
        },
        {
          provide: FARM_MEMBER_REPOSITORY,
          useValue: farmMemberRepository,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();

    const reflector = app.get(Reflector);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );
    app.useGlobalInterceptors(new ResponseInterceptor(reflector));
    app.useGlobalFilters(new GlobalExceptionFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /animals", () => {
    it("should return 401 Unauthorized when missing token", async () => {
      const res = await request(app.getHttpServer())
        .post("/animals")
        .set("x-farm-id", farmId)
        .send({
          tagNumber: "COW-001",
          species: AnimalSpecies.COW,
          gender: AnimalGender.FEMALE,
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should return 422 Unprocessable Entity when missing x-farm-id header", async () => {
      const res = await request(app.getHttpServer())
        .post("/animals")
        .set("Authorization", "Bearer owner-token")
        .send({
          tagNumber: "COW-001",
          species: AnimalSpecies.COW,
          gender: AnimalGender.FEMALE,
        });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    it("should return 403 Forbidden when user is not a member of the target farm", async () => {
      const res = await request(app.getHttpServer())
        .post("/animals")
        .set("Authorization", "Bearer non-member-token")
        .set("x-farm-id", farmId)
        .send({
          tagNumber: "COW-001",
          species: AnimalSpecies.COW,
          gender: AnimalGender.FEMALE,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("should return 201 Created with envelope when registered by farm owner", async () => {
      animalsService.registerAnimal.mockResolvedValueOnce(mockAnimalResponse);

      const res = await request(app.getHttpServer())
        .post("/animals")
        .set("Authorization", "Bearer owner-token")
        .set("x-farm-id", farmId)
        .send({
          tagNumber: "COW-001",
          name: "Daisy",
          species: AnimalSpecies.COW,
          gender: AnimalGender.FEMALE,
          weightKg: 520.5,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tagNumber).toBe("COW-001");
      expect(res.body.message).toBe("Animal registered successfully");
    });
  });

  describe("GET /animals", () => {
    it("should return 200 OK with paginated data for farm member", async () => {
      animalsService.getAnimals.mockResolvedValueOnce({
        items: [mockAnimalResponse],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      });

      const res = await request(app.getHttpServer())
        .get("/animals?page=1&limit=20")
        .set("Authorization", "Bearer herdsman-token")
        .set("x-farm-id", farmId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });
  });

  describe("DELETE /animals/:id (Archiving & RBAC)", () => {
    it("should return 403 Forbidden when a HERDSMAN attempts to archive an animal", async () => {
      const res = await request(app.getHttpServer())
        .delete(`/animals/${mockAnimalResponse.id}`)
        .set("Authorization", "Bearer herdsman-token")
        .set("x-farm-id", farmId);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it("should return 200 OK when an OWNER archives an animal", async () => {
      animalsService.archiveAnimal.mockResolvedValueOnce(mockAnimalResponse);

      const res = await request(app.getHttpServer())
        .delete(`/animals/${mockAnimalResponse.id}`)
        .set("Authorization", "Bearer owner-token")
        .set("x-farm-id", farmId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toBe("Animal archived successfully");
    });
  });

  describe("GET /animals/check-tag", () => {
    it("should return 200 OK with availability status for tag and rfid", async () => {
      animalsService.checkTagAvailability.mockResolvedValueOnce({
        tagNumber: { value: "COW-001", isAvailable: true },
        rfidNumber: { value: "982000412345678", isAvailable: false },
      });

      const res = await request(app.getHttpServer())
        .get("/animals/check-tag?tagNumber=COW-001&rfidNumber=982000412345678")
        .set("Authorization", "Bearer herdsman-token")
        .set("x-farm-id", farmId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tagNumber.isAvailable).toBe(true);
      expect(res.body.data.rfidNumber.isAvailable).toBe(false);
    });
  });

  describe("GET /animals/lookup/:identifier", () => {
    it("should return 200 OK with animal data when lookup succeeds", async () => {
      animalsService.lookupByIdentifier.mockResolvedValueOnce(mockAnimalResponse);

      const res = await request(app.getHttpServer())
        .get("/animals/lookup/COW-001")
        .set("Authorization", "Bearer herdsman-token")
        .set("x-farm-id", farmId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.tagNumber).toBe("COW-001");
    });

    it("should return 404 Not Found when animal identifier is not found", async () => {
      animalsService.lookupByIdentifier.mockRejectedValueOnce(
        new EntityNotFoundException("Animal", "NON-EXISTENT")
      );

      const res = await request(app.getHttpServer())
        .get("/animals/lookup/NON-EXISTENT")
        .set("Authorization", "Bearer herdsman-token")
        .set("x-farm-id", farmId);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /animals/:id/lineage", () => {
    it("should return 200 OK with pedigree lineage data for farm member", async () => {
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
        maxGenerations: 3,
        ancestorGenerationsFound: 0,
        totalAncestors: 0,
        inbreedingCoefficient: 0,
        inbreedingRisk: InbreedingRiskLevel.LOW,
        directOffspring: [],
        totalOffspring: 0,
      };
      animalsService.getAnimalLineage.mockResolvedValueOnce(mockLineage);

      const res = await request(app.getHttpServer())
        .get(`/animals/${mockAnimalResponse.id}/lineage?generations=3`)
        .set("Authorization", "Bearer herdsman-token")
        .set("x-farm-id", farmId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.rootAnimal.tagNumber).toBe("COW-001");
      expect(res.body.data.inbreedingRisk).toBe("LOW");
    });

    it("should return 400 Bad Request when generations query param exceeds maximum (5)", async () => {
      const res = await request(app.getHttpServer())
        .get(`/animals/${mockAnimalResponse.id}/lineage?generations=99`)
        .set("Authorization", "Bearer herdsman-token")
        .set("x-farm-id", farmId);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 404 Not Found when animal does not exist in farm", async () => {
      animalsService.getAnimalLineage.mockRejectedValueOnce(
        new EntityNotFoundException("Animal", "00000000-0000-0000-0000-000000000000")
      );

      const res = await request(app.getHttpServer())
        .get("/animals/00000000-0000-0000-0000-000000000000/lineage")
        .set("Authorization", "Bearer herdsman-token")
        .set("x-farm-id", farmId);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /animals/:id/weights", () => {
    it("should record weight measurement and return 201 Created", async () => {
      const mockWeightLog = {
        id: "weight-int-1",
        farmId,
        animalId: mockAnimalResponse.id,
        recordedById: herdsmanUserId,
        recordedByName: "Herdsman Bob",
        weightKg: 535.5,
        recordedAt: "2024-03-01T08:00:00.000Z",
        notes: "Healthy growth",
        ageDays: 411,
        syncVersion: 1,
        createdAt: "2024-03-01T08:00:00.000Z",
      };

      animalsService.recordWeight.mockResolvedValueOnce(mockWeightLog);

      const res = await request(app.getHttpServer())
        .post(`/animals/${mockAnimalResponse.id}/weights`)
        .set("Authorization", "Bearer herdsman-token")
        .set("x-farm-id", farmId)
        .send({
          weightKg: 535.5,
          recordedAt: "2024-03-01T08:00:00.000Z",
          notes: "Healthy growth",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe("weight-int-1");
      expect(res.body.data.weightKg).toBe(535.5);
      expect(res.body.data.ageDays).toBe(411);
    });

    it("should return 400 Bad Request when weightKg is missing or <= 0", async () => {
      const res = await request(app.getHttpServer())
        .post(`/animals/${mockAnimalResponse.id}/weights`)
        .set("Authorization", "Bearer herdsman-token")
        .set("x-farm-id", farmId)
        .send({
          weightKg: -5,
          recordedAt: "2024-03-01T08:00:00.000Z",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 403 Forbidden for non-farm member", async () => {
      const res = await request(app.getHttpServer())
        .post(`/animals/${mockAnimalResponse.id}/weights`)
        .set("Authorization", "Bearer non-member-token")
        .set("x-farm-id", farmId)
        .send({
          weightKg: 500,
          recordedAt: "2024-03-01T08:00:00.000Z",
        });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /animals/:id/weights", () => {
    it("should return paginated weight history and 200 OK", async () => {
      const mockResult = {
        items: [
          {
            id: "weight-int-1",
            farmId,
            animalId: mockAnimalResponse.id,
            recordedById: herdsmanUserId,
            recordedByName: "Herdsman Bob",
            weightKg: 535.5,
            recordedAt: "2024-03-01T08:00:00.000Z",
            notes: "Healthy growth",
            ageDays: 411,
            syncVersion: 1,
            createdAt: "2024-03-01T08:00:00.000Z",
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      };

      animalsService.getWeightHistory.mockResolvedValueOnce(mockResult);

      const res = await request(app.getHttpServer())
        .get(`/animals/${mockAnimalResponse.id}/weights?page=1&limit=20`)
        .set("Authorization", "Bearer herdsman-token")
        .set("x-farm-id", farmId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });
  });

  describe("GET /animals/:id/growth-curve", () => {
    it("should return calculated growth curve analytics and 200 OK", async () => {
      const mockAnalytics = {
        animalId: mockAnimalResponse.id,
        tagNumber: mockAnimalResponse.tagNumber,
        species: mockAnimalResponse.species,
        birthDate: "2023-01-15",
        currentAgeDays: 411,
        currentWeightKg: 535.5,
        startingWeightKg: 450,
        totalGainKg: 85.5,
        overallAdgKg: 0.855,
        trajectory: GrowthTrajectory.STEADY,
        hasWeightLossAlert: false,
        points: [
          {
            logId: "weight-int-0",
            recordedAt: "2023-11-21T08:00:00.000Z",
            weightKg: 450,
            ageDays: 310,
            intervalDays: 0,
            weightChangeKg: 0,
            intervalAdgKg: 0,
          },
          {
            logId: "weight-int-1",
            recordedAt: "2024-03-01T08:00:00.000Z",
            weightKg: 535.5,
            ageDays: 411,
            intervalDays: 100,
            weightChangeKg: 85.5,
            intervalAdgKg: 0.855,
          },
        ],
      };

      animalsService.getGrowthCurve.mockResolvedValueOnce(mockAnalytics);

      const res = await request(app.getHttpServer())
        .get(`/animals/${mockAnimalResponse.id}/growth-curve`)
        .set("Authorization", "Bearer herdsman-token")
        .set("x-farm-id", farmId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.trajectory).toBe(GrowthTrajectory.STEADY);
      expect(res.body.data.points).toHaveLength(2);
      expect(res.body.data.hasWeightLossAlert).toBe(false);
    });
  });

  describe("DELETE /animals/:id/weights/:weightId", () => {
    const validWeightLogId = "11111111-2222-3333-4444-555555555555";
    const nonExistentWeightLogId = "99999999-8888-7777-6666-555555555555";

    it("should delete weight log and return 200 OK", async () => {
      animalsService.deleteWeightLog.mockResolvedValueOnce(undefined);

      const res = await request(app.getHttpServer())
        .delete(`/animals/${mockAnimalResponse.id}/weights/${validWeightLogId}`)
        .set("Authorization", "Bearer owner-token")
        .set("x-farm-id", farmId)
        .set("x-trace-id", "trace-int-del");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(animalsService.deleteWeightLog).toHaveBeenCalledWith(
        mockAnimalResponse.id,
        validWeightLogId,
        farmId,
        ownerUserId,
        "trace-int-del"
      );
    });

    it("should return 404 Not Found if weight log does not exist", async () => {
      animalsService.deleteWeightLog.mockRejectedValueOnce(
        new EntityNotFoundException("AnimalWeightLog", nonExistentWeightLogId)
      );

      const res = await request(app.getHttpServer())
        .delete(`/animals/${mockAnimalResponse.id}/weights/${nonExistentWeightLogId}`)
        .set("Authorization", "Bearer owner-token")
        .set("x-farm-id", farmId);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe("POST /animals/import", () => {
    it("should accept valid file upload and return 202 Accepted", async () => {
      const mockJob = {
        id: "job-int-1111",
        farmId,
        uploadedById: ownerUserId,
        fileName: "test_herd.csv",
        fileSize: 120,
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

      animalsService.createImportJob.mockResolvedValueOnce(mockJob);

      const res = await request(app.getHttpServer())
        .post("/animals/import")
        .set("Authorization", "Bearer owner-token")
        .set("x-farm-id", farmId)
        .attach("file", Buffer.from("tagNumber,species,gender\nCOW-1,COW,FEMALE"), "test_herd.csv");

      expect(res.status).toBe(202);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe("job-int-1111");
      expect(res.body.data.status).toBe(ImportJobStatus.PENDING);
    });

    it("should return 403 Forbidden for non-farm member", async () => {
      const res = await request(app.getHttpServer())
        .post("/animals/import")
        .set("Authorization", "Bearer non-member-token")
        .set("x-farm-id", farmId)
        .attach("file", Buffer.from("tagNumber,species,gender\nCOW-1,COW,FEMALE"), "test_herd.csv");

      expect(res.status).toBe(403);
    });
  });

  describe("GET /animals/import/template", () => {
    it("should return 200 OK and CSV template content", async () => {
      animalsService.generateImportTemplate.mockReturnValueOnce(
        "tagNumber,name,species,breed,gender,dateOfBirth,weightKg,rfidNumber,sireTag,damTag"
      );

      const res = await request(app.getHttpServer())
        .get("/animals/import/template")
        .set("Authorization", "Bearer herdsman-token")
        .set("x-farm-id", farmId);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/csv");
      expect(res.text).toContain("tagNumber,name,species,breed,gender");
    });
  });

  describe("GET /animals/import/jobs", () => {
    it("should return paginated list of import jobs and 200 OK", async () => {
      const mockJobs = {
        items: [
          {
            id: "job-int-1111",
            farmId,
            uploadedById: ownerUserId,
            fileName: "test_herd.csv",
            fileSize: 120,
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
          },
        ],
        meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 },
      };

      animalsService.getImportJobs.mockResolvedValueOnce(mockJobs);

      const res = await request(app.getHttpServer())
        .get("/animals/import/jobs?page=1&limit=20")
        .set("Authorization", "Bearer herdsman-token")
        .set("x-farm-id", farmId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.meta.total).toBe(1);
    });
  });

  describe("GET /animals/import/jobs/:jobId", () => {
    const validJobId = "22222222-3333-4444-5555-666666666666";

    it("should return job details with 200 OK", async () => {
      const mockJob = {
        id: validJobId,
        farmId,
        uploadedById: ownerUserId,
        fileName: "test_herd.csv",
        fileSize: 120,
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

      animalsService.getImportJob.mockResolvedValueOnce(mockJob);

      const res = await request(app.getHttpServer())
        .get(`/animals/import/jobs/${validJobId}`)
        .set("Authorization", "Bearer herdsman-token")
        .set("x-farm-id", farmId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(validJobId);
      expect(res.body.data.status).toBe(ImportJobStatus.COMPLETED);
    });

    it("should return 404 Not Found if job does not exist", async () => {
      animalsService.getImportJob.mockRejectedValueOnce(
        new EntityNotFoundException("AnimalImportJob", validJobId)
      );

      const res = await request(app.getHttpServer())
        .get(`/animals/import/jobs/${validJobId}`)
        .set("Authorization", "Bearer herdsman-token")
        .set("x-farm-id", farmId);

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe("GET /animals/:id/qr-code", () => {
    const validAnimalId = "99999999-9999-9999-9999-999999999999";

    it("should return 200 with JSON payload and data URL by default", async () => {
      const mockQrDto = {
        animalId: validAnimalId,
        farmId,
        tagNumber: "COW-001",
        qrCodeDataUrl: "data:image/png;base64,iVBORw0KGgo...",
        payload: `https://vetralink.pro/farms/${farmId}/animals/${validAnimalId}?tag=COW-001`,
      };
      tagService.generateQrCode.mockResolvedValueOnce(mockQrDto);

      const res = await request(app.getHttpServer())
        .get(`/animals/${validAnimalId}/qr-code`)
        .set("Authorization", "Bearer herdsman-token")
        .set("x-farm-id", farmId);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.qrCodeDataUrl).toBe(mockQrDto.qrCodeDataUrl);
      expect(res.body.data.tagNumber).toBe("COW-001");
    });

    it("should stream binary PNG when ?format=png is provided", async () => {
      const mockBuffer = Buffer.from("\x89PNG\r\n\x1a\nsample-image");
      tagService.generateQrCodePngBuffer.mockResolvedValueOnce({
        buffer: mockBuffer,
        tagNumber: "COW-001",
      });

      const res = await request(app.getHttpServer())
        .get(`/animals/${validAnimalId}/qr-code?format=png`)
        .set("Authorization", "Bearer herdsman-token")
        .set("x-farm-id", farmId);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("image/png");
      expect(res.headers["content-disposition"]).toContain('inline; filename="qr-COW-001.png"');
    });

    it("should return 403 Forbidden when accessed by non-member", async () => {
      const res = await request(app.getHttpServer())
        .get(`/animals/${validAnimalId}/qr-code`)
        .set("Authorization", "Bearer non-member-token")
        .set("x-farm-id", farmId);

      expect(res.status).toBe(403);
    });
  });

  describe("GET /animals/:id/tag-badge", () => {
    const validAnimalId = "99999999-9999-9999-9999-999999999999";

    it("should stream application/pdf with inline disposition", async () => {
      const mockPdfBuffer = Buffer.from("%PDF-1.4 sample printable placard");
      tagService.generateSingleTagBadgePdf.mockResolvedValueOnce({
        buffer: mockPdfBuffer,
        tagNumber: "COW-001",
      });

      const res = await request(app.getHttpServer())
        .get(`/animals/${validAnimalId}/tag-badge`)
        .set("Authorization", "Bearer herdsman-token")
        .set("x-farm-id", farmId);

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/pdf");
      expect(res.headers["content-disposition"]).toContain('inline; filename="tag-COW-001.pdf"');
    });
  });

  describe("POST /animals/tag-badges/batch", () => {
    it("should stream application/pdf with attachment disposition for batch sheets", async () => {
      const mockPdfBuffer = Buffer.from("%PDF-1.4 sample printable grid sheet");
      tagService.generateBatchTagBadgesPdf.mockResolvedValueOnce({
        buffer: mockPdfBuffer,
        count: 6,
      });

      const res = await request(app.getHttpServer())
        .post("/animals/tag-badges/batch")
        .set("Authorization", "Bearer herdsman-token")
        .set("x-farm-id", farmId)
        .send({
          layout: "GRID_2X3",
          pageSize: "A4",
        });

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("application/pdf");
      expect(res.headers["content-disposition"]).toContain('attachment; filename="farm-tags-');
    });

    it("should return 400 Bad Request if animalIds contains more than 100 items", async () => {
      const longList = Array.from({ length: 101 }, (_, i) => "99999999-9999-9999-9999-999999999999");

      const res = await request(app.getHttpServer())
        .post("/animals/tag-badges/batch")
        .set("Authorization", "Bearer herdsman-token")
        .set("x-farm-id", farmId)
        .send({
          animalIds: longList,
        });

      expect(res.status).toBe(400);
    });
  });
});

