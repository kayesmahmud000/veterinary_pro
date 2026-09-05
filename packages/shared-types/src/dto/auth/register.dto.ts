import { UserRole } from "../../enums/index.js";
import { AuthTokensDto, AuthUserSummary } from "./auth-tokens.dto.js";

/**
 * Public user registration request contract.
 * Note: Only FARMER, VET, and BUYER roles may be requested during public signup.
 * Elevated roles (SUPER_ADMIN, ADMIN) are strictly restricted.
 */
export interface RegisterRequestDto {
  readonly email: string;
  readonly password: string;
  readonly name: string;
  readonly role?: UserRole;
  readonly phone?: string;
}

/**
 * Successful registration response containing authenticated session tokens and profile.
 */
export interface RegisterResponseDto {
  readonly user: AuthUserSummary;
  readonly tokens: AuthTokensDto;
}
