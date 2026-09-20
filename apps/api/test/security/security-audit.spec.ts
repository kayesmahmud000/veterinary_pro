import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  FarmRole,
  JwtPayload,
  UserRole,
  UserStatus,
} from "@vetralink/shared-types";
import { PiiCryptoService } from "../../src/common/crypto/pii-crypto.service";
import { PiiCryptoException } from "../../src/common/crypto/exceptions/pii-crypto.exception";
import {
  ForbiddenOperationException,
  UnauthorizedDomainException,
  ValidationDomainException,
} from "../../src/common/exceptions/domain.exception";
import { TenantGuard } from "../../src/common/guards/tenant.guard";
import { RolesGuard } from "../../src/common/guards/roles.guard";
import { FarmMemberEntity } from "../../src/modules/farms/entities/farm-member.entity";
import { IFarmMemberRepository } from "../../src/modules/farms/repositories/farm-member.repository.interface";
import { EnvService } from "../../src/config/env.service";

describe("Platform Security Audit & Compliance Suite", () => {
  // =========================================================================
  // 1. PII ENCRYPTION ENGINE (AES-256-GCM & HMAC-SHA256 BLIND INDEX)
  // =========================================================================
  describe("PII Encryption Engine (AES-256-GCM)", () => {
    let piiCryptoService: PiiCryptoService;
    const mockEnvService = {
      aesPiiEncryptionKey:
        "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", // 64 hex characters (32 bytes)
      hashPepper: "super_secret_pepper_for_tests_123456",
    } as unknown as EnvService;

    beforeEach(() => {
      piiCryptoService = new PiiCryptoService(mockEnvService);
    });

    it("should encrypt plaintext into <iv>:<auth_tag>:<ciphertext> format", () => {
      const plaintext = "+1 (202) 555-0199";
      const encrypted = piiCryptoService.encrypt(plaintext);

      expect(encrypted).toBeDefined();
      const parts = encrypted.split(":");
      expect(parts).toHaveLength(3);
      expect(parts[0]).toHaveLength(32); // 16 bytes IV in hex
      expect(parts[1]).toHaveLength(32); // 16 bytes AuthTag in hex
      expect(parts[2]!.length).toBeGreaterThan(0); // Ciphertext
    });

    it("should successfully decrypt ciphertext back to original plaintext", () => {
      const original = "+8801712345678";
      const encrypted = piiCryptoService.encrypt(original);
      const decrypted = piiCryptoService.decrypt(encrypted);

      expect(decrypted).toBe(original);
    });

    it("should throw PiiCryptoException when ciphertext has been tampered with", () => {
      const original = "+8801712345678";
      const encrypted = piiCryptoService.encrypt(original);
      const parts = encrypted.split(":");

      // Tamper with encrypted payload
      const tampered = `${parts[0]}:${parts[1]}:ff${parts[2]?.slice(2)}`;

      expect(() => piiCryptoService.decrypt(tampered)).toThrow(
        PiiCryptoException
      );
    });

    it("should produce deterministic HMAC-SHA256 blind index for normalized phone numbers", () => {
      const phoneA = "+1 (555) 234-5678";
      const phoneB = "+15552345678";

      const hashA = piiCryptoService.hashPhone(phoneA);
      const hashB = piiCryptoService.hashPhone(phoneB);

      expect(hashA).toBe(hashB);
      expect(hashA).toHaveLength(64); // SHA256 hex string
    });
  });

  // =========================================================================
  // 2. MULTI-TENANT ISOLATION (TenantGuard)
  // =========================================================================
  describe("Multi-Tenant Data Isolation (TenantGuard)", () => {
    let guard: TenantGuard;
    let reflector: jest.Mocked<Reflector>;
    let farmMemberRepo: jest.Mocked<IFarmMemberRepository>;

    const validFarmId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
    const otherFarmId = "b1ffcd88-8b1a-4fe7-aa5c-5aa8ac271b22";

    beforeEach(() => {
      reflector = {
        getAllAndOverride: jest.fn(),
      } as any;

      farmMemberRepo = {
        findMembership: jest.fn(),
        findUserFarms: jest.fn(),
        findByFarmId: jest.fn(),
        countMembers: jest.fn(),
        create: jest.fn(),
      };

      guard = new TenantGuard(reflector, farmMemberRepo);
    });

    const createMockContext = (
      user?: JwtPayload,
      headers: Record<string, string> = {}
    ): ExecutionContext => {
      const request = {
        headers,
        user,
        params: {},
        query: {},
      };

      return {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: () => ({
          getRequest: () => request,
        }),
      } as unknown as ExecutionContext;
    };

    it("should allow request if route is marked @Public", async () => {
      reflector.getAllAndOverride.mockReturnValueOnce(true); // IS_PUBLIC_KEY
      const context = createMockContext();

      const canActivate = await guard.canActivate(context);
      expect(canActivate).toBe(true);
    });

    it("should reject request with 401 if user is unauthenticated", async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(undefined); // TENANT_OPTIONS_KEY

      const context = createMockContext(undefined, { "x-farm-id": validFarmId });

      await expect(guard.canActivate(context)).rejects.toThrow(
        UnauthorizedDomainException
      );
    });

    it("should reject request with 403 if user is not a member of the farm tenant", async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(undefined); // TENANT_OPTIONS_KEY

      farmMemberRepo.findMembership.mockResolvedValue(null);

      const user: JwtPayload = {
        sub: "user-123",
        email: "farmer@vetralink.pro",
        role: UserRole.FARMER,
        status: UserStatus.ACTIVE,
      };
      const context = createMockContext(user, { "x-farm-id": otherFarmId });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenOperationException
      );
    });

    it("should allow request if user is an active member of the farm tenant", async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(undefined) // TENANT_OPTIONS_KEY
        .mockReturnValueOnce(undefined); // FARM_ROLES_KEY

      farmMemberRepo.findMembership.mockResolvedValue(
        FarmMemberEntity.reconstitute({
          id: "member-1",
          farmId: validFarmId,
          userId: "user-123",
          role: FarmRole.OWNER,
          createdAt: new Date(),
        })
      );

      const user: JwtPayload = {
        sub: "user-123",
        email: "owner@vetralink.pro",
        role: UserRole.FARMER,
        status: UserStatus.ACTIVE,
      };
      const context = createMockContext(user, { "x-farm-id": validFarmId });

      const canActivate = await guard.canActivate(context);
      expect(canActivate).toBe(true);
    });

    it("should allow SUPER_ADMIN to inspect any farm without membership check", async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(undefined); // TENANT_OPTIONS_KEY

      const adminUser: JwtPayload = {
        sub: "admin-999",
        email: "superadmin@vetralink.pro",
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
      };
      const context = createMockContext(adminUser, { "x-farm-id": validFarmId });

      const canActivate = await guard.canActivate(context);
      expect(canActivate).toBe(true);
      expect(farmMemberRepo.findMembership).not.toHaveBeenCalled();
    });

    it("should reject invalid UUID farm identifiers with ValidationDomainException", async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(undefined); // TENANT_OPTIONS_KEY

      const user: JwtPayload = {
        sub: "user-123",
        email: "farmer@vetralink.pro",
        role: UserRole.FARMER,
        status: UserStatus.ACTIVE,
      };
      const context = createMockContext(user, { "x-farm-id": "invalid-farm-id" });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ValidationDomainException
      );
    });
  });

  // =========================================================================
  // 3. ROLE-BASED ACCESS CONTROL (RolesGuard)
  // =========================================================================
  describe("Role-Based Access Control (RolesGuard)", () => {
    let guard: RolesGuard;
    let reflector: jest.Mocked<Reflector>;

    beforeEach(() => {
      reflector = {
        getAllAndOverride: jest.fn(),
      } as any;

      guard = new RolesGuard(reflector);
    });

    const createMockContext = (user?: JwtPayload): ExecutionContext => {
      return {
        getHandler: jest.fn(),
        getClass: jest.fn(),
        switchToHttp: () => ({
          getRequest: () => ({ user }),
        }),
      } as unknown as ExecutionContext;
    };

    it("should allow access when endpoint has no @Roles decorator", () => {
      reflector.getAllAndOverride.mockReturnValue(undefined);
      const context = createMockContext();

      expect(guard.canActivate(context)).toBe(true);
    });

    it("should allow user possessing the required role", () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.VET, UserRole.ADMIN]);
      const user: JwtPayload = {
        sub: "vet-1",
        email: "vet@vetralink.pro",
        role: UserRole.VET,
        status: UserStatus.ACTIVE,
      };
      const context = createMockContext(user);

      expect(guard.canActivate(context)).toBe(true);
    });

    it("should reject user with insufficient role with 403 Forbidden", () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.VET]);
      const user: JwtPayload = {
        sub: "farmer-1",
        email: "farmer@vetralink.pro",
        role: UserRole.FARMER,
        status: UserStatus.ACTIVE,
      };
      const context = createMockContext(user);

      expect(() => guard.canActivate(context)).toThrow(
        ForbiddenOperationException
      );
    });

    it("should always allow SUPER_ADMIN even if role is not explicitly specified", () => {
      reflector.getAllAndOverride.mockReturnValue([UserRole.VET]);
      const admin: JwtPayload = {
        sub: "admin-1",
        email: "admin@vetralink.pro",
        role: UserRole.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
      };
      const context = createMockContext(admin);

      expect(guard.canActivate(context)).toBe(true);
    });
  });
});
