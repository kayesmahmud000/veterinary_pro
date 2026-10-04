/**
 * Request payload to initiate a forgot password email/reset flow.
 */
export interface ForgotPasswordRequestDto {
  readonly email: string;
}

/**
 * Response payload confirming receipt of forgot password request.
 */
export interface ForgotPasswordResponseDto {
  readonly success: boolean;
  readonly message: string;
}

/**
 * Request payload to execute a password reset using a verified reset token.
 */
export interface ResetPasswordRequestDto {
  readonly token: string;
  readonly newPassword: string;
}

/**
 * Request payload for authenticated users changing their password.
 */
export interface ChangePasswordRequestDto {
  readonly currentPassword: string;
  readonly newPassword: string;
}
