import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  CHECK_QUOTA_KEY,
  CheckQuotaOptions,
} from "../../../common/decorators/quota.decorator";
import { REQUIRE_FEATURE_KEY } from "../../../common/decorators/feature.decorator";
import {
  ForbiddenOperationException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import {
  ISubscriptionQuotaService,
  SUBSCRIPTION_QUOTA_SERVICE,
} from "../services/subscription-quota.service.interface";

@Injectable()
export class SubscriptionQuotaGuard implements CanActivate {
  private readonly logger = new Logger(SubscriptionQuotaGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(SUBSCRIPTION_QUOTA_SERVICE)
    private readonly quotaService: ISubscriptionQuotaService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const quotaOptions = this.reflector.getAllAndOverride<
      CheckQuotaOptions | undefined
    >(CHECK_QUOTA_KEY, [context.getHandler(), context.getClass()]);

    const requiredFeature = this.reflector.getAllAndOverride<
      string | undefined
    >(REQUIRE_FEATURE_KEY, [context.getHandler(), context.getClass()]);

    // If neither quota checking nor feature requirement is declared, pass through
    if (!quotaOptions && !requiredFeature) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const farmId = this.resolveFarmId(request);

    if (!farmId) {
      throw new ValidationDomainException(
        "Farm tenant identifier is required for subscription quota verification. Provide 'x-farm-id' header or 'farmId' parameter.",
      );
    }

    if (
      typeof requiredFeature === "string" &&
      requiredFeature.trim().length > 0
    ) {
      const quotaSummary = await this.quotaService.getFarmQuotaUsage(farmId);
      const featureMap = quotaSummary.features as Record<string, unknown>;
      const hasFeature = Boolean(featureMap[requiredFeature]);

      if (!hasFeature) {
        this.logger.warn(
          `Feature '${requiredFeature}' blocked for farm '${farmId}' on tier [${quotaSummary.planTier}].`,
        );
        throw new ForbiddenOperationException(
          `Feature '${requiredFeature}' is not included in your ${quotaSummary.planTier} subscription plan. Please upgrade your subscription to access this feature.`,
        );
      }
    }

    if (quotaOptions) {
      await this.quotaService.assertQuotaAvailable(
        farmId,
        quotaOptions.type,
        quotaOptions.increment ?? 1,
      );
    }

    return true;
  }

  private resolveFarmId(request: Record<string, unknown>): string | undefined {
    if (typeof request["farmId"] === "string") {
      return request["farmId"];
    }

    const headers = request["headers"] as
      | Record<string, string | string[] | undefined>
      | undefined;
    const headerFarmId = headers?.["x-farm-id"];
    if (typeof headerFarmId === "string") {
      return headerFarmId;
    }

    const params = request["params"] as Record<string, string> | undefined;
    if (typeof params?.["farmId"] === "string") {
      return params["farmId"];
    }

    const body = request["body"] as Record<string, unknown> | undefined;
    if (typeof body?.["farmId"] === "string") {
      return body["farmId"];
    }

    const query = request["query"] as Record<string, string> | undefined;
    if (typeof query?.["farmId"] === "string") {
      return query["farmId"];
    }

    return undefined;
  }
}
