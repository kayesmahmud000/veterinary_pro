import { AuthTokensDto, JwtPayload, UserRole, UserStatus } from "@vetralink/shared-types";

export interface GenerateTokensParams {
  userId: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  activeFarmId?: string;
}

export interface ITokenService {
  generateTokens(params: GenerateTokensParams): Promise<AuthTokensDto>;
  generateAccessToken(payload: JwtPayload): Promise<string>;
  generateRefreshToken(): string;
  hashRefreshToken(refreshToken: string): string;
  verifyAccessToken(token: string): Promise<JwtPayload>;
  getRefreshTokenExpiresAt(): Date;
}

export const TOKEN_SERVICE = "TOKEN_SERVICE";
