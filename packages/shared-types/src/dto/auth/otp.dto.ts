/**
 * Scoped purposes for one-time passwords (OTP).
 * Ensures an OTP generated for one workflow cannot be replayed for another.
 */
export enum OtpPurpose {
  REGISTRATION_VERIFICATION = "REGISTRATION_VERIFICATION",
  PASSWORD_RESET = "PASSWORD_RESET",
  PHONE_VERIFICATION = "PHONE_VERIFICATION",
  LOGIN_2FA = "LOGIN_2FA",
}

/**
 * Transport channels supported for OTP delivery.
 */
export enum OtpChannel {
  SMS = "SMS",
  EMAIL = "EMAIL",
}

/**
 * Request payload to initiate an OTP dispatch.
 */
export interface SendOtpRequestDto {
  readonly identifier: string; // Email address or normalized phone number
  readonly channel: OtpChannel;
  readonly purpose: OtpPurpose;
}

/**
 * Response payload confirming OTP dispatch.
 */
export interface SendOtpResponseDto {
  readonly success: boolean;
  readonly message: string;
  readonly retryAfterSeconds: number; // Cooldown before requesting another OTP (e.g., 60s)
}

/**
 * Request payload to verify a received 6-digit OTP.
 */
export interface VerifyOtpRequestDto {
  readonly identifier: string;
  readonly code: string; // 6-digit numeric string
  readonly purpose: OtpPurpose;
}

/**
 * Verification response returning verification status and optional time-limited verification token.
 */
export interface VerifyOtpResponseDto {
  readonly verified: boolean;
  readonly verificationToken?: string; // Signed proof of verification for subsequent action
}
