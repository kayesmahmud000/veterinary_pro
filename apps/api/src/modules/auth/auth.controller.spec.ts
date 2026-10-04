import { Test, TestingModule } from "@nestjs/testing";
import { UserRole, UserStatus } from "@vetralink/shared-types";
import { AuthController } from "./auth.controller";
import { AUTH_SERVICE, IAuthService } from "./services/auth.service.interface";
import {
  IUserRepository,
  USER_REPOSITORY,
} from "../users/repositories/user.repository.interface";
import { UserEntity } from "../users/entities/user.entity";
import {
  EntityConflictException,
  ForbiddenOperationException,
  UnauthorizedDomainException,
} from "../../common/exceptions/domain.exception";
import { TOKEN_SERVICE } from "./services/token.service.interface";

describe("AuthController", () => {
  let controller: AuthController;
  let authService: jest.Mocked<IAuthService>;
  let userRepository: jest.Mocked<IUserRepository>;

  const mockMeta = {
    ipAddress: "192.168.1.1",
    userAgent: "JestTestRunner/1.0",
  };

  const mockTokens = {
    accessToken: "mock.access.jwt",
    refreshToken: "mock.refresh.jwt",
    tokenType: "Bearer" as const,
    expiresIn: 900,
  };

  const mockUserEntity = UserEntity.create({
    id: "11111111-1111-1111-1111-111111111111",
    email: "farmer@vetralink.com",
    name: "John Farmer",
    passwordHash: "$2a$12$mockPasswordHash",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
    phone: "+12345678901",
    phoneHash: "mockPhoneHash",
  });

  const mockAuthUserSummary = {
    id: mockUserEntity.id,
    email: mockUserEntity.email,
    name: mockUserEntity.name,
    role: mockUserEntity.role,
    status: mockUserEntity.status,
    isEmailVerified: mockUserEntity.isEmailVerified,
    maskedPhone: mockUserEntity.maskPhone(),
    avatarUrl: mockUserEntity.avatarUrl,
    createdAt: mockUserEntity.createdAt.toISOString(),
  };

  beforeEach(async () => {
    authService = {
      register: jest.fn(),
      login: jest.fn(),
      refreshToken: jest.fn(),
      logout: jest.fn(),
      logoutAll: jest.fn(),
    } as unknown as jest.Mocked<IAuthService>;

    userRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByPhoneHash: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      existsByEmail: jest.fn(),
      existsByPhoneHash: jest.fn(),
    } as unknown as jest.Mocked<IUserRepository>;

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AUTH_SERVICE,
          useValue: authService,
        },
        {
          provide: USER_REPOSITORY,
          useValue: userRepository,
        },
        {
          provide: TOKEN_SERVICE,
          useValue: {
            verifyAccessToken: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  describe("register", () => {
    it("should call authService.register and return user summary and tokens", async () => {
      const dto = {
        email: "farmer@vetralink.com",
        password: "SecurePassword123!",
        name: "John Farmer",
        role: UserRole.FARMER,
      };

      authService.register.mockResolvedValueOnce({
        user: mockAuthUserSummary,
        tokens: mockTokens,
      });

      const result = await controller.register(dto, mockMeta);

      expect(authService.register).toHaveBeenCalledWith(dto, mockMeta);
      expect(result).toEqual({
        user: mockAuthUserSummary,
        tokens: mockTokens,
      });
    });

    it("should propagate EntityConflictException if email exists", async () => {
      authService.register.mockRejectedValueOnce(
        new EntityConflictException("Email already exists", "email")
      );

      await expect(
        controller.register(
          {
            email: "farmer@vetralink.com",
            password: "SecurePassword123!",
            name: "John Farmer",
          },
          mockMeta
        )
      ).rejects.toThrow(EntityConflictException);
    });

    it("should propagate ForbiddenOperationException if registering admin role", async () => {
      authService.register.mockRejectedValueOnce(
        new ForbiddenOperationException("Administrative roles prohibited")
      );

      await expect(
        controller.register(
          {
            email: "admin@vetralink.com",
            password: "SecurePassword123!",
            name: "Bad Actor",
            role: UserRole.SUPER_ADMIN,
          },
          mockMeta
        )
      ).rejects.toThrow(ForbiddenOperationException);
    });
  });

  describe("login", () => {
    it("should authenticate user and return tokens", async () => {
      const dto = {
        email: "farmer@vetralink.com",
        password: "SecurePassword123!",
      };

      authService.login.mockResolvedValueOnce({
        user: mockAuthUserSummary,
        tokens: mockTokens,
      });

      const result = await controller.login(dto, mockMeta);

      expect(authService.login).toHaveBeenCalledWith(dto, mockMeta);
      expect(result).toEqual({
        user: mockAuthUserSummary,
        tokens: mockTokens,
      });
    });

    it("should propagate UnauthorizedDomainException on bad credentials", async () => {
      authService.login.mockRejectedValueOnce(
        new UnauthorizedDomainException("Invalid email or password.")
      );

      await expect(
        controller.login(
          { email: "farmer@vetralink.com", password: "wrong" },
          mockMeta
        )
      ).rejects.toThrow(UnauthorizedDomainException);
    });
  });

  describe("refresh", () => {
    it("should rotate tokens given valid refresh token", async () => {
      const dto = { refreshToken: "valid.refresh.token" };

      authService.refreshToken.mockResolvedValueOnce({
        tokens: mockTokens,
      });

      const result = await controller.refresh(dto, mockMeta);

      expect(authService.refreshToken).toHaveBeenCalledWith(
        dto.refreshToken,
        mockMeta
      );
      expect(result).toEqual({ tokens: mockTokens });
    });

    it("should propagate UnauthorizedDomainException when token reuse breach occurs", async () => {
      authService.refreshToken.mockRejectedValueOnce(
        new UnauthorizedDomainException("Refresh token reuse detected.")
      );

      await expect(
        controller.refresh({ refreshToken: "reused.token" }, mockMeta)
      ).rejects.toThrow(UnauthorizedDomainException);
    });
  });

  describe("logout", () => {
    it("should call authService.logout and return null", async () => {
      const dto = { refreshToken: "active.refresh.token" };
      authService.logout.mockResolvedValueOnce();

      const result = await controller.logout(dto);

      expect(authService.logout).toHaveBeenCalledWith(dto.refreshToken);
      expect(result).toBeNull();
    });
  });

  describe("logoutAll", () => {
    it("should call authService.logoutAll with user.sub and return null", async () => {
      const jwtUser = {
        sub: mockUserEntity.id,
        email: mockUserEntity.email,
        role: mockUserEntity.role,
        status: mockUserEntity.status,
      };

      authService.logoutAll.mockResolvedValueOnce();

      const result = await controller.logoutAll(jwtUser);

      expect(authService.logoutAll).toHaveBeenCalledWith(jwtUser.sub);
      expect(result).toBeNull();
    });
  });

  describe("getProfile", () => {
    const jwtUser = {
      sub: mockUserEntity.id,
      email: mockUserEntity.email,
      role: mockUserEntity.role,
      status: mockUserEntity.status,
    };

    it("should fetch fresh user record and return profile summary", async () => {
      userRepository.findById.mockResolvedValueOnce(mockUserEntity);

      const result = await controller.getProfile(jwtUser);

      expect(userRepository.findById).toHaveBeenCalledWith(jwtUser.sub);
      expect(result).toEqual(mockAuthUserSummary);
    });

    it("should throw UnauthorizedDomainException if user record is missing", async () => {
      userRepository.findById.mockResolvedValueOnce(null);

      await expect(controller.getProfile(jwtUser)).rejects.toThrow(
        UnauthorizedDomainException
      );
    });

    it("should throw UnauthorizedDomainException if user is suspended", async () => {
      const suspendedUser = UserEntity.create({
        id: mockUserEntity.id,
        email: mockUserEntity.email,
        name: mockUserEntity.name,
        passwordHash: "hash",
      });
      suspendedUser.suspend();

      userRepository.findById.mockResolvedValueOnce(suspendedUser);

      await expect(controller.getProfile(jwtUser)).rejects.toThrow(
        UnauthorizedDomainException
      );
    });

    it("should throw UnauthorizedDomainException if user is soft-deleted", async () => {
      const deletedUser = UserEntity.create({
        id: mockUserEntity.id,
        email: mockUserEntity.email,
        name: mockUserEntity.name,
        passwordHash: "hash",
      });
      deletedUser.softDelete();

      userRepository.findById.mockResolvedValueOnce(deletedUser);

      await expect(controller.getProfile(jwtUser)).rejects.toThrow(
        UnauthorizedDomainException
      );
    });
  });
});
