import {
  CanActivate,
  ExecutionContext,
  Inject,
  Injectable,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "../decorators/public.decorator";
import {
  ITokenService,
  TOKEN_SERVICE,
} from "../../modules/auth/services/token.service.interface";
import { UnauthorizedDomainException } from "../exceptions/domain.exception";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(TOKEN_SERVICE)
    private readonly tokenService: ITokenService
  ) {}

  public async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const authHeader =
      request.headers["authorization"] ?? request.headers["Authorization"];

    if (!authHeader || typeof authHeader !== "string") {
      throw new UnauthorizedDomainException("Missing Authorization header.");
    }

    const parts = authHeader.trim().split(" ");
    if (parts.length !== 2 || parts[0] !== "Bearer" || !parts[1]) {
      throw new UnauthorizedDomainException(
        "Invalid Authorization header format. Expected 'Bearer <token>'."
      );
    }

    const token = parts[1];
    const payload = await this.tokenService.verifyAccessToken(token);

    request.user = payload;
    return true;
  }
}
