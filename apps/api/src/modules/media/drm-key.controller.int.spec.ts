import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import * as supertest from "supertest";

const request =
  typeof supertest === "function"
    ? supertest
    : ((supertest as any).default ?? supertest);

import { UserRole, UserStatus } from "@vetralink/shared-types";
import { DrmKeyController } from "./drm-key.controller";
import {
  IDrmKeyService,
  DRM_KEY_SERVICE,
} from "./services/drm-key.service.interface";
import {
  IDrmTokenService,
  DRM_TOKEN_SERVICE,
} from "./services/drm-token.service.interface";
import {
  IEntitlementService,
  ENTITLEMENT_SERVICE,
} from "./services/entitlement.service.interface";
import {
  ITokenService,
  TOKEN_SERVICE,
} from "../auth/services/token.service.interface";
import { EnvService } from "../../config/env.service";
import { ResponseInterceptor } from "../../common/interceptors/response.interceptor";
import { GlobalExceptionFilter } from "../../common/filters/global-exception.filter";
import { UnauthorizedDomainException } from "../../common/exceptions/domain.exception";

describe("DrmKeyController (Integration via Supertest)", () => {
  let app: INestApplication;
  let drmKeyService: jest.Mocked<IDrmKeyService>;
  let drmTokenService: jest.Mocked<IDrmTokenService>;
  let entitlementService: jest.Mocked<IEntitlementService>;
  let tokenService: jest.Mocked<ITokenService>;

  const vetUser = {
    sub: "vet-1111-1111-1111-111111111111",
    email: "vet@vetralink.pro",
    role: UserRole.VET,
    status: UserStatus.ACTIVE,
  };

  const validToken = "valid-auth-token";
  const validProductId = "11111111-1111-4111-8111-111111111111";

  beforeAll(async () => {
    drmKeyService = {
      deriveKey: jest.fn(),
      generateKeyInfoFile: jest.fn(),
    };

    drmTokenService = {
      generatePlaybackToken: jest.fn(),
      verifyPlaybackToken: jest.fn(),
    };

    entitlementService = {
      checkEntitlement: jest.fn(),
    };

    tokenService = {
      generateTokens: jest.fn(),
      generateAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
      hashRefreshToken: jest.fn(),
      verifyAccessToken: jest.fn().mockImplementation(async (token: string) => {
        if (token === validToken) return vetUser;
        throw new UnauthorizedDomainException("Invalid bearer token");
      }),
      getRefreshTokenExpiresAt: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [DrmKeyController],
      providers: [
        { provide: DRM_KEY_SERVICE, useValue: drmKeyService },
        { provide: DRM_TOKEN_SERVICE, useValue: drmTokenService },
        { provide: ENTITLEMENT_SERVICE, useValue: entitlementService },
        { provide: TOKEN_SERVICE, useValue: tokenService },
        { provide: EnvService, useValue: { port: 3001 } },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );
    app.setGlobalPrefix("api/v1");
    app.useGlobalInterceptors(new ResponseInterceptor(new Reflector()));
    app.useGlobalFilters(new GlobalExceptionFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /api/v1/media/drm/playback-token", () => {
    it("should return 401 Unauthorized when no auth bearer token is supplied", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/media/drm/playback-token")
        .send({ productId: validProductId });

      expect(response.status).toBe(401);
      expect(response.body.message).toContain("Authorization");
    });

    it("should return 400 Bad Request when productId is not a valid UUID v4", async () => {
      const response = await request(app.getHttpServer())
        .post("/api/v1/media/drm/playback-token")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ productId: "not-a-valid-uuid" });

      expect(response.status).toBe(400);
      expect(response.body.message).toContain("Validation");
    });

    it("should return 403 Forbidden when user does not have entitlement to product", async () => {
      entitlementService.checkEntitlement.mockResolvedValue(false);

      const response = await request(app.getHttpServer())
        .post("/api/v1/media/drm/playback-token")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ productId: validProductId });

      expect(response.status).toBe(403);
      expect(response.body.message).toContain("entitlement");
    });

    it("should return 200 OK with playback token and keyUrl when user is entitled", async () => {
      entitlementService.checkEntitlement.mockResolvedValue(true);
      drmTokenService.generatePlaybackToken.mockResolvedValue({
        token: "ephemeral-drm-token",
        expiresAt: new Date("2026-09-05T18:00:00.000Z"),
        expiresInSeconds: 600,
      });

      const response = await request(app.getHttpServer())
        .post("/api/v1/media/drm/playback-token")
        .set("Authorization", `Bearer ${validToken}`)
        .send({ productId: validProductId });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.playbackToken).toBe("ephemeral-drm-token");
      expect(response.body.data.keyUrl).toContain(
        "/api/v1/media/drm/key/ephemeral-drm-token"
      );
      expect(response.body.data.expiresInSeconds).toBe(600);
    });
  });

  describe("GET /api/v1/media/drm/key/:playbackToken", () => {
    it("should return 401 Unauthorized if playback token is invalid or expired", async () => {
      drmTokenService.verifyPlaybackToken.mockRejectedValue(
        new UnauthorizedDomainException("Token has expired")
      );

      const response = await request(app.getHttpServer()).get(
        "/api/v1/media/drm/key/expired-token"
      );

      expect(response.status).toBe(401);
      expect(response.body.message).toContain("Token has expired");
    });

    it("should return 200 OK with raw 16-byte binary key and strict no-cache headers", async () => {
      const dummyKey = Buffer.from([
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0a, 0x0b, 0x0c,
        0x0d, 0x0e, 0x0f, 0x10,
      ]);

      drmTokenService.verifyPlaybackToken.mockResolvedValue({
        sub: vetUser.sub,
        pid: validProductId,
        role: vetUser.role,
        jti: "jti-1",
        iat: 100,
        exp: 200,
      });
      drmKeyService.deriveKey.mockReturnValue(dummyKey);

      const response = await request(app.getHttpServer())
        .get("/api/v1/media/drm/key/valid-playback-token")
        .responseType("blob");

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toBe("application/octet-stream");
      expect(response.headers["content-length"]).toBe("16");
      expect(response.headers["cache-control"]).toContain("no-store");
      expect(response.headers["pragma"]).toBe("no-cache");
      expect(response.headers["expires"]).toBe("0");
      expect(response.body).toEqual(dummyKey);
    });
  });

  describe("GET /api/v1/media/drm/key (query param)", () => {
    it("should return 401 when token query param is missing", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/v1/media/drm/key"
      );

      expect(response.status).toBe(401);
      expect(response.body.message).toContain("token");
    });

    it("should return 200 with 16-byte key when token query param is valid", async () => {
      const dummyKey = Buffer.alloc(16, 0x77);

      drmTokenService.verifyPlaybackToken.mockResolvedValue({
        sub: vetUser.sub,
        pid: validProductId,
        role: vetUser.role,
        jti: "jti-2",
        iat: 100,
        exp: 200,
      });
      drmKeyService.deriveKey.mockReturnValue(dummyKey);

      const response = await request(app.getHttpServer())
        .get("/api/v1/media/drm/key?token=query-drm-token")
        .responseType("blob");

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toBe("application/octet-stream");
      expect(response.body).toEqual(dummyKey);
    });
  });

  describe("GET /api/v1/media/key/:playbackToken (direct architecture alias)", () => {
    it("should return 200 with raw binary key for architecture specification alias", async () => {
      const dummyKey = Buffer.alloc(16, 0x88);

      drmTokenService.verifyPlaybackToken.mockResolvedValue({
        sub: vetUser.sub,
        pid: validProductId,
        role: vetUser.role,
        jti: "jti-3",
        iat: 100,
        exp: 200,
      });
      drmKeyService.deriveKey.mockReturnValue(dummyKey);

      const response = await request(app.getHttpServer())
        .get("/api/v1/media/key/direct-alias-token")
        .responseType("blob");

      expect(response.status).toBe(200);
      expect(response.headers["content-type"]).toBe("application/octet-stream");
      expect(response.body).toEqual(dummyKey);
    });
  });
});
