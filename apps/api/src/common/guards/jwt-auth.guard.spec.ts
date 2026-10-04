import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole, UserStatus } from "@vetralink/shared-types";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { ITokenService } from "../../modules/auth/services/token.service.interface";
import { UnauthorizedDomainException } from "../exceptions/domain.exception";

describe("JwtAuthGuard", () => {
  let guard: JwtAuthGuard;
  let reflector: jest.Mocked<Reflector>;
  let tokenService: jest.Mocked<ITokenService>;

  const mockPayload = {
    sub: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    email: "user@example.com",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const createMockContext = (
    headers: Record<string, string> = {}
  ): { context: ExecutionContext; request: any } => {
    const request = {
      headers,
      user: undefined,
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

    tokenService = {
      verifyAccessToken: jest.fn(),
    } as unknown as jest.Mocked<ITokenService>;

    guard = new JwtAuthGuard(reflector, tokenService);
  });

  it("should allow public routes without token validation", async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const { context } = createMockContext();

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(tokenService.verifyAccessToken).not.toHaveBeenCalled();
  });

  it("should throw UnauthorizedDomainException when Authorization header is missing", async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const { context } = createMockContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedDomainException
    );
  });

  it("should throw UnauthorizedDomainException when Authorization format is invalid", async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    const { context } = createMockContext({
      authorization: "Basic invalid_token",
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedDomainException
    );
  });

  it("should verify token and attach payload to request.user", async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    tokenService.verifyAccessToken.mockResolvedValueOnce(mockPayload);

    const { context, request } = createMockContext({
      authorization: "Bearer valid.jwt.token",
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(tokenService.verifyAccessToken).toHaveBeenCalledWith(
      "valid.jwt.token"
    );
    expect(request.user).toEqual(mockPayload);
  });

  it("should throw UnauthorizedDomainException when token verification fails", async () => {
    reflector.getAllAndOverride.mockReturnValue(false);
    tokenService.verifyAccessToken.mockRejectedValueOnce(
      new UnauthorizedDomainException("Invalid token")
    );

    const { context } = createMockContext({
      authorization: "Bearer expired.jwt.token",
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      UnauthorizedDomainException
    );
  });
});
