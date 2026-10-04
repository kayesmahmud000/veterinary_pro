import { Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as crypto from "crypto";
import {
  AuthTokensDto,
  JwtPayload,
} from "@vetralink/shared-types";
import { EnvService } from "../../../config/env.service";
import {
  GenerateTokensParams,
  ITokenService,
} from "./token.service.interface";
import { UnauthorizedDomainException } from "../../../common/exceptions/domain.exception";

@Injectable()
export class TokenService implements ITokenService {
  private readonly logger = new Logger(TokenService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly envService: EnvService
  ) {}

  public async generateTokens(
    params: GenerateTokensParams
  ): Promise<AuthTokensDto> {
    const jti = crypto.randomUUID();
    const payload: JwtPayload = {
      sub: params.userId,
      email: params.email,
      role: params.role,
      status: params.status,
      ...(params.activeFarmId ? { activeFarmId: params.activeFarmId } : {}),
      jti,
    };

    const accessToken = await this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken();
    const expiresIn = this.parseDurationToSeconds(
      this.envService.jwtAccessExpiration
    );

    return {
      accessToken,
      refreshToken,
      tokenType: "Bearer",
      expiresIn,
    };
  }

  public async generateAccessToken(payload: JwtPayload): Promise<string> {
    return this.jwtService.signAsync(payload as unknown as Record<string, unknown>, {
      secret: this.envService.jwtAccessSecret,
      expiresIn: this.envService.jwtAccessExpiration,
    });
  }

  public generateRefreshToken(): string {
    // 40 bytes = 320 bits of cryptographic entropy
    return crypto.randomBytes(40).toString("hex");
  }

  public hashRefreshToken(refreshToken: string): string {
    return crypto
      .createHash("sha256")
      .update(refreshToken, "utf8")
      .digest("hex");
  }

  public async verifyAccessToken(token: string): Promise<JwtPayload> {
    try {
      const decoded = await this.jwtService.verifyAsync<JwtPayload>(token, {
        secret: this.envService.jwtAccessSecret,
      });
      return decoded;
    } catch (error) {
      this.logger.debug(
        `JWT verification failed: ${(error as Error).message}`
      );
      throw new UnauthorizedDomainException("Invalid or expired access token.");
    }
  }

  public getRefreshTokenExpiresAt(): Date {
    const durationMs = this.parseDurationToMs(
      this.envService.jwtRefreshExpiration
    );
    return new Date(Date.now() + durationMs);
  }

  private parseDurationToSeconds(duration: string): number {
    return Math.floor(this.parseDurationToMs(duration) / 1000);
  }

  private parseDurationToMs(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) {
      const num = parseInt(duration, 10);
      return isNaN(num) ? 900 * 1000 : num * 1000;
    }

    const value = parseInt(match[1] ?? "0", 10);
    const unit = match[2];

    switch (unit) {
      case "s":
        return value * 1000;
      case "m":
        return value * 60 * 1000;
      case "h":
        return value * 60 * 60 * 1000;
      case "d":
        return value * 24 * 60 * 60 * 1000;
      default:
        return 900 * 1000;
    }
  }
}
