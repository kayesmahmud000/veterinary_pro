import { Test, TestingModule } from "@nestjs/testing";
import { ProductType, UserRole } from "@vetralink/shared-types";
import { StreamDeliveryService } from "./stream-delivery.service";
import { PrismaService } from "../../prisma/prisma.service";
import { ENTITLEMENT_SERVICE } from "./entitlement.service.interface";
import { CLOUDFRONT_SIGNER_SERVICE } from "./cloudfront-signer.service.interface";
import { DRM_TOKEN_SERVICE } from "./drm-token.service.interface";
import { EnvService } from "../../../config/env.service";
import {
  EntityNotFoundException,
  ForbiddenOperationException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";

describe("StreamDeliveryService", () => {
  let service: StreamDeliveryService;
  let mockPrisma: any;
  let mockEntitlementService: any;
  let mockCloudFrontSignerService: any;
  let mockDrmTokenService: any;
  let mockEnvService: any;

  const validProductId = "11111111-1111-4111-8111-111111111111";
  const validUserId = "22222222-2222-4222-8222-222222222222";

  const mockProduct = {
    id: validProductId,
    title: "Dairy Herd Health Mastery",
    type: ProductType.VIDEO_COURSE,
    isPublished: true,
    deletedAt: null,
  };

  beforeEach(async () => {
    mockPrisma = {
      product: {
        findUnique: jest.fn().mockResolvedValue(mockProduct),
      },
    };

    mockEntitlementService = {
      checkEntitlement: jest.fn().mockResolvedValue(true),
    };

    mockCloudFrontSignerService = {
      getStreamBaseUrl: jest.fn().mockReturnValue("https://cdn.vetralink.pro"),
      signUrlCustomPolicy: jest
        .fn()
        .mockReturnValue("https://cdn.vetralink.pro/hls/test/master.m3u8?Policy=xyz"),
      generateSignedCookies: jest.fn().mockReturnValue({
        policy: "policy_abc",
        signature: "sig_abc",
        keyPairId: "K2JC3XQRI3UW74",
      }),
    };

    mockDrmTokenService = {
      generatePlaybackToken: jest.fn().mockResolvedValue({
        token: "drm_token_xyz",
        expiresAt: new Date("2026-09-05T18:00:00.000Z"),
        expiresInSeconds: 600,
      }),
    };

    mockEnvService = {
      port: 3001,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreamDeliveryService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ENTITLEMENT_SERVICE, useValue: mockEntitlementService },
        { provide: CLOUDFRONT_SIGNER_SERVICE, useValue: mockCloudFrontSignerService },
        { provide: DRM_TOKEN_SERVICE, useValue: mockDrmTokenService },
        { provide: EnvService, useValue: mockEnvService },
      ],
    }).compile();

    service = module.get<StreamDeliveryService>(StreamDeliveryService);
  });

  it("should successfully create a playback session when product is valid and user is entitled", async () => {
    const result = await service.createPlaybackSession(
      validUserId,
      UserRole.FARMER,
      validProductId,
      "api.vetralink.pro",
      "https"
    );

    expect(result.productId).toBe(validProductId);
    expect(result.streamUrl).toBe(
      "https://cdn.vetralink.pro/hls/test/master.m3u8?Policy=xyz"
    );
    expect(result.drmKeyUrl).toBe(
      "https://api.vetralink.pro/api/v1/media/drm/key/drm_token_xyz"
    );
    expect(result.cookies).toEqual({
      policy: "policy_abc",
      signature: "sig_abc",
      keyPairId: "K2JC3XQRI3UW74",
    });
    expect(result.expiresInSeconds).toBe(600);

    expect(mockCloudFrontSignerService.signUrlCustomPolicy).toHaveBeenCalledWith(
      `https://cdn.vetralink.pro/hls/${validProductId}/*`,
      `https://cdn.vetralink.pro/hls/${validProductId}/master.m3u8`,
      600
    );
    expect(mockCloudFrontSignerService.generateSignedCookies).toHaveBeenCalledWith(
      `https://cdn.vetralink.pro/hls/${validProductId}/*`,
      600
    );
  });

  it("should throw EntityNotFoundException if product does not exist", async () => {
    mockPrisma.product.findUnique.mockResolvedValue(null);

    await expect(
      service.createPlaybackSession(validUserId, UserRole.FARMER, validProductId)
    ).rejects.toThrow(EntityNotFoundException);
  });

  it("should throw EntityNotFoundException if product is soft-deleted", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      ...mockProduct,
      deletedAt: new Date(),
    });

    await expect(
      service.createPlaybackSession(validUserId, UserRole.FARMER, validProductId)
    ).rejects.toThrow(EntityNotFoundException);
  });

  it("should throw EntityNotFoundException if product is unpublished and user is not admin", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      ...mockProduct,
      isPublished: false,
    });

    await expect(
      service.createPlaybackSession(validUserId, UserRole.FARMER, validProductId)
    ).rejects.toThrow(EntityNotFoundException);
  });

  it("should allow admin to stream unpublished product", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      ...mockProduct,
      isPublished: false,
    });

    const result = await service.createPlaybackSession(
      validUserId,
      UserRole.ADMIN,
      validProductId
    );

    expect(result.productId).toBe(validProductId);
  });

  it("should throw ValidationDomainException if product is not a video course", async () => {
    mockPrisma.product.findUnique.mockResolvedValue({
      ...mockProduct,
      type: ProductType.EBOOK,
    });

    await expect(
      service.createPlaybackSession(validUserId, UserRole.FARMER, validProductId)
    ).rejects.toThrow(ValidationDomainException);
  });

  it("should throw ForbiddenOperationException if user is not entitled", async () => {
    mockEntitlementService.checkEntitlement.mockResolvedValue(false);

    await expect(
      service.createPlaybackSession(validUserId, UserRole.FARMER, validProductId)
    ).rejects.toThrow(ForbiddenOperationException);
  });
});
