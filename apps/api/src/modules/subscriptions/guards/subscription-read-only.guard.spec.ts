import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  ALLOW_READ_ONLY_KEY,
  REQUIRE_WRITE_ACCESS_KEY,
} from "../../../common/decorators/subscription-access.decorator";
import {
  SubscriptionReadOnlyException,
  SubscriptionSuspendedException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import { ISubscriptionGracePeriodService } from "../services/subscription-grace-period.service.interface";
import { SubscriptionReadOnlyGuard } from "./subscription-read-only.guard";

describe("SubscriptionReadOnlyGuard", () => {
  let guard: SubscriptionReadOnlyGuard;
  let reflector: jest.Mocked<Reflector>;
  let gracePeriodService: jest.Mocked<ISubscriptionGracePeriodService>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as jest.Mocked<Reflector>;

    gracePeriodService = {
      getAccessStatus: jest.fn(),
      assertWriteAccess: jest.fn(),
      assertReadAccess: jest.fn(),
      processSuspensions: jest.fn(),
    };

    guard = new SubscriptionReadOnlyGuard(reflector, gracePeriodService);
  });

  const createMockContext = (request: Record<string, unknown>): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: jest.fn(),
        getNext: jest.fn(),
      }),
      getHandler: () => jest.fn(),
      getClass: () => jest.fn(),
      getArgs: jest.fn(),
      getArgByIndex: jest.fn(),
      switchToRpc: jest.fn(),
      switchToWs: jest.fn(),
      getType: jest.fn(),
    } as unknown as ExecutionContext;
  };

  it("should pass through when no farmId is present and requireWriteAccess is not set", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = createMockContext({ method: "POST", headers: {} });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(gracePeriodService.assertWriteAccess).not.toHaveBeenCalled();
    expect(gracePeriodService.assertReadAccess).not.toHaveBeenCalled();
  });

  it("should throw ValidationDomainException when farmId is missing and @RequireWriteAccess is present", async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === REQUIRE_WRITE_ACCESS_KEY) {
        return true;
      }
      return undefined;
    });

    const context = createMockContext({ method: "GET", headers: {} });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ValidationDomainException,
    );
    expect(gracePeriodService.assertWriteAccess).not.toHaveBeenCalled();
  });

  it("should assert read access for non-mutating GET requests", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = createMockContext({
      method: "GET",
      farmId: "farm-uuid-1",
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(gracePeriodService.assertReadAccess).toHaveBeenCalledWith("farm-uuid-1");
    expect(gracePeriodService.assertWriteAccess).not.toHaveBeenCalled();
  });

  it("should assert write access for mutating POST requests", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = createMockContext({
      method: "POST",
      headers: { "x-farm-id": "farm-uuid-headers" },
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(gracePeriodService.assertWriteAccess).toHaveBeenCalledWith(
      "farm-uuid-headers",
    );
    expect(gracePeriodService.assertReadAccess).not.toHaveBeenCalled();
  });

  it("should assert write access for mutating PUT, PATCH, DELETE requests", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);

    for (const method of ["PUT", "PATCH", "DELETE"]) {
      const context = createMockContext({
        method,
        params: { farmId: "farm-uuid-param" },
      });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
      expect(gracePeriodService.assertWriteAccess).toHaveBeenCalledWith(
        "farm-uuid-param",
      );
    }
  });

  it("should assert write access when @RequireWriteAccess is set on a GET request", async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === REQUIRE_WRITE_ACCESS_KEY) {
        return true;
      }
      return undefined;
    });

    const context = createMockContext({
      method: "GET",
      query: { farmId: "farm-uuid-query" },
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(gracePeriodService.assertWriteAccess).toHaveBeenCalledWith(
      "farm-uuid-query",
    );
  });

  it("should allow mutating requests if @AllowReadOnly is set, but still assert read access", async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === ALLOW_READ_ONLY_KEY) {
        return true;
      }
      return undefined;
    });

    const context = createMockContext({
      method: "POST",
      body: { farmId: "farm-uuid-body" },
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(gracePeriodService.assertReadAccess).toHaveBeenCalledWith(
      "farm-uuid-body",
    );
    expect(gracePeriodService.assertWriteAccess).not.toHaveBeenCalled();
  });

  it("should resolve farmId from user.activeFarmId fallback", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = createMockContext({
      method: "GET",
      user: { activeFarmId: "farm-uuid-jwt" },
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(gracePeriodService.assertReadAccess).toHaveBeenCalledWith(
      "farm-uuid-jwt",
    );
  });

  it("should propagate SubscriptionReadOnlyException when write access is blocked", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    gracePeriodService.assertWriteAccess.mockRejectedValue(
      new SubscriptionReadOnlyException(
        "Account is in read-only mode due to overdue payment (past due day 5). Mutations are restricted.",
        {
          subscriptionId: "sub-readonly",
          accessMode: "READ_ONLY",
          daysPastDue: 5,
        },
      ),
    );

    const context = createMockContext({
      method: "POST",
      farmId: "farm-uuid-readonly",
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      SubscriptionReadOnlyException,
    );
  });

  it("should propagate SubscriptionSuspendedException when account is suspended", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    gracePeriodService.assertReadAccess.mockRejectedValue(
      new SubscriptionSuspendedException(
        "Account has been suspended due to overdue payment past 7 days. Please contact support or settle your invoice.",
        {
          subscriptionId: "sub-suspended",
          accessMode: "SUSPENDED",
          daysPastDue: 8,
        },
      ),
    );

    const context = createMockContext({
      method: "GET",
      farmId: "farm-uuid-suspended",
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      SubscriptionSuspendedException,
    );
  });
});
