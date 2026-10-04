import { UserRole, UserStatus } from "../../enums/index.js";

/**
 * Standardized Bearer token pair returned upon successful authentication or rotation.
 */
export interface AuthTokensDto {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly tokenType: "Bearer";
  readonly expiresIn: number; // Duration in seconds (e.g., 900 for 15 minutes)
}

/**
 * Public, sanitized summary of user identity for client-side sessions and presentation.
 * Explicitly strips password hashes and raw encryption details.
 */
export interface AuthUserSummary {
  readonly id: string;
  readonly email: string;
  readonly name: string;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly isEmailVerified: boolean;
  readonly maskedPhone: string | null;
  readonly avatarUrl: string | null;
  readonly createdAt: string; // ISO 8601 string
}

/**
 * Decoded JWT access token claims contract.
 */
export interface JwtPayload {
  readonly sub: string; // User UUID
  readonly email: string;
  readonly role: UserRole;
  readonly status: UserStatus;
  readonly activeFarmId?: string; // Present if authenticated within a specific farm tenant context
  readonly jti?: string; // Unique JWT identifier for token revocation tracking
  readonly iat?: number;
  readonly exp?: number;
}
