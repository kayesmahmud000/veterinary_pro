import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { FarmRole, JwtPayload, UserRole, UserStatus } from "@vetralink/shared-types";
import { TenantGuard } from "./tenant.guard";
import { IFarmMemberRepository } from "../../modules/farms/repositories/farm-member.repository.interface";
import { FarmMemberEntity } from "../../modules/farms/entities/farm-member.entity";
import {
  ForbiddenOperationException,
  UnauthorizedDomainException,
  ValidationDomainException,
} from "../exceptions/domain.exception";

describe("TenantGuard", () => {
  let guard: TenantGuard;
  let reflector: jest.Mocked<Reflector>;
  let farmMemberRepository: jest.Mocked<IFarmMemberRepository>;

  const validFarmId = "11111111-1111-1111-1111-111111111111";
  const mockUser: JwtPayload = {
    sub: "22222222-2222-2222-2222-222222222222",
    email: "farmer@example.com",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const mockMembership = FarmMemberEntity.create({
    id: "33333333-3333-3333-3333-333333333333",
    farmId: validFarmId,
    userId: mockUser.sub,
    role: FarmRole.HERDSMAN,
  });

  const createMockContext = (
    options: {
      headers?: Record<string, string>;
      params?: Record<string, string>;
      query?: Record<string, string>;
      user?: JwtPayload | null;
    } = {}
  ): { context: ExecutionContext; request: any } => {
    const request = {
      headers: options.headers ?? {},
      params: options.params ?? {},
      query: options.query ?? {},
      user: options.user === null ? undefined : (options.user ?? mockUser),
      farmId: undefined,
      farmMember: undefined,
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    return { context, request };
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    farmMemberRepository = {
      findMembership: jest.fn(),
      findUserFarms: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<IFarmMemberRepository>;

    guard = new TenantGuard(reflector, farmMemberRepository);
  });

  it("should bypass public routes", async () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === "isPublic") return true;
      return undefined;
    });

    const { context } = createMockContext();
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(farmMemberRepository.findMembership).not.toHaveBeenCalled();
  });

  it("should throw ValidationDomainException when farmId is missing on required tenant route", async () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === "isPublic") return false;
      if (key === "tenantOptions") return { optional: false };
      return undefined;
    });

    const { context } = createMockContext({ headers: {} });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ValidationDomainException
    );
  });

  it("should pass when farmId is missing on optional tenant route", async () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === "isPublic") return false;
      if (key === "tenantOptions") return { optional: true };
      return undefined;
    });

    const { context } = createMockContext({ headers: {} });
    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  it("should throw ValidationDomainException when farmId is not a valid UUID", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const { context } = createMockContext({
      headers: { "x-farm-id": "invalid-uuid" },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ValidationDomainException
    );
  });

  it("should throw UnauthorizedDomainException when request.user is missing", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const { context } = createMockContext({
      headers: { "x-farm-id": validFarmId },
      user: null,
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedDomainException
    );
  });

  it("should allow SUPER_ADMIN bypass without membership lookup", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    const { context, request } = createMockContext({
      headers: { "x-farm-id": validFarmId },
      user: { ...mockUser, role: UserRole.SUPER_ADMIN },
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.farmId).toBe(validFarmId);
    expect(farmMemberRepository.findMembership).not.toHaveBeenCalled();
  });

  it("should throw ForbiddenOperationException when user is not a member of the farm", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    farmMemberRepository.findMembership.mockResolvedValueOnce(null);

    const { context } = createMockContext({
      headers: { "x-farm-id": validFarmId },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenOperationException
    );
  });

  it("should resolve membership from x-tenant-id header", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    farmMemberRepository.findMembership.mockResolvedValueOnce(mockMembership);

    const { context, request } = createMockContext({
      headers: { "x-tenant-id": validFarmId },
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.farmId).toBe(validFarmId);
    expect(request.farmMember).toEqual(mockMembership);
  });

  it("should resolve membership from route params :farmId", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    farmMemberRepository.findMembership.mockResolvedValueOnce(mockMembership);

    const { context, request } = createMockContext({
      params: { farmId: validFarmId },
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(request.farmId).toBe(validFarmId);
  });

  it("should allow access when farm member role matches required farmRoles", async () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === "farmRoles") return [FarmRole.HERDSMAN, FarmRole.MANAGER];
      return undefined;
    });

    farmMemberRepository.findMembership.mockResolvedValueOnce(mockMembership);

    const { context } = createMockContext({
      headers: { "x-farm-id": validFarmId },
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it("should allow OWNER to satisfy any farm role requirement", async () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === "farmRoles") return [FarmRole.VET_STAFF];
      return undefined;
    });

    const ownerMembership = FarmMemberEntity.create({
      farmId: validFarmId,
      userId: mockUser.sub,
      role: FarmRole.OWNER,
    });
    farmMemberRepository.findMembership.mockResolvedValueOnce(ownerMembership);

    const { context } = createMockContext({
      headers: { "x-farm-id": validFarmId },
    });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it("should throw ForbiddenOperationException when farm role is insufficient", async () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === "farmRoles") return [FarmRole.OWNER, FarmRole.MANAGER];
      return undefined;
    });

    // mockMembership has HERDSMAN role
    farmMemberRepository.findMembership.mockResolvedValueOnce(mockMembership);

    const { context } = createMockContext({
      headers: { "x-farm-id": validFarmId },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenOperationException
    );
  });
});
