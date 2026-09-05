import {
  CanActivate,
  ExecutionContext,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtPayload, UserRole, UserStatus } from "@vetralink/shared-types";
import { ROLES_KEY } from "../decorators/roles.decorator";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import {
  ForbiddenOperationException,
  UnauthorizedDomainException,
} from "../exceptions/domain.exception";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  public canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: JwtPayload | undefined = request.user;

    if (!user) {
      throw new UnauthorizedDomainException(
        "Authentication is required to access this resource."
      );
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw new ForbiddenOperationException("Account has been suspended.");
    }

    // SUPER_ADMIN has platform-wide superuser bypass
    if (user.role === UserRole.SUPER_ADMIN) {
      return true;
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenOperationException(
        `Insufficient role permissions. Required: [${requiredRoles.join(", ")}], Provided: '${user.role}'`
      );
    }

    return true;
  }
}
