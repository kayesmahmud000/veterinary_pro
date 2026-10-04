import { Test, TestingModule } from "@nestjs/testing";
import { JwtModule, JwtService } from "@nestjs/jwt";
import { DrmTokenService } from "./drm-token.service";
import { EnvService } from "../../../config/env.service";
import { UnauthorizedDomainException } from "../../../common/exceptions/domain.exception";

describe("DrmTokenService (Unit)", () => {
  let service: DrmTokenService;
  let jwtService: JwtService;
  let mockEnvService: {
    hlsDrmKeySecret: string;
    drmTokenExpirationSeconds: number;
  };

  const secret = "test_hls_drm_key_master_secret_32_chars_long";

  beforeEach(async () => {
    mockEnvService = {
      hlsDrmKeySecret: secret,
      drmTokenExpirationSeconds: 600,
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret,
        }),
      ],
      providers: [
        DrmTokenService,
        {
          provide: EnvService,
          useValue: mockEnvService,
        },
      ],
    }).compile();

    service = module.get<DrmTokenService>(DrmTokenService);
    jwtService = module.get<JwtService>(JwtService);
  });

  describe("generatePlaybackToken", () => {
    it("should generate a valid signed token with proper expiry and claims", async () => {
      const userId = "user-1111-1111-1111-111111111111";
      const productId = "prod-2222-2222-2222-222222222222";
      const role = "FARMER";

      const result = await service.generatePlaybackToken(userId, productId, role);

      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe("string");
      expect(result.expiresInSeconds).toBe(600);
      expect(result.expiresAt.getTime()).toBeGreaterThan(Date.now());

      const decoded = await jwtService.verifyAsync(result.token, { secret });
      expect(decoded.sub).toBe(userId);
      expect(decoded.pid).toBe(productId);
      expect(decoded.role).toBe(role);
      expect(decoded.jti).toBeDefined();
      expect(decoded.exp).toBeDefined();
    });
  });

  describe("verifyPlaybackToken", () => {
    it("should successfully verify and decode a valid token", async () => {
      const userId = "user-1111-1111-1111-111111111111";
      const productId = "prod-2222-2222-2222-222222222222";
      const role = "VET";

      const { token } = await service.generatePlaybackToken(userId, productId, role);
      const decoded = await service.verifyPlaybackToken(token);

      expect(decoded.sub).toBe(userId);
      expect(decoded.pid).toBe(productId);
      expect(decoded.role).toBe(role);
    });

    it("should throw UnauthorizedDomainException if token is signed with a different secret", async () => {
      const foreignToken = await jwtService.signAsync(
        { sub: "user-1", pid: "prod-1" },
        { secret: "different_secret_key_minimum_32_characters_long" }
      );

      await expect(service.verifyPlaybackToken(foreignToken)).rejects.toThrow(
        UnauthorizedDomainException
      );
    });

    it("should throw UnauthorizedDomainException if token is expired", async () => {
      const expiredToken = await jwtService.signAsync(
        { sub: "user-1", pid: "prod-1" },
        { secret, expiresIn: "-1s" }
      );

      await expect(service.verifyPlaybackToken(expiredToken)).rejects.toThrow(
        UnauthorizedDomainException
      );
    });

    it("should throw UnauthorizedDomainException if token is missing required claims", async () => {
      const incompleteToken = await jwtService.signAsync(
        { somethingElse: "abc" },
        { secret }
      );

      await expect(service.verifyPlaybackToken(incompleteToken)).rejects.toThrow(
        UnauthorizedDomainException
      );
    });

    it("should throw UnauthorizedDomainException if token string is invalid or empty", async () => {
      await expect(service.verifyPlaybackToken("")).rejects.toThrow(
        UnauthorizedDomainException
      );
      await expect(service.verifyPlaybackToken(null as any)).rejects.toThrow(
        UnauthorizedDomainException
      );
    });
  });
});
