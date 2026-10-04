import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtPayload, UserRole, UserStatus } from "@vetralink/shared-types";
import { RolesGuard } from "./roles.guard";
import {
  ForbiddenOperationException,
  UnauthorizedDomainException,
} from "../exceptions/domain.exception";

describe("RolesGuard", () => {
  let guard: RolesGuard;
  let reflector: jest.Mocked<Reflector>;

  const createMockContext = (
    user?: Partial<JwtPayload>
  ): { context: ExecutionContext } => {
    const request = {
      user: user
        ? {
            sub: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
            email: "test@example.com",
            role: UserRole.FARMER,
            status: UserStatus.ACTIVE,
            ...user,
          }
        : undefined,
    };

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as ExecutionContext;

    return { context };
  };

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new RolesGuard(reflector);
  });

  it("should allow public routes without checking roles", () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === "isPublic") return true;
      return [UserRole.ADMIN];
    });

    const { context } = createMockContext();
    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it("should allow access when no roles are required", () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === "isPublic") return false;
      if (key === "roles") return undefined;
      return undefined;
    });

    const { context } = createMockContext({ role: UserRole.FARMER });
    const result = guard.canActivate(context);

    expect(result).toBe(true);
  });

  it("should throw UnauthorizedDomainException when request.user is missing", () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === "isPublic") return false;
      if (key === "roles") return [UserRole.VET];
      return undefined;
    });

    const { context } = createMockContext(undefined);

    expect(() => guard.canActivate(context)).toThrow(
      UnauthorizedDomainException
    );
  });

  it("should throw ForbiddenOperationException when user account is suspended", () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === "isPublic") return false;
      if (key === "roles") return [UserRole.VET];
      return undefined;
    });

    const { context } = createMockContext({
      role: UserRole.VET,
      status: UserStatus.SUSPENDED,
    });

    expect(() => guard.canActivate(context)).toThrow(
      ForbiddenOperationException
    );
  });

  it("should grant bypass to SUPER_ADMIN regardless of required roles", () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === "isPublic") return false;
      if (key === "roles") return [UserRole.VET];
      return undefined;
    });

    const { context } = createMockContext({
      role: UserRole.SUPER_ADMIN,
    });

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it("should allow access when user possesses one of the required roles", () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === "isPublic") return false;
      if (key === "roles") return [UserRole.VET, UserRole.ADMIN];
      return undefined;
    });

    const { context } = createMockContext({
      role: UserRole.VET,
    });

    const result = guard.canActivate(context);
    expect(result).toBe(true);
  });

  it("should throw ForbiddenOperationException when user role is insufficient", () => {
    reflector.getAllAndOverride.mockImplementation((key) => {
      if (key === "isPublic") return false;
      if (key === "roles") return [UserRole.VET, UserRole.ADMIN];
      return undefined;
    });

    const { context } = createMockContext({
      role: UserRole.FARMER,
    });

    expect(() => guard.canActivate(context)).toThrow(
      ForbiddenOperationException
    );
  });
});
