import { SetMetadata } from "@nestjs/common";
import { UserRole } from "@vetralink/shared-types";

export const ROLES_KEY = "roles";

/**
 * Decorator to specify required user roles for a controller class or handler method.
 *
 * @example
 * @Roles(UserRole.VET, UserRole.ADMIN)
 * @Get('clinical-records')
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
