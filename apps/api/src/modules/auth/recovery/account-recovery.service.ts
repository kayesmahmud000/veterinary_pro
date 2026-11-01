import { Injectable } from "@nestjs/common";
import { PasswordResetAcknowledgement, PasswordResetCompleteInput, PasswordResetRequestInput, PasswordResetResult } from "@vetralink/shared-types";
import { AccountRecoveryException } from "./account-recovery.errors";
import { IAccountRecoveryService, RecoveryAddressContext } from "./account-recovery.service.interface";

@Injectable()
export class AccountRecoveryService implements IAccountRecoveryService {
  // Task 1 provides only the transport. Never acknowledge intake/consumption
  // until durable persistence, limits and delivery lifecycle are implemented.
  async request(_input: PasswordResetRequestInput, _address: RecoveryAddressContext): Promise<PasswordResetAcknowledgement> {
    throw new AccountRecoveryException("RECOVERY_UNAVAILABLE");
  }
  async complete(_input: PasswordResetCompleteInput, _address: RecoveryAddressContext): Promise<PasswordResetResult> {
    throw new AccountRecoveryException("RECOVERY_UNAVAILABLE");
  }
}
