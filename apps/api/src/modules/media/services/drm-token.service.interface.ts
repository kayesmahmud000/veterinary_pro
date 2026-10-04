import { DrmTokenPayload } from "@vetralink/shared-types";

export const DRM_TOKEN_SERVICE = Symbol("DRM_TOKEN_SERVICE");

export interface GeneratePlaybackTokenResult {
  token: string;
  expiresAt: Date;
  expiresInSeconds: number;
}

export interface IDrmTokenService {
  /**
   * Generates a signed, time-bound ephemeral DRM playback token.
   *
   * @param userId Authenticated user UUID
   * @param productId Target product UUID
   * @param role User role
   */
  generatePlaybackToken(
    userId: string,
    productId: string,
    role: string
  ): Promise<GeneratePlaybackTokenResult>;

  /**
   * Verifies and decodes a DRM playback token.
   * Throws UnauthorizedDomainException if expired, tampered, or invalid.
   *
   * @param token Ephemeral playback JWT string
   * @returns Decoded DrmTokenPayload
   */
  verifyPlaybackToken(token: string): Promise<DrmTokenPayload>;
}
