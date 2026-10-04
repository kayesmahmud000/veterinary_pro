import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { ClientMetadata } from "../../modules/auth/services/auth.service.interface";

/**
 * Extracts client metadata (IP address and User-Agent) from the incoming HTTP request.
 * Handles reverse proxy forwarding headers (`x-forwarded-for`).
 *
 * @example
 * @Post('login')
 * login(@Body() dto: LoginDto, @ClientMeta() meta: ClientMetadata) { ... }
 */
export const ClientMeta = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ClientMetadata => {
    const request = ctx.switchToHttp().getRequest();
    const forwardedFor = request.headers?.["x-forwarded-for"];
    let ipAddress: string | undefined;

    if (typeof forwardedFor === "string") {
      ipAddress = forwardedFor.split(",")[0]?.trim();
    } else if (Array.isArray(forwardedFor)) {
      ipAddress = forwardedFor[0]?.trim();
    } else {
      ipAddress = request.ip || request.socket?.remoteAddress;
    }

    const userAgentHeader = request.headers?.["user-agent"];
    const userAgent =
      typeof userAgentHeader === "string" ? userAgentHeader : undefined;

    return {
      ipAddress,
      userAgent,
    };
  }
);
