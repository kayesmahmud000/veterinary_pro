import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
  Logger,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  ALLOW_READ_ONLY_KEY,
  REQUIRE_WRITE_ACCESS_KEY,
} from "../../../common/decorators/subscription-access.decorator";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import {
  ISubscriptionGracePeriodService,
  SUBSCRIPTION_GRACE_PERIOD_SERVICE,
} from "../services/subscription-grace-period.service.interface";

@Injectable()
export class SubscriptionReadOnlyGuard implements CanActivate {
  private readonly logger = new Logger(SubscriptionReadOnlyGuard.name);

  constructor(
    private readonly reflector: Reflector,
    @Inject(SUBSCRIPTION_GRACE_PERIOD_SERVICE)
    private readonly gracePeriodService: ISubscriptionGracePeriodService,
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowReadOnly = this.reflector.getAllAndOverride<boolean | undefined>(
      ALLOW_READ_ONLY_KEY,
      [context.getHandler(), context.getClass()],
    );

    const requireWriteAccess = this.reflector.getAllAndOverride<
      boolean | undefined
    >(REQUIRE_WRITE_ACCESS_KEY, [context.getHandler(), context.getClass()]);

    const request = context.switchToHttp().getRequest();
    const farmId = this.resolveFarmId(request);

    if (!farmId) {
      if (requireWriteAccess) {
        throw new ValidationDomainException(
          "Farm tenant identifier is required for subscription access verification.",
        );
      }
      return true;
    }

    if (allowReadOnly) {
      // Routes marked with @AllowReadOnly bypass write restrictions in READ_ONLY mode,
      // but suspended accounts are strictly blocked from all operations.
      await this.gracePeriodService.assertReadAccess(farmId);
      return true;
    }

    const method = (request.method || "").toUpperCase();
    const isMutatingMethod = ["POST", "PUT", "PATCH", "DELETE"].includes(method);

    if (requireWriteAccess || isMutatingMethod) {
      await this.gracePeriodService.assertWriteAccess(farmId);
    } else {
      await this.gracePeriodService.assertReadAccess(farmId);
    }

    return true;
  }

  private resolveFarmId(request: Record<string, unknown>): string | undefined {
    if (typeof request["farmId"] === "string" && request["farmId"].trim().length > 0) {
      return (request["farmId"] as string).trim();
    }

    const headers = request["headers"] as
      | Record<string, string | string[] | undefined>
      | undefined;
    const headerId =
      headers?.["x-farm-id"] ??
      headers?.["x-tenant-id"] ??
      headers?.["X-Farm-Id"] ??
      headers?.["X-Tenant-Id"];

    if (typeof headerId === "string" && headerId.trim().length > 0) {
      return headerId.trim();
    }

    const params = request["params"] as Record<string, string> | undefined;
    if (typeof params?.["farmId"] === "string" && params["farmId"].trim().length > 0) {
      return params["farmId"].trim();
    }

    const query = request["query"] as Record<string, string> | undefined;
    if (typeof query?.["farmId"] === "string" && query["farmId"].trim().length > 0) {
      return query["farmId"].trim();
    }

    const body = request["body"] as Record<string, unknown> | undefined;
    if (typeof body?.["farmId"] === "string" && (body["farmId"] as string).trim().length > 0) {
      return (body["farmId"] as string).trim();
    }

    const user = request["user"] as Record<string, unknown> | undefined;
    if (
      typeof user?.["activeFarmId"] === "string" &&
      (user["activeFarmId"] as string).trim().length > 0
    ) {
      return (user["activeFarmId"] as string).trim();
    }

    return undefined;
  }
}
