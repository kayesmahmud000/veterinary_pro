import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { JwtPayload } from "@vetralink/shared-types";

/**
 * Parameter decorator to extract the authenticated user's JWT payload from request.user.
 *
 * @example
 * @Get('me')
 * getProfile(@CurrentUser() user: JwtPayload) { ... }
 *
 * @example
 * @Get('my-id')
 * getId(@CurrentUser('sub') userId: string) { ... }
 */
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: JwtPayload | undefined = request.user;
    return data && user ? user[data] : user;
  }
);
