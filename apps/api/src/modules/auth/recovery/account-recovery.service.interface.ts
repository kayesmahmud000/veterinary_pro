import {
  PasswordResetAcknowledgement, PasswordResetCompleteInput,
  PasswordResetRequestInput, PasswordResetResult,
} from "@vetralink/shared-types";

export const ACCOUNT_RECOVERY_SERVICE = Symbol("ACCOUNT_RECOVERY_SERVICE");

// Raw transport facts only. Forwarded values are untrusted until Task 3's resolver.
export interface RecoveryAddressContext {
  readonly socketAddress: string | undefined;
  readonly forwardedFor: string | string[] | undefined;
}

export interface IAccountRecoveryService {
  request(input: PasswordResetRequestInput, address: RecoveryAddressContext): Promise<PasswordResetAcknowledgement>;
  complete(input: PasswordResetCompleteInput, address: RecoveryAddressContext): Promise<PasswordResetResult>;
}
