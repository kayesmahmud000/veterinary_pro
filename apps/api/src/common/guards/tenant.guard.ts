import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { FarmRole, JwtPayload, UserRole } from "@vetralink/shared-types";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import {
  FARM_ROLES_KEY,
  TENANT_OPTIONS_KEY,
  TenantOptions,
} from "../decorators/tenant.decorator";
import {
  FARM_MEMBER_REPOSITORY,
  IFarmMemberRepository,
} from "../../modules/farms/repositories/farm-member.repository.interface";
import {
  ForbiddenOperationException,
  UnauthorizedDomainException,
  ValidationDomainException,
} from "../exceptions/domain.exception";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(FARM_MEMBER_REPOSITORY)
    private readonly farmMemberRepository: IFarmMemberRepository
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const tenantOptions = this.reflector.getAllAndOverride<TenantOptions>(
      TENANT_OPTIONS_KEY,
      [context.getHandler(), context.getClass()]
    );

    const request = context.switchToHttp().getRequest();
    const farmId = this.resolveFarmId(request);

    if (!farmId) {
      if (tenantOptions && !tenantOptions.optional) {
        throw new ValidationDomainException(
          "Farm tenant identifier is required. Provide 'x-farm-id' header or 'farmId' parameter."
        );
      }
      return true;
    }

    if (!UUID_REGEX.test(farmId)) {
      throw new ValidationDomainException(
        "Invalid farm tenant identifier format. Expected UUID."
      );
    }

    const user: JwtPayload | undefined = request.user;
    if (!user) {
      throw new UnauthorizedDomainException(
        "Authentication is required to access farm tenants."
      );
    }

    // Platform SUPER_ADMIN has global tenant inspection bypass
    if (user.role === UserRole.SUPER_ADMIN) {
      request.farmId = farmId;
      return true;
    }

    const membership = await this.farmMemberRepository.findMembership(
      farmId,
      user.sub
    );

    if (!membership) {
      throw new ForbiddenOperationException(
        "Access denied: You are not a member of this farm tenant."
      );
    }

    const requiredFarmRoles = this.reflector.getAllAndOverride<FarmRole[]>(
      FARM_ROLES_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (requiredFarmRoles && requiredFarmRoles.length > 0) {
      const hasPermission =
        membership.isOwner() || requiredFarmRoles.includes(membership.role);

      if (!hasPermission) {
        throw new ForbiddenOperationException(
          `Insufficient farm permissions. Required: [${requiredFarmRoles.join(", ")}], Provided: '${membership.role}'`
        );
      }
    }

    request.farmId = farmId;
    request.farmMember = membership;

    return true;
  }

  private resolveFarmId(request: any): string | null {
    // 1. Headers (x-farm-id or x-tenant-id)
    const headerId =
      request.headers?.["x-farm-id"] ??
      request.headers?.["x-tenant-id"] ??
      request.headers?.["X-Farm-Id"] ??
      request.headers?.["X-Tenant-Id"];

    if (headerId && typeof headerId === "string" && headerId.trim().length > 0) {
      return headerId.trim();
    }

    // 2. Route params (:farmId)
    if (
      request.params?.farmId &&
      typeof request.params.farmId === "string" &&
      request.params.farmId.trim().length > 0
    ) {
      return request.params.farmId.trim();
    }

    // 3. Query params (?farmId=)
    if (
      request.query?.farmId &&
      typeof request.query.farmId === "string" &&
      request.query.farmId.trim().length > 0
    ) {
      return request.query.farmId.trim();
    }

    // 4. Fallback to activeFarmId claim in JWT
    if (request.user?.activeFarmId) {
      return request.user.activeFarmId;
    }

    return null;
  }
}
