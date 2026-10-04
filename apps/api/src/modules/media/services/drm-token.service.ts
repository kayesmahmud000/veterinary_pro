import { Injectable, Logger } from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import * as crypto from "node:crypto";
import { DrmTokenPayload } from "@vetralink/shared-types";
import { EnvService } from "../../../config/env.service";
import { UnauthorizedDomainException } from "../../../common/exceptions/domain.exception";
import {
  GeneratePlaybackTokenResult,
  IDrmTokenService,
} from "./drm-token.service.interface";

@Injectable()
export class DrmTokenService implements IDrmTokenService {
  private readonly logger = new Logger(DrmTokenService.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly envService: EnvService
  ) {}

  public async generatePlaybackToken(
    userId: string,
    productId: string,
    role: string
  ): Promise<GeneratePlaybackTokenResult> {
    const expiresInSeconds = this.envService.drmTokenExpirationSeconds;
    const jti = crypto.randomUUID();
    const nowSeconds = Math.floor(Date.now() / 1000);

    const payload: Omit<DrmTokenPayload, "iat" | "exp"> = {
      sub: userId,
      pid: productId,
      role,
      jti,
    };

    const token = await this.jwtService.signAsync(
      payload as unknown as Record<string, unknown>,
      {
        secret: this.envService.hlsDrmKeySecret,
        expiresIn: expiresInSeconds,
      }
    );

    const expiresAt = new Date((nowSeconds + expiresInSeconds) * 1000);

    return {
      token,
      expiresAt,
      expiresInSeconds,
    };
  }

  public async verifyPlaybackToken(token: string): Promise<DrmTokenPayload> {
    if (!token || typeof token !== "string") {
      throw new UnauthorizedDomainException("DRM playback token is missing or malformed.");
    }

    try {
      const decoded = await this.jwtService.verifyAsync<DrmTokenPayload>(token, {
        secret: this.envService.hlsDrmKeySecret,
      });

      if (!decoded || !decoded.sub || !decoded.pid) {
        throw new UnauthorizedDomainException(
          "Malformed DRM playback token payload: missing required claims."
        );
      }

      return decoded;
    } catch (error: any) {
      if (error instanceof UnauthorizedDomainException) {
        throw error;
      }
      this.logger.warn(`Failed to verify DRM playback token: ${error.message}`);
      throw new UnauthorizedDomainException(
        `Invalid or expired DRM playback token: ${error.message}`
      );
    }
  }
}
