import { UserRole } from "../../enums/index.js";
import { AuthTokensDto, AuthUserSummary } from "./auth-tokens.dto.js";

/**
 * Public user registration request contract.
 * LEARNER is the omitted-role default; FARMER, VET and BUYER may also be selected.
 * Elevated roles (SUPER_ADMIN, ADMIN) are strictly restricted.
 */
export interface RegisterRequestDto {
  readonly email: string;
  readonly password: string;
  readonly name: string;
  readonly role?:
    UserRole.LEARNER | UserRole.FARMER | UserRole.VET | UserRole.BUYER;
  readonly phone?: string;
}

/**
 * Successful registration response containing authenticated session tokens and profile.
 */
export interface RegisterResponseDto {
  readonly user: AuthUserSummary;
  readonly tokens: AuthTokensDto;
}
