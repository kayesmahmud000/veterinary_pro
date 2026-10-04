import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import * as supertest from "supertest";

const request =
  typeof supertest === "function"
    ? supertest
    : ((supertest as any).default ?? supertest);

import { UserRole, UserStatus } from "@vetralink/shared-types";
import { StreamDeliveryController } from "./stream-delivery.controller";
import {
  IStreamDeliveryService,
  STREAM_DELIVERY_SERVICE,
  StreamSessionResult,
} from "./services/stream-delivery.service.interface";
import {
  ITokenService,
  TOKEN_SERVICE,
} from "../auth/services/token.service.interface";
import { ResponseInterceptor } from "../../common/interceptors/response.interceptor";
import { GlobalExceptionFilter } from "../../common/filters/global-exception.filter";
import {
  ForbiddenOperationException,
  UnauthorizedDomainException,
} from "../../common/exceptions/domain.exception";

describe("StreamDeliveryController (Integration via Supertest)", () => {
  let app: INestApplication;
  let streamDeliveryService: jest.Mocked<IStreamDeliveryService>;
  let tokenService: jest.Mocked<ITokenService>;

  const mockUser = {
    sub: "user-1111-1111-1111-111111111111",
    email: "farmer@vetralink.pro",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const validAuthToken = "valid-bearer-token";
  const validProductId = "11111111-1111-4111-8111-111111111111";

  const mockSessionResult: StreamSessionResult = {
    productId: validProductId,
    streamUrl: "https://cdn.vetralink.pro/hls/test/master.m3u8?Policy=custom-policy-data",
    drmKeyUrl: "http://localhost:3001/api/v1/media/drm/key/drm-playback-token-xyz",
    cookies: {
      policy: "custom-policy-cookie",
      signature: "signature-cookie",
      keyPairId: "K2JC3XQRI3UW74",
    },
    expiresAt: new Date("2026-09-05T18:00:00.000Z"),
    expiresInSeconds: 3600,
  };

  beforeAll(async () => {
    streamDeliveryService = {
      createPlaybackSession: jest.fn(),
    };

    tokenService = {
      generateTokens: jest.fn(),
      generateAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
      hashRefreshToken: jest.fn(),
      verifyAccessToken: jest.fn().mockImplementation(async (token: string) => {
        if (token === validAuthToken) return mockUser;
        throw new UnauthorizedDomainException("Invalid bearer token");
      }),
      getRefreshTokenExpiresAt: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [StreamDeliveryController],
      providers: [
        { provide: STREAM_DELIVERY_SERVICE, useValue: streamDeliveryService },
        { provide: TOKEN_SERVICE, useValue: tokenService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();

    const reflector = app.get(Reflector);
    app.useGlobalInterceptors(new ResponseInterceptor(reflector));
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );

    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /media/stream/session", () => {
    it("should return 401 Unauthorized if no bearer token is supplied", async () => {
      const res = await request(app.getHttpServer())
        .post("/media/stream/session")
        .send({ productId: validProductId });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it("should return 400 Bad Request if productId is not a valid UUID", async () => {
      const res = await request(app.getHttpServer())
        .post("/media/stream/session")
        .set("Authorization", `Bearer ${validAuthToken}`)
        .send({ productId: "not-a-uuid" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it("should return 403 Forbidden if user is not entitled", async () => {
      streamDeliveryService.createPlaybackSession.mockRejectedValue(
        new ForbiddenOperationException("Entitlement verification failed")
      );

      const res = await request(app.getHttpServer())
        .post("/media/stream/session")
        .set("Authorization", `Bearer ${validAuthToken}`)
        .send({ productId: validProductId });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Entitlement verification failed");
    });

    it("should return 200 OK with streamUrl and signed cookies when entitled", async () => {
      streamDeliveryService.createPlaybackSession.mockResolvedValue(
        mockSessionResult
      );

      const res = await request(app.getHttpServer())
        .post("/media/stream/session")
        .set("Authorization", `Bearer ${validAuthToken}`)
        .send({ productId: validProductId });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.productId).toBe(validProductId);
      expect(res.body.data.streamUrl).toBe(mockSessionResult.streamUrl);
      expect(res.body.data.drmKeyUrl).toBe(mockSessionResult.drmKeyUrl);
      expect(res.body.data.cookies).toEqual({
        "CloudFront-Policy": "custom-policy-cookie",
        "CloudFront-Signature": "signature-cookie",
        "CloudFront-Key-Pair-Id": "K2JC3XQRI3UW74",
      });
      expect(res.body.data.expiresInSeconds).toBe(3600);
    });
  });

  describe("GET /media/stream/:productId/manifest", () => {
    it("should return 401 Unauthorized if no bearer token is supplied", async () => {
      const res = await request(app.getHttpServer()).get(
        `/media/stream/${validProductId}/manifest`
      );

      expect(res.status).toBe(401);
    });

    it("should return 400 Bad Request if productId is not a valid UUID", async () => {
      const res = await request(app.getHttpServer())
        .get("/media/stream/invalid-uuid/manifest")
        .set("Authorization", `Bearer ${validAuthToken}`);

      expect(res.status).toBe(400);
    });

    it("should return 302 Found and set signed cookies when entitled", async () => {
      streamDeliveryService.createPlaybackSession.mockResolvedValue(
        mockSessionResult
      );

      const res = await request(app.getHttpServer())
        .get(`/media/stream/${validProductId}/manifest`)
        .set("Authorization", `Bearer ${validAuthToken}`);

      expect(res.status).toBe(302);
      expect(res.header.location).toBe(mockSessionResult.streamUrl);

      const setCookieHeaders = res.header["set-cookie"];
      expect(setCookieHeaders).toBeDefined();

      const combinedCookies = setCookieHeaders.join("; ");
      expect(combinedCookies).toContain("CloudFront-Policy=custom-policy-cookie");
      expect(combinedCookies).toContain("CloudFront-Signature=signature-cookie");
      expect(combinedCookies).toContain("CloudFront-Key-Pair-Id=K2JC3XQRI3UW74");
    });
  });
});
