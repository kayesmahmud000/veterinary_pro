import { Test, TestingModule } from "@nestjs/testing";
import { Response, Request } from "express";
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
import {
  ForbiddenOperationException,
  UnauthorizedDomainException,
} from "../../common/exceptions/domain.exception";

describe("DrmKeyController (Unit)", () => {
  let controller: DrmKeyController;
  let drmKeyService: jest.Mocked<IDrmKeyService>;
  let drmTokenService: jest.Mocked<IDrmTokenService>;
  let entitlementService: jest.Mocked<IEntitlementService>;

  const mockUser = {
    sub: "user-1111-1111-1111-111111111111",
    email: "vet@vetralink.com",
    role: UserRole.VET,
    status: UserStatus.ACTIVE,
  };

  const mockReq = {
    protocol: "https",
    get: jest.fn().mockReturnValue("api.vetralink.pro"),
  } as unknown as Request;

  const createMockResponse = () => {
    const res: Partial<Response> = {
      setHeader: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
    };
    return res as Response;
  };

  beforeEach(async () => {
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

    const module: TestingModule = await Test.createTestingModule({
      controllers: [DrmKeyController],
      providers: [
        { provide: DRM_KEY_SERVICE, useValue: drmKeyService },
        { provide: DRM_TOKEN_SERVICE, useValue: drmTokenService },
        { provide: ENTITLEMENT_SERVICE, useValue: entitlementService },
        {
          provide: TOKEN_SERVICE,
          useValue: { verifyAccessToken: jest.fn() },
        },
        {
          provide: EnvService,
          useValue: { port: 3001 },
        },
      ],
    }).compile();

    controller = module.get<DrmKeyController>(DrmKeyController);
  });

  describe("generatePlaybackToken", () => {
    it("should issue a signed playback token when user is entitled", async () => {
      const productId = "prod-1111-1111-1111-111111111111";
      entitlementService.checkEntitlement.mockResolvedValue(true);
      drmTokenService.generatePlaybackToken.mockResolvedValue({
        token: "signed-playback-jwt",
        expiresAt: new Date("2026-09-05T18:00:00.000Z"),
        expiresInSeconds: 600,
      });

      const response = await controller.generatePlaybackToken(
        mockUser,
        { productId },
        mockReq
      );

      expect(entitlementService.checkEntitlement).toHaveBeenCalledWith(
        mockUser.sub,
        mockUser.role,
        productId
      );
      expect(response.playbackToken).toBe("signed-playback-jwt");
      expect(response.keyUrl).toBe(
        "https://api.vetralink.pro/api/v1/media/drm/key/signed-playback-jwt"
      );
      expect(response.expiresInSeconds).toBe(600);
    });

    it("should throw ForbiddenOperationException when user is not entitled", async () => {
      const productId = "prod-1111-1111-1111-111111111111";
      entitlementService.checkEntitlement.mockResolvedValue(false);

      await expect(
        controller.generatePlaybackToken(mockUser, { productId }, mockReq)
      ).rejects.toThrow(ForbiddenOperationException);

      expect(drmTokenService.generatePlaybackToken).not.toHaveBeenCalled();
    });
  });

  describe("getKeyByPathParam", () => {
    it("should verify token and stream 16-byte key with no-cache headers", async () => {
      const token = "valid-token";
      const dummyKey = Buffer.alloc(16, 0xaa);
      const res = createMockResponse();

      drmTokenService.verifyPlaybackToken.mockResolvedValue({
        sub: mockUser.sub,
        pid: "prod-1111-1111-1111-111111111111",
        role: mockUser.role,
        jti: "jti-1",
        iat: 100,
        exp: 200,
      });
      drmKeyService.deriveKey.mockReturnValue(dummyKey);

      await controller.getKeyByPathParam(token, res);

      expect(drmTokenService.verifyPlaybackToken).toHaveBeenCalledWith(token);
      expect(drmKeyService.deriveKey).toHaveBeenCalledWith(
        "prod-1111-1111-1111-111111111111"
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        "Content-Type",
        "application/octet-stream"
      );
      expect(res.setHeader).toHaveBeenCalledWith("Content-Length", "16");
      expect(res.setHeader).toHaveBeenCalledWith(
        "Cache-Control",
        "private, no-cache, no-store, must-revalidate"
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.end).toHaveBeenCalledWith(dummyKey);
    });
  });

  describe("getKeyByQueryParam", () => {
    it("should verify token from query and stream 16-byte key", async () => {
      const token = "query-token";
      const dummyKey = Buffer.alloc(16, 0xbb);
      const res = createMockResponse();

      drmTokenService.verifyPlaybackToken.mockResolvedValue({
        sub: mockUser.sub,
        pid: "prod-1111-1111-1111-111111111111",
        role: mockUser.role,
        jti: "jti-2",
        iat: 100,
        exp: 200,
      });
      drmKeyService.deriveKey.mockReturnValue(dummyKey);

      await controller.getKeyByQueryParam(token, res);

      expect(res.end).toHaveBeenCalledWith(dummyKey);
    });

    it("should throw UnauthorizedDomainException when token query param is missing", async () => {
      const res = createMockResponse();

      await expect(controller.getKeyByQueryParam(undefined, res)).rejects.toThrow(
        UnauthorizedDomainException
      );
    });
  });

  describe("getKeyDirectAlias", () => {
    it("should deliver decryption key for direct alias route", async () => {
      const token = "alias-token";
      const dummyKey = Buffer.alloc(16, 0xcc);
      const res = createMockResponse();

      drmTokenService.verifyPlaybackToken.mockResolvedValue({
        sub: mockUser.sub,
        pid: "prod-1111-1111-1111-111111111111",
        role: mockUser.role,
        jti: "jti-3",
        iat: 100,
        exp: 200,
      });
      drmKeyService.deriveKey.mockReturnValue(dummyKey);

      await controller.getKeyDirectAlias(token, res);

      expect(res.end).toHaveBeenCalledWith(dummyKey);
    });
  });
});
