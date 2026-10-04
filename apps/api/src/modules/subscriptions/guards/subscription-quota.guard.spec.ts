import { ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { SubscriptionQuotaType, SubscriptionTier } from "@vetralink/shared-types";
import {
  CHECK_QUOTA_KEY,
  CheckQuotaOptions,
} from "../../../common/decorators/quota.decorator";
import { REQUIRE_FEATURE_KEY } from "../../../common/decorators/feature.decorator";
import {
  QuotaExceededDomainException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import { ISubscriptionQuotaService } from "../services/subscription-quota.service.interface";
import { SubscriptionQuotaGuard } from "./subscription-quota.guard";

describe("SubscriptionQuotaGuard", () => {
  let guard: SubscriptionQuotaGuard;
  let reflector: jest.Mocked<Reflector>;
  let quotaService: jest.Mocked<ISubscriptionQuotaService>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(undefined),
    } as unknown as jest.Mocked<Reflector>;

    quotaService = {
      checkQuota: jest.fn(),
      assertQuotaAvailable: jest.fn(),
      getFarmQuotaUsage: jest.fn(),
    };

    guard = new SubscriptionQuotaGuard(reflector, quotaService);
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

  it("should allow request if no @CheckQuota metadata is present", async () => {
    reflector.getAllAndOverride.mockReturnValue(undefined);
    const context = createMockContext({});

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(quotaService.assertQuotaAvailable).not.toHaveBeenCalled();
  });

  it("should throw ValidationDomainException if farmId cannot be resolved", async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === CHECK_QUOTA_KEY) {
        return {
          type: SubscriptionQuotaType.ANIMALS,
          increment: 1,
        } as CheckQuotaOptions;
      }
      return undefined;
    });

    const context = createMockContext({ headers: {} });

    await expect(guard.canActivate(context)).rejects.toThrow(
      ValidationDomainException,
    );
    expect(quotaService.assertQuotaAvailable).not.toHaveBeenCalled();
  });

  it("should resolve farmId from request.farmId and assert quota", async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === CHECK_QUOTA_KEY) {
        return {
          type: SubscriptionQuotaType.ANIMALS,
          increment: 1,
        } as CheckQuotaOptions;
      }
      return undefined;
    });

    quotaService.assertQuotaAvailable.mockResolvedValue({
      allowed: true,
      quotaType: SubscriptionQuotaType.ANIMALS,
      currentUsage: 3,
      limit: 5,
      remaining: 2,
      planTier: SubscriptionTier.STARTER,
      upgradeTier: SubscriptionTier.PRO,
    });

    const context = createMockContext({ farmId: "farm-uuid-1" });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(quotaService.assertQuotaAvailable).toHaveBeenCalledWith(
      "farm-uuid-1",
      SubscriptionQuotaType.ANIMALS,
      1,
    );
  });

  it("should resolve farmId from headers['x-farm-id']", async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === CHECK_QUOTA_KEY) {
        return {
          type: SubscriptionQuotaType.STAFF,
          increment: 1,
        } as CheckQuotaOptions;
      }
      return undefined;
    });

    quotaService.assertQuotaAvailable.mockResolvedValue({
      allowed: true,
      quotaType: SubscriptionQuotaType.STAFF,
      currentUsage: 1,
      limit: 3,
      remaining: 2,
      planTier: SubscriptionTier.PRO,
      upgradeTier: SubscriptionTier.ENTERPRISE,
    });

    const context = createMockContext({
      headers: { "x-farm-id": "farm-uuid-headers" },
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(quotaService.assertQuotaAvailable).toHaveBeenCalledWith(
      "farm-uuid-headers",
      SubscriptionQuotaType.STAFF,
      1,
    );
  });

  it("should resolve farmId from route params.farmId", async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === CHECK_QUOTA_KEY) {
        return {
          type: SubscriptionQuotaType.STAFF,
        } as CheckQuotaOptions;
      }
      return undefined;
    });

    quotaService.assertQuotaAvailable.mockResolvedValue({
      allowed: true,
      quotaType: SubscriptionQuotaType.STAFF,
      currentUsage: 0,
      limit: 1,
      remaining: 1,
      planTier: SubscriptionTier.STARTER,
      upgradeTier: SubscriptionTier.PRO,
    });

    const context = createMockContext({
      params: { farmId: "farm-uuid-param" },
    });

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
    expect(quotaService.assertQuotaAvailable).toHaveBeenCalledWith(
      "farm-uuid-param",
      SubscriptionQuotaType.STAFF,
      1,
    );
  });

  it("should propagate QuotaExceededDomainException when quota exceeded", async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === CHECK_QUOTA_KEY) {
        return {
          type: SubscriptionQuotaType.ANIMALS,
          increment: 1,
        } as CheckQuotaOptions;
      }
      return undefined;
    });

    quotaService.assertQuotaAvailable.mockRejectedValue(
      new QuotaExceededDomainException("Quota exceeded", {
        quotaType: SubscriptionQuotaType.ANIMALS,
        currentUsage: 5,
        limit: 5,
        planTier: SubscriptionTier.STARTER,
        upgradeTier: SubscriptionTier.PRO,
      }),
    );

    const context = createMockContext({ farmId: "farm-uuid-maxed" });

    await expect(guard.canActivate(context)).rejects.toThrow(
      QuotaExceededDomainException,
    );
  });

  it("should throw ForbiddenOperationException if required feature is not enabled on farm plan", async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === REQUIRE_FEATURE_KEY) {
        return "bulkImportExport";
      }
      return undefined;
    });

    quotaService.getFarmQuotaUsage.mockResolvedValue({
      farmId: "farm-starter",
      planTier: SubscriptionTier.STARTER,
      planName: "Starter",
      isSubscriptionActive: true,
      quotas: {} as any,
      features: {
        maxAnimals: 5,
        maxStaff: 1,
        bulkImportExport: false,
        advancedAnalytics: false,
        customReports: false,
        teleVetPriority: "STANDARD",
      },
    });

    const context = createMockContext({ farmId: "farm-starter" });

    await expect(guard.canActivate(context)).rejects.toThrow(
      "Feature 'bulkImportExport' is not included in your STARTER subscription plan.",
    );
  });

  it("should allow request when required feature is enabled on farm plan", async () => {
    reflector.getAllAndOverride.mockImplementation((key: string) => {
      if (key === REQUIRE_FEATURE_KEY) {
        return "bulkImportExport";
      }
      return undefined;
    });

    quotaService.getFarmQuotaUsage.mockResolvedValue({
      farmId: "farm-pro",
      planTier: SubscriptionTier.PRO,
      planName: "Pro Farmer",
      isSubscriptionActive: true,
      quotas: {} as any,
      features: {
        maxAnimals: 30,
        maxStaff: 3,
        bulkImportExport: true,
        advancedAnalytics: true,
        customReports: false,
        teleVetPriority: "EXPEDITED",
      },
    });

    const context = createMockContext({ farmId: "farm-pro" });

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });
});
