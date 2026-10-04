import { Test, TestingModule } from "@nestjs/testing";
import { UserRole, UserStatus } from "@vetralink/shared-types";
import { AuthService } from "./auth.service";
import {
  IUserRepository,
  USER_REPOSITORY,
} from "../../users/repositories/user.repository.interface";
import {
  IRefreshTokenRepository,
  REFRESH_TOKEN_REPOSITORY,
} from "../repositories/refresh-token.repository.interface";
import {
  IPasswordHasher,
  PASSWORD_HASHER,
} from "./password-hasher.interface";
import {
  ITokenService,
  TOKEN_SERVICE,
} from "./token.service.interface";
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from "../../prisma/interfaces/transaction.interface";
import { PiiCryptoService } from "../../../common/crypto/pii-crypto.service";
import { UserEntity } from "../../users/entities/user.entity";
import { RefreshTokenEntity } from "../entities/refresh-token.entity";
import {
  EntityConflictException,
  ForbiddenOperationException,
  UnauthorizedDomainException,
} from "../../../common/exceptions/domain.exception";

describe("AuthService", () => {
  let authService: AuthService;
  let userRepository: jest.Mocked<IUserRepository>;
  let refreshTokenRepository: jest.Mocked<IRefreshTokenRepository>;
  let passwordHasher: jest.Mocked<IPasswordHasher>;
  let tokenService: jest.Mocked<ITokenService>;
  let transactionManager: jest.Mocked<ITransactionManager>;
  let piiCryptoService: jest.Mocked<PiiCryptoService>;

  const mockUserEntity = UserEntity.create({
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    email: "test@example.com",
    name: "Test User",
    passwordHash: "$2b$12$hashedPasswordExample",
    role: UserRole.FARMER,
  });

  const mockTokens = {
    accessToken: "mock.access.token",
    refreshToken: "mock_refresh_token_hex_80_chars",
    tokenType: "Bearer" as const,
    expiresIn: 900,
  };

  beforeEach(async () => {
    const mockUserRepo: Partial<jest.Mocked<IUserRepository>> = {
      create: jest.fn().mockImplementation((user) => Promise.resolve(user)),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByPhoneHash: jest.fn(),
      update: jest.fn().mockImplementation((user) => Promise.resolve(user)),
      existsByEmail: jest.fn().mockResolvedValue(false),
      existsByPhoneHash: jest.fn().mockResolvedValue(false),
    };

    const mockTokenRepo: Partial<jest.Mocked<IRefreshTokenRepository>> = {
      create: jest.fn().mockImplementation((token) => Promise.resolve(token)),
      findById: jest.fn(),
      findByTokenHash: jest.fn(),
      revoke: jest.fn().mockResolvedValue(undefined),
      revokeByTokenHash: jest.fn().mockResolvedValue(undefined),
      revokeAllForUser: jest.fn().mockResolvedValue(2),
    };

    const mockHasher: jest.Mocked<IPasswordHasher> = {
      hash: jest.fn().mockResolvedValue("$2b$12$newHashedPassword"),
      compare: jest.fn().mockResolvedValue(true),
    };

    const mockTokensService: jest.Mocked<ITokenService> = {
      generateTokens: jest.fn().mockResolvedValue(mockTokens),
      generateAccessToken: jest.fn().mockResolvedValue("mock.access.token"),
      generateRefreshToken: jest.fn().mockReturnValue("mock_refresh_token_hex"),
      hashRefreshToken: jest.fn((token) => `hash_of_${token}`),
      verifyAccessToken: jest.fn(),
      getRefreshTokenExpiresAt: jest.fn().mockReturnValue(new Date(Date.now() + 7 * 86400000)),
    };

    const mockTxManager: jest.Mocked<ITransactionManager> = {
      run: jest.fn().mockImplementation(async (callback) => {
        return callback({} as any);
      }),
    };

    const mockPiiService: Partial<jest.Mocked<PiiCryptoService>> = {
      hashPhone: jest.fn((phone) => `hashed_${phone}`),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: USER_REPOSITORY, useValue: mockUserRepo },
        { provide: REFRESH_TOKEN_REPOSITORY, useValue: mockTokenRepo },
        { provide: PASSWORD_HASHER, useValue: mockHasher },
        { provide: TOKEN_SERVICE, useValue: mockTokensService },
        { provide: TRANSACTION_MANAGER, useValue: mockTxManager },
        { provide: PiiCryptoService, useValue: mockPiiService },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    userRepository = module.get(USER_REPOSITORY);
    refreshTokenRepository = module.get(REFRESH_TOKEN_REPOSITORY);
    passwordHasher = module.get(PASSWORD_HASHER);
    tokenService = module.get(TOKEN_SERVICE);
    transactionManager = module.get(TRANSACTION_MANAGER);
    piiCryptoService = module.get(PiiCryptoService);
  });

  describe("register()", () => {
    it("should register a valid user and return tokens and sanitized profile", async () => {
      const result = await authService.register({
        email: "new@example.com",
        password: "SecurePassword123!",
        name: "New Farmer",
        role: UserRole.FARMER,
      });

      expect(userRepository.existsByEmail).toHaveBeenCalledWith("new@example.com");
      expect(passwordHasher.hash).toHaveBeenCalledWith("SecurePassword123!");
      expect(transactionManager.run).toHaveBeenCalled();
      expect(result.tokens).toEqual(mockTokens);
      expect(result.user.email).toBe("new@example.com");
      expect((result.user as any).passwordHash).toBeUndefined();
    });

    it("should reject registration with SUPER_ADMIN role", async () => {
      await expect(
        authService.register({
          email: "admin@example.com",
          password: "password123",
          name: "Admin Attempt",
          role: UserRole.SUPER_ADMIN,
        })
      ).rejects.toThrow(ForbiddenOperationException);
    });

    it("should reject registration with ADMIN role", async () => {
      await expect(
        authService.register({
          email: "admin@example.com",
          password: "password123",
          name: "Admin Attempt",
          role: UserRole.ADMIN,
        })
      ).rejects.toThrow(ForbiddenOperationException);
    });

    it("should throw EntityConflictException when email is taken", async () => {
      userRepository.existsByEmail.mockResolvedValueOnce(true);

      await expect(
        authService.register({
          email: "taken@example.com",
          password: "password123",
          name: "Duplicate",
        })
      ).rejects.toThrow(EntityConflictException);
    });

    it("should throw EntityConflictException when phone is taken", async () => {
      userRepository.existsByPhoneHash.mockResolvedValueOnce(true);

      await expect(
        authService.register({
          email: "new@example.com",
          password: "password123",
          name: "Duplicate Phone",
          phone: "+12025550100",
        })
      ).rejects.toThrow(EntityConflictException);
    });
  });

  describe("login()", () => {
    it("should successfully authenticate valid user and record login", async () => {
      userRepository.findByEmail.mockResolvedValueOnce(mockUserEntity);

      const result = await authService.login({
        email: "test@example.com",
        password: "CorrectPassword123",
      });

      expect(userRepository.findByEmail).toHaveBeenCalledWith("test@example.com");
      expect(passwordHasher.compare).toHaveBeenCalledWith(
        "CorrectPassword123",
        mockUserEntity.passwordHash
      );
      expect(transactionManager.run).toHaveBeenCalled();
      expect(result.tokens).toEqual(mockTokens);
      expect(result.user.id).toBe(mockUserEntity.id);
    });

    it("should authenticate using phone when email is omitted", async () => {
      userRepository.findByPhoneHash.mockResolvedValueOnce(mockUserEntity);

      const result = await authService.login({
        email: "",
        phone: "+12025550100",
        password: "CorrectPassword123",
      });

      expect(piiCryptoService.hashPhone).toHaveBeenCalledWith("+12025550100");
      expect(userRepository.findByPhoneHash).toHaveBeenCalledWith("hashed_+12025550100");
      expect(result.user.id).toBe(mockUserEntity.id);
    });

    it("should throw UnauthorizedDomainException if user is not found", async () => {
      userRepository.findByEmail.mockResolvedValueOnce(null);

      await expect(
        authService.login({
          email: "nonexistent@example.com",
          password: "password",
        })
      ).rejects.toThrow(UnauthorizedDomainException);
    });

    it("should throw ForbiddenOperationException if account is suspended", async () => {
      const suspendedUser = UserEntity.reconstitute({
        ...mockUserEntity.toSafeObject(),
        passwordHash: mockUserEntity.passwordHash,
        status: UserStatus.SUSPENDED,
      });
      userRepository.findByEmail.mockResolvedValueOnce(suspendedUser);

      await expect(
        authService.login({
          email: "suspended@example.com",
          password: "password",
        })
      ).rejects.toThrow(ForbiddenOperationException);
    });

    it("should throw UnauthorizedDomainException if password does not match", async () => {
      userRepository.findByEmail.mockResolvedValueOnce(mockUserEntity);
      passwordHasher.compare.mockResolvedValueOnce(false);

      await expect(
        authService.login({
          email: "test@example.com",
          password: "WrongPassword",
        })
      ).rejects.toThrow(UnauthorizedDomainException);
    });
  });

  describe("refreshToken() (RTR & Replay Attack Defense)", () => {
    it("should rotate valid refresh token inside a transaction", async () => {
      const validToken = RefreshTokenEntity.create({
        userId: mockUserEntity.id,
        tokenHash: "hash_of_valid_refresh_token",
        expiresAt: new Date(Date.now() + 86400000),
      });

      refreshTokenRepository.findByTokenHash.mockResolvedValueOnce(validToken);
      userRepository.findById.mockResolvedValueOnce(mockUserEntity);

      const result = await authService.refreshToken("valid_refresh_token");

      expect(refreshTokenRepository.findByTokenHash).toHaveBeenCalledWith(
        "hash_of_valid_refresh_token"
      );
      expect(transactionManager.run).toHaveBeenCalled();
      expect(result.tokens).toEqual(mockTokens);
    });

    it("should trigger session purge (revokeAllForUser) when token reuse is detected", async () => {
      const revokedToken = RefreshTokenEntity.create({
        userId: mockUserEntity.id,
        tokenHash: "hash_of_reused_token",
        expiresAt: new Date(Date.now() + 86400000),
      });
      revokedToken.revoke(new Date(Date.now() - 60000)); // Already revoked!

      refreshTokenRepository.findByTokenHash.mockResolvedValueOnce(revokedToken);

      await expect(
        authService.refreshToken("reused_token")
      ).rejects.toThrow(UnauthorizedDomainException);

      // Replay attack defense triggered
      expect(refreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith(
        mockUserEntity.id
      );
    });

    it("should throw UnauthorizedDomainException if refresh token is expired", async () => {
      const expiredToken = RefreshTokenEntity.create({
        userId: mockUserEntity.id,
        tokenHash: "hash_of_expired_token",
        expiresAt: new Date(Date.now() - 1000), // In past
      });

      refreshTokenRepository.findByTokenHash.mockResolvedValueOnce(expiredToken);

      await expect(
        authService.refreshToken("expired_token")
      ).rejects.toThrow(UnauthorizedDomainException);
    });

    it("should throw UnauthorizedDomainException if token is not found", async () => {
      refreshTokenRepository.findByTokenHash.mockResolvedValueOnce(null);

      await expect(
        authService.refreshToken("unknown_token")
      ).rejects.toThrow(UnauthorizedDomainException);
    });
  });

  describe("logout() & logoutAll()", () => {
    it("should revoke token by hash on logout", async () => {
      await authService.logout("refresh_token_to_logout");
      expect(refreshTokenRepository.revokeByTokenHash).toHaveBeenCalledWith(
        "hash_of_refresh_token_to_logout"
      );
    });

    it("should revoke all active tokens on logoutAll", async () => {
      await authService.logoutAll(mockUserEntity.id);
      expect(refreshTokenRepository.revokeAllForUser).toHaveBeenCalledWith(
        mockUserEntity.id
      );
    });
  });
});
