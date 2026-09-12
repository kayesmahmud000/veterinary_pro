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
  UserRole,
  UserStatus,
} from "@vetralink/shared-types";
import { AnimalsController } from "./animals.controller";
import {
  ANIMALS_SERVICE,
  IAnimalsService,
} from "./services/animals.service.interface";
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
});
