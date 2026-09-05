import { AuthTokensDto } from "./auth-tokens.dto.js";

/**
 * Refresh token request payload for rotating session tokens.
 */
export interface RefreshTokenRequestDto {
  readonly refreshToken: string;
}

/**
 * Response payload containing newly rotated access and refresh token pair.
 */
export interface RefreshTokenResponseDto {
  readonly tokens: AuthTokensDto;
}
