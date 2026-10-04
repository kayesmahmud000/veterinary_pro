import { Test, TestingModule } from "@nestjs/testing";
import { JwtService } from "@nestjs/jwt";
import { UserRole, UserStatus } from "@vetralink/shared-types";
import { EnvService } from "../../../config/env.service";
import { TokenService } from "./token.service";
import { UnauthorizedDomainException } from "../../../common/exceptions/domain.exception";

describe("TokenService", () => {
  let service: TokenService;
  let jwtService: jest.Mocked<JwtService>;
  let envService: jest.Mocked<EnvService>;

  const mockParams = {
    userId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    email: "user@example.com",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
    activeFarmId: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
  };

  beforeEach(async () => {
    const mockJwtService = {
      signAsync: jest.fn().mockResolvedValue("mocked.access.jwt"),
      verifyAsync: jest.fn(),
    };

    const mockEnvService = {
      jwtAccessSecret: "test_access_secret_with_minimum_32_characters",
      jwtRefreshSecret: "test_refresh_secret_with_minimum_32_characters",
      jwtAccessExpiration: "15m",
      jwtRefreshExpiration: "7d",
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: EnvService, useValue: mockEnvService },
      ],
    }).compile();

    service = module.get<TokenService>(TokenService);
    jwtService = module.get(JwtService);
    envService = module.get(EnvService);
  });

  describe("generateTokens()", () => {
    it("should generate valid AuthTokensDto with Bearer type and 900s expiration", async () => {
      const tokens = await service.generateTokens(mockParams);

      expect(tokens.accessToken).toBe("mocked.access.jwt");
      expect(tokens.refreshToken).toHaveLength(80); // 40 bytes hex
      expect(tokens.tokenType).toBe("Bearer");
      expect(tokens.expiresIn).toBe(900); // 15m = 900s

      expect(jwtService.signAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          sub: mockParams.userId,
          email: mockParams.email,
          role: mockParams.role,
          status: mockParams.status,
          activeFarmId: mockParams.activeFarmId,
          jti: expect.any(String),
        }),
        expect.objectContaining({
          secret: envService.jwtAccessSecret,
          expiresIn: "15m",
        })
      );
    });
  });

  describe("generateRefreshToken() & hashRefreshToken()", () => {
    it("should generate a 80-char hex string and compute 64-char sha256 hash", () => {
      const token = service.generateRefreshToken();
      expect(token).toHaveLength(80);
      expect(token).toMatch(/^[0-9a-f]{80}$/);

      const hash = service.hashRefreshToken(token);
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);

      // Deterministic
      expect(service.hashRefreshToken(token)).toBe(hash);
    });
  });

  describe("verifyAccessToken()", () => {
    it("should return decoded payload when token is valid", async () => {
      const expectedPayload = {
        sub: mockParams.userId,
        email: mockParams.email,
        role: mockParams.role,
        status: mockParams.status,
        jti: "test-jti",
      };
      (jwtService.verifyAsync as jest.Mock).mockResolvedValue(expectedPayload);

      const result = await service.verifyAccessToken("valid.jwt.token");
      expect(result).toEqual(expectedPayload);
      expect(jwtService.verifyAsync).toHaveBeenCalledWith("valid.jwt.token", {
        secret: envService.jwtAccessSecret,
      });
    });

    it("should throw UnauthorizedDomainException when verification fails", async () => {
      (jwtService.verifyAsync as jest.Mock).mockRejectedValue(
        new Error("jwt expired")
      );

      await expect(
        service.verifyAccessToken("expired.jwt.token")
      ).rejects.toThrow(UnauthorizedDomainException);
    });
  });

  describe("getRefreshTokenExpiresAt()", () => {
    it("should return a future date approximately 7 days from now", () => {
      const before = Date.now();
      const expiresAt = service.getRefreshTokenExpiresAt();
      const after = Date.now();

      const expectedDiff = 7 * 24 * 60 * 60 * 1000;
      expect(expiresAt.getTime()).toBeGreaterThanOrEqual(before + expectedDiff);
      expect(expiresAt.getTime()).toBeLessThanOrEqual(after + expectedDiff);
    });
  });
});
