import { Test, TestingModule } from "@nestjs/testing";
import { Request, Response } from "express";
import { UserRole, UserStatus } from "@vetralink/shared-types";
import { StreamDeliveryController } from "./stream-delivery.controller";
import {
  IStreamDeliveryService,
  STREAM_DELIVERY_SERVICE,
  StreamSessionResult,
} from "./services/stream-delivery.service.interface";
import { TOKEN_SERVICE } from "../auth/services/token.service.interface";

describe("StreamDeliveryController (Unit)", () => {
  let controller: StreamDeliveryController;
  let streamDeliveryService: jest.Mocked<IStreamDeliveryService>;

  const mockUser = {
    sub: "user-1111-1111-1111-111111111111",
    email: "farmer@vetralink.com",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const mockReq = {
    protocol: "https",
    get: jest.fn().mockReturnValue("api.vetralink.pro"),
  } as unknown as Request;

  const createMockResponse = () => {
    const res: Partial<Response> = {
      cookie: jest.fn().mockReturnThis(),
      redirect: jest.fn().mockReturnThis(),
    };
    return res as Response;
  };

  const mockSessionResult: StreamSessionResult = {
    productId: "prod-1111-1111-1111-111111111111",
    streamUrl: "https://cdn.vetralink.pro/hls/prod-1111/master.m3u8?Policy=xyz",
    drmKeyUrl: "https://api.vetralink.pro/api/v1/media/drm/key/signed-token",
    cookies: {
      policy: "policy-xyz",
      signature: "sig-xyz",
      keyPairId: "K2JC3XQRI3UW74",
    },
    expiresAt: new Date("2026-09-05T18:00:00.000Z"),
    expiresInSeconds: 3600,
  };

  beforeEach(async () => {
    streamDeliveryService = {
      createPlaybackSession: jest.fn().mockResolvedValue(mockSessionResult),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StreamDeliveryController],
      providers: [
        { provide: STREAM_DELIVERY_SERVICE, useValue: streamDeliveryService },
        {
          provide: TOKEN_SERVICE,
          useValue: { verifyAccessToken: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<StreamDeliveryController>(StreamDeliveryController);
  });

  describe("createSession", () => {
    it("should provision a streaming session and return mapped response", async () => {
      const dto = { productId: "prod-1111-1111-1111-111111111111" };

      const response = await controller.createSession(mockUser, dto, mockReq);

      expect(streamDeliveryService.createPlaybackSession).toHaveBeenCalledWith(
        mockUser.sub,
        mockUser.role,
        dto.productId,
        "api.vetralink.pro",
        "https"
      );

      expect(response.productId).toBe(dto.productId);
      expect(response.streamUrl).toBe(mockSessionResult.streamUrl);
      expect(response.drmKeyUrl).toBe(mockSessionResult.drmKeyUrl);
      expect(response.cookies).toEqual({
        "CloudFront-Policy": "policy-xyz",
        "CloudFront-Signature": "sig-xyz",
        "CloudFront-Key-Pair-Id": "K2JC3XQRI3UW74",
      });
      expect(response.expiresInSeconds).toBe(3600);
    });
  });

  describe("getManifest", () => {
    it("should set CloudFront signed cookies and redirect with 302 to stream URL", async () => {
      const productId = "prod-1111-1111-1111-111111111111";
      const res = createMockResponse();

      await controller.getManifest(mockUser, productId, mockReq, res);

      expect(res.cookie).toHaveBeenCalledWith(
        "CloudFront-Policy",
        "policy-xyz",
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: "none",
          path: `/hls/${productId}`,
        })
      );
      expect(res.cookie).toHaveBeenCalledWith(
        "CloudFront-Signature",
        "sig-xyz",
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
      );
      expect(res.cookie).toHaveBeenCalledWith(
        "CloudFront-Key-Pair-Id",
        "K2JC3XQRI3UW74",
        expect.objectContaining({
          httpOnly: true,
          secure: true,
          sameSite: "none",
        })
      );

      expect(res.redirect).toHaveBeenCalledWith(
        302,
        mockSessionResult.streamUrl
      );
    });
  });
});
