import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import * as supertest from "supertest";

const request =
  typeof supertest === "function"
    ? supertest
    : ((supertest as any).default ?? supertest);
import { UserRole, UserStatus } from "@vetralink/shared-types";
import { AuthController } from "./auth.controller";
import { AUTH_SERVICE, IAuthService } from "./services/auth.service.interface";
import {
  IUserRepository,
  USER_REPOSITORY,
} from "../users/repositories/user.repository.interface";
import {
  ITokenService,
  TOKEN_SERVICE,
} from "./services/token.service.interface";
import { ResponseInterceptor } from "../../common/interceptors/response.interceptor";
import { GlobalExceptionFilter } from "../../common/filters/global-exception.filter";
import { UserEntity } from "../users/entities/user.entity";
import {
  EntityConflictException,
  UnauthorizedDomainException,
} from "../../common/exceptions/domain.exception";

describe("AuthController (Integration via Supertest)", () => {
  let app: INestApplication;
  let authService: jest.Mocked<IAuthService>;
  let userRepository: jest.Mocked<IUserRepository>;
  let tokenService: jest.Mocked<ITokenService>;

  const mockUser = UserEntity.create({
    id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    email: "test.farmer@vetralink.com",
    name: "Farmer John",
    passwordHash: "hashedPassword123",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
    phone: "+12345678901",
    phoneHash: "phoneHash123",
  });

  const mockAuthUserSummary = {
    id: mockUser.id,
    email: mockUser.email,
    name: mockUser.name,
    role: mockUser.role,
    status: mockUser.status,
    isEmailVerified: mockUser.isEmailVerified,
    maskedPhone: mockUser.maskPhone(),
    avatarUrl: mockUser.avatarUrl,
    createdAt: mockUser.createdAt.toISOString(),
  };

  const mockTokens = {
    accessToken: "valid.jwt.access.token",
    refreshToken: "valid.jwt.refresh.token",
    tokenType: "Bearer" as const,
    expiresIn: 900,
  };

  beforeAll(async () => {
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

    tokenService = {
      generateTokens: jest.fn(),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
      hashRefreshToken: jest.fn(),
      getRefreshTokenExpiresAt: jest.fn(),
    } as unknown as jest.Mocked<ITokenService>;

    const moduleFixture: TestingModule = await Test.createTestingModule({
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
          useValue: tokenService,
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

  describe("POST /auth/register", () => {
    it("should return 201 with ApiResponse envelope when input is valid", async () => {
      authService.register.mockResolvedValueOnce({
        user: mockAuthUserSummary,
        tokens: mockTokens,
      });

      const response = await request(app.getHttpServer())
        .post("/auth/register")
        .send({
          email: "test.farmer@vetralink.com",
          password: "SecurePassword123!",
          name: "Farmer John",
          role: "FARMER",
        })
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        statusCode: 201,
        message: "User registration successful",
        data: {
          user: mockAuthUserSummary,
          tokens: mockTokens,
        },
      });
      expect(response.body.traceId).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    it("should return 400 when validation fails (e.g. invalid email or password too short)", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/register")
        .send({
          email: "not-an-email",
          password: "short",
          name: "",
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.statusCode).toBe(400);
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors.length).toBeGreaterThan(0);
    });

    it("should return 409 when email is already registered", async () => {
      authService.register.mockRejectedValueOnce(
        new EntityConflictException(
          "User with email already exists",
          "email"
        )
      );

      const response = await request(app.getHttpServer())
        .post("/auth/register")
        .send({
          email: "duplicate@vetralink.com",
          password: "SecurePassword123!",
          name: "Duplicate User",
        })
        .expect(409);

      expect(response.body.success).toBe(false);
      expect(response.body.statusCode).toBe(409);
      expect(response.body.message).toContain("already exists");
    });
  });

  describe("POST /auth/login", () => {
    it("should return 200 with tokens when credentials are valid", async () => {
      authService.login.mockResolvedValueOnce({
        user: mockAuthUserSummary,
        tokens: mockTokens,
      });

      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          email: "test.farmer@vetralink.com",
          password: "SecurePassword123!",
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        statusCode: 200,
        message: "Login successful",
        data: {
          user: mockAuthUserSummary,
          tokens: mockTokens,
        },
      });
    });

    it("should return 401 when invalid credentials provided", async () => {
      authService.login.mockRejectedValueOnce(
        new UnauthorizedDomainException("Invalid email or password.")
      );

      const response = await request(app.getHttpServer())
        .post("/auth/login")
        .send({
          email: "test.farmer@vetralink.com",
          password: "WrongPassword123!",
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.statusCode).toBe(401);
      expect(response.body.message).toBe("Invalid email or password.");
    });
  });

  describe("POST /auth/refresh", () => {
    it("should rotate tokens and return 200", async () => {
      authService.refreshToken.mockResolvedValueOnce({
        tokens: mockTokens,
      });

      const response = await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({
          refreshToken: "valid.refresh.token",
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        statusCode: 200,
        message: "Tokens refreshed successfully",
        data: {
          tokens: mockTokens,
        },
      });
    });

    it("should return 400 when refreshToken body is missing", async () => {
      const response = await request(app.getHttpServer())
        .post("/auth/refresh")
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.statusCode).toBe(400);
    });
  });

  describe("POST /auth/logout", () => {
    it("should return 200 with null data on successful logout", async () => {
      authService.logout.mockResolvedValueOnce();

      const response = await request(app.getHttpServer())
        .post("/auth/logout")
        .send({
          refreshToken: "valid.refresh.token",
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        statusCode: 200,
        message: "Logout successful",
        data: null,
      });
    });
  });

  describe("GET /auth/me", () => {
    it("should reject request without Authorization header with 401", async () => {
      const response = await request(app.getHttpServer())
        .get("/auth/me")
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.statusCode).toBe(401);
      expect(response.body.message).toContain("Missing Authorization header");
    });

    it("should return user profile when valid Bearer token provided", async () => {
      tokenService.verifyAccessToken.mockResolvedValueOnce({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        status: mockUser.status,
      });

      userRepository.findById.mockResolvedValueOnce(mockUser);

      const response = await request(app.getHttpServer())
        .get("/auth/me")
        .set("Authorization", "Bearer valid.jwt.token")
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        statusCode: 200,
        message: "Profile retrieved successfully",
        data: mockAuthUserSummary,
      });
    });
  });

  describe("POST /auth/logout-all", () => {
    it("should revoke all sessions for authenticated user and return 200", async () => {
      tokenService.verifyAccessToken.mockResolvedValueOnce({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        status: mockUser.status,
      });

      authService.logoutAll.mockResolvedValueOnce();

      const response = await request(app.getHttpServer())
        .post("/auth/logout-all")
        .set("Authorization", "Bearer valid.jwt.token")
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        statusCode: 200,
        message: "All sessions revoked successfully",
        data: null,
      });
      expect(authService.logoutAll).toHaveBeenCalledWith(mockUser.id);
    });
  });
});
