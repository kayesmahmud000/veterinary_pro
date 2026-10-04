/**
 * DTO contracts for AES-128 HLS DRM key server and playback tokens.
 */

export interface DrmPlaybackTokenRequestDto {
  productId: string;
}

export interface DrmPlaybackTokenResponseDto {
  playbackToken: string;
  keyUrl: string;
  expiresAt: string;
  expiresInSeconds: number;
}

export interface DrmTokenPayload {
  sub: string; // User ID
  pid: string; // Product ID
  role: string; // User Role
  jti: string; // Unique token ID
  iat: number;
  exp: number;
}
