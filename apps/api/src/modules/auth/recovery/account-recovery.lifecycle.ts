import { Inject, Injectable } from "@nestjs/common";
import { randomBytes, randomUUID } from "node:crypto";
import { AccountRecoveryJob } from "@prisma/client";
import {
  PasswordResetAcknowledgement, PasswordResetCompleteInput, PasswordResetRequestInput,
  PasswordResetResult, passwordResetRequestSchema,
} from "@vetralink/shared-types";
import { ITransactionManager, TRANSACTION_MANAGER } from "../../prisma/interfaces/transaction.interface";
import { IPasswordHasher, PASSWORD_HASHER } from "../services/password-hasher.interface";
import { RecoveryValidationPipe } from "./account-recovery.dto";
import { passwordResetCompleteSchema } from "@vetralink/shared-types";
import { AccountRecoveryException } from "./account-recovery.errors";
import { AccountRecoveryRepository, eligibleForRecovery, RecoveryUser, RecoveryUserSnapshot } from "./account-recovery.repository";
import { AccountRecoverySecrets } from "./account-recovery.secrets";

// Internal persistence use cases. The public facade stays closed until abuse
// enforcement and delivery integration are implemented and accepted.
@Injectable()
export class AccountRecoveryLifecycleService {
  constructor(
    private readonly repository: AccountRecoveryRepository,
    @Inject(TRANSACTION_MANAGER) private readonly transactions: ITransactionManager,
    @Inject(PASSWORD_HASHER) private readonly passwords: IPasswordHasher,
    private readonly secrets: AccountRecoverySecrets,
  ) {}

  async acceptRequest(input: PasswordResetRequestInput): Promise<PasswordResetAcknowledgement> {
    const parsed = new RecoveryValidationPipe(passwordResetRequestSchema).transform(input);
    const context = this.secrets.context(randomUUID(), parsed.email, parsed.locale);
    await this.transactions.run((tx) => this.repository.acceptRequest({ id: context.jobId, locale: context.locale,
      emailHmac: context.emailHmac, templateVersion: context.templateVersion, originVersion: context.originVersion,
      payload: this.secrets.seal({ ...context, kind: "RESET_REQUEST" }) }, tx));
    return { accepted: true };
  }

  async issueForRequest(jobId: string, leaseId: string): Promise<AccountRecoveryJob | null> {
    const job = await this.repository.findJob(jobId);
    if (!job || job.kind !== "RESET_REQUEST" || job.status !== "PENDING") return null;
    const payload = this.secrets.openPayload(job);
    if (payload.kind === "PASSWORD_CHANGED") throw new AccountRecoveryException("RECOVERY_UNAVAILABLE");
    const user = job.userId ? await this.repository.findUserById(job.userId)
      : await this.repository.findUserByEmail(payload.email);
    if (!eligibleForRecovery(user))
      return this.transactions.run((tx) => this.repository.discardRequest(jobId, leaseId, job.userId, tx));
    const token = payload.kind === "RESET_LINK" ? payload.token : randomBytes(32).toString("hex");
    const id = job.credentialId ?? randomUUID();
    const context = this.secrets.context(job.id, payload.email, payload.locale);
    const sealed = payload.kind === "RESET_LINK" ? job.payload! : this.secrets.seal({
      ...context, kind: "RESET_LINK", credentialId: id, token, authorizationVersion: user.authorizationVersion,
    });
    return this.transactions.run((tx) => this.repository.issueForRequest(job.id, leaseId, {
      id, tokenHash: this.secrets.hashToken(token), payload: sealed, expected: this.snapshot(user),
    }, tx));
  }

  async complete(input: PasswordResetCompleteInput): Promise<PasswordResetResult> {
    const parsed = new RecoveryValidationPipe(passwordResetCompleteSchema).transform(input);
    const found = await this.repository.findCredentialByHash(this.secrets.hashToken(parsed.token));
    if (!found || !eligibleForRecovery(found.user) || found.credential.consumedAt || found.credential.invalidatedAt ||
      found.credential.expiresAt <= found.now || found.credential.authorizationVersion !== found.user.authorizationVersion ||
      found.credential.emailHmac !== this.secrets.emailHmac(found.user.email))
      throw new AccountRecoveryException("RESET_LINK_INVALID");
    const expected = this.snapshot(found.user);
    // bcrypt-12 runs outside database locks; final snapshot/expiry checks run again inside.
    const passwordHash = await this.passwords.hash(parsed.newPassword);
    const context = this.secrets.context(randomUUID(), found.user.email, found.locale);
    await this.transactions.run((tx) => this.repository.consumeAndRevoke(found.credential.id, expected, passwordHash, {
      id: context.jobId, locale: context.locale, emailHmac: context.emailHmac,
      originVersion: context.originVersion, templateVersion: context.templateVersion,
      payload: this.secrets.seal({ ...context, kind: "PASSWORD_CHANGED", userId: expected.id,
        authorizationVersion: expected.authorizationVersion + 1 }),
    }, tx));
    return { reset: true };
  }

  private snapshot(user: RecoveryUser): RecoveryUserSnapshot {
    return { id: user.id, passwordHash: user.passwordHash, authorizationVersion: user.authorizationVersion,
      emailHmac: this.secrets.emailHmac(user.email) };
  }
}
