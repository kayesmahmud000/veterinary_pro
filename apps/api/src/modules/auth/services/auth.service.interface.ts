import {
  LoginRequestDto,
  LoginResponseDto,
  RefreshTokenResponseDto,
  RegisterRequestDto,
  RegisterResponseDto,
} from "@vetralink/shared-types";

export interface ClientMetadata {
  ipAddress?: string;
  userAgent?: string;
}

export interface IAuthService {
  register(
    dto: RegisterRequestDto,
    meta?: ClientMetadata
  ): Promise<RegisterResponseDto>;

  login(
    dto: LoginRequestDto,
    meta?: ClientMetadata
  ): Promise<LoginResponseDto>;

  refreshToken(
    refreshToken: string,
    meta?: ClientMetadata
  ): Promise<RefreshTokenResponseDto>;

  logout(refreshToken: string): Promise<void>;

  logoutAll(userId: string): Promise<void>;
}

export const AUTH_SERVICE = "AUTH_SERVICE";
