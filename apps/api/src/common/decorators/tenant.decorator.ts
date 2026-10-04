import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from "@nestjs/common";
import { FarmRole } from "@vetralink/shared-types";
import { FarmMemberEntity } from "../../modules/farms/entities/farm-member.entity";

export const TENANT_OPTIONS_KEY = "tenantOptions";
export const FARM_ROLES_KEY = "farmRoles";

export interface TenantOptions {
  optional?: boolean;
}

/**
 * Decorator to declare that a controller or route handler requires a tenant (farm) context.
 *
 * @param options.optional - If true, the route will parse and validate the tenant if provided, but won't fail if absent.
 */
export const Tenant = (options?: TenantOptions) =>
  SetMetadata(TENANT_OPTIONS_KEY, options ?? { optional: false });

/**
 * Decorator to specify required farm-level member roles (OWNER, MANAGER, HERDSMAN, VET_STAFF).
 * OWNER automatically inherits all permissions.
 *
 * @example
 * @FarmRoles(FarmRole.OWNER, FarmRole.MANAGER)
 * @Post('members/invite')
 */
export const FarmRoles = (...roles: FarmRole[]) =>
  SetMetadata(FARM_ROLES_KEY, roles);

/**
 * Parameter decorator to inject the validated farmId or FarmMemberEntity.
 *
 * @example
 * @Get()
 * getAnimals(@CurrentFarm('id') farmId: string) { ... }
 *
 * @example
 * @Post()
 * logMilk(@CurrentFarm('member') member: FarmMemberEntity) { ... }
 */
export const CurrentFarm = createParamDecorator(
  (data: "id" | "member" | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    if (data === "id") return request.farmId;
    if (data === "member") return request.farmMember as FarmMemberEntity | undefined;
    return {
      id: request.farmId,
      member: request.farmMember as FarmMemberEntity | undefined,
    };
  }
);
