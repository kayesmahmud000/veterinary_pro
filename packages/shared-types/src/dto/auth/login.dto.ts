import { AuthTokensDto, AuthUserSummary } from "./auth-tokens.dto.js";

/**
 * Standard user credentials login request.
 * Supports email credentials, or optional phone identifier login.
 */
export interface LoginRequestDto {
  readonly email: string;
  readonly password: string;
  readonly phone?: string;
  readonly rememberMe?: boolean;
}

/**
 * Successful login response returning active tokens and authenticated user summary.
 */
export interface LoginResponseDto {
  readonly user: AuthUserSummary;
  readonly tokens: AuthTokensDto;
}
