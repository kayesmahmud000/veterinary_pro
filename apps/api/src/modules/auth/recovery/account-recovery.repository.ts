import { Inject, Injectable } from "@nestjs/common";
import { AccountRecoveryJob, PasswordResetCredential, Prisma, UserStatus } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { IUserRepository, USER_REPOSITORY } from "../../users/repositories/user.repository.interface";
import { IRefreshTokenRepository, REFRESH_TOKEN_REPOSITORY } from "../repositories/refresh-token.repository.interface";
import { AUDIT_LOG_REPOSITORY, IAuditLogRepository } from "../../audit/repositories/audit-log.repository.interface";
import { AccountRecoveryException } from "./account-recovery.errors";
import { AccountRecoverySecrets } from "./account-recovery.secrets";

export interface RecoveryUser {
  id: string; email: string; passwordHash: string; authorizationVersion: number;
  status: UserStatus; deletedAt: Date | null;
}
export interface RecoveryUserSnapshot {
  id: string; passwordHash: string; authorizationVersion: number; emailHmac: string;
}
export interface RecoveryIntake {
  id: string; locale: "bn" | "en"; emailHmac: string; payload: string;
  originVersion: string; templateVersion: number;
}
export interface RecoveryCredentialCandidate {
  id: string; tokenHash: string; payload: string; expected: RecoveryUserSnapshot;
}
export interface RecoveryNotice extends RecoveryIntake {}
export const eligibleForRecovery = (user: RecoveryUser | null): user is RecoveryUser =>
  !!user && !user.deletedAt && !!user.passwordHash.trim() &&
  (user.status === "ACTIVE" || user.status === "PENDING_VERIFICATION");

const userSelect = { id: true, email: true, passwordHash: true, authorizationVersion: true, status: true, deletedAt: true } as const;

@Injectable()
export class AccountRecoveryRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY) private readonly sessions: IRefreshTokenRepository,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly audit: IAuditLogRepository,
    private readonly secrets: AccountRecoverySecrets,
  ) {}

  async now(tx: Prisma.TransactionClient = this.prisma): Promise<Date> {
    const [clock] = await tx.$queryRaw<Array<{ now: Date }>>`SELECT clock_timestamp() AS now`;
    return clock.now;
  }

  async assertAdmissionAvailable(tx: Prisma.TransactionClient): Promise<void> {
    // A purpose-specific, transaction-scoped global lock serializes count+insert.
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(72100473)::text`;
    const [pressure] = await tx.$queryRaw<Array<{ count: bigint; old: boolean }>>`
      SELECT count(*) AS count,
        COALESCE(bool_or(credential_id IS NULL AND created_at <= clock_timestamp()-interval '60 seconds'),false) AS old
      FROM account_recovery_jobs WHERE kind='RESET_REQUEST' AND status='PENDING'`;
    if (pressure.count >= 100n || pressure.old) throw new AccountRecoveryException("RECOVERY_UNAVAILABLE");
  }

  async acceptRequest(input: RecoveryIntake, tx: Prisma.TransactionClient): Promise<void> {
    await this.assertAdmissionAvailable(tx);
    const now = await this.now(tx);
    await tx.accountRecoveryJob.create({ data: { ...input, kind: "RESET_REQUEST",
      createdAt: now, availableAt: now, deadlineAt: new Date(now.getTime() + 600000) } });
  }

  findJob(id: string): Promise<AccountRecoveryJob | null> {
    return this.prisma.accountRecoveryJob.findUnique({ where: { id } });
  }
  findUserByEmail(email: string): Promise<RecoveryUser | null> {
    return this.prisma.user.findUnique({ where: { email }, select: userSelect });
  }
  findUserById(id: string): Promise<RecoveryUser | null> {
    return this.prisma.user.findUnique({ where: { id }, select: userSelect });
  }
  async findCredentialByHash(tokenHash: string): Promise<{
    credential: PasswordResetCredential; user: RecoveryUser; now: Date; locale: "bn" | "en";
  } | null> {
    const credential = await this.prisma.passwordResetCredential.findUnique({ where: { tokenHash }, include: { job: { select: { locale: true } } } });
    if (!credential) return null;
    const user = await this.prisma.user.findUnique({ where: { id: credential.userId }, select: userSelect });
    return user ? { credential, user, now: await this.now(), locale: credential.job?.locale === "en" ? "en" : "bn" } : null;
  }

  private async lockCredentials(userId: string, tx: Prisma.TransactionClient): Promise<void> {
    await tx.$queryRaw`SELECT id FROM password_reset_credentials WHERE user_id=${userId}::uuid ORDER BY id FOR UPDATE`;
  }
  private async lockJob(id: string, tx: Prisma.TransactionClient): Promise<AccountRecoveryJob | null> {
    await tx.$queryRaw`SELECT id FROM account_recovery_jobs WHERE id=${id}::uuid FOR UPDATE`;
    return tx.accountRecoveryJob.findUnique({ where: { id } });
  }
  private owns(job: AccountRecoveryJob | null, leaseId: string, now: Date): job is AccountRecoveryJob {
    return !!job && job.kind === "RESET_REQUEST" && job.status === "PENDING" &&
      job.leaseId === leaseId && !!job.leaseUntil && job.leaseUntil > now;
  }
  private matches(user: RecoveryUser | null, expected: RecoveryUserSnapshot): user is RecoveryUser {
    return eligibleForRecovery(user) && user.id === expected.id &&
      user.passwordHash === expected.passwordHash && user.authorizationVersion === expected.authorizationVersion &&
      this.secrets.emailHmac(user.email) === expected.emailHmac;
  }
  private async skip(job: AccountRecoveryJob, now: Date, code: string, tx: Prisma.TransactionClient): Promise<null> {
    if (job.credentialId) await tx.passwordResetCredential.updateMany({
      where: { id: job.credentialId, consumedAt: null, invalidatedAt: null }, data: { invalidatedAt: now },
    });
    await tx.accountRecoveryJob.update({ where: { id: job.id }, data: {
      status: "SKIPPED", payload: null, completedAt: now, leaseId: null, leaseUntil: null, failureCode: code,
    } });
    return null;
  }

  async discardRequest(id: string, leaseId: string, knownUserId: string | null, tx: Prisma.TransactionClient): Promise<null> {
    if (knownUserId) {
      await this.users.lockById(knownUserId, tx);
      await this.lockCredentials(knownUserId, tx);
    }
    const job = await this.lockJob(id, tx), now = await this.now(tx);
    if (!this.owns(job, leaseId, now) || job.userId !== knownUserId) return null;
    return this.skip(job, now, "INELIGIBLE", tx);
  }

  async issueForRequest(id: string, leaseId: string, candidate: RecoveryCredentialCandidate, tx: Prisma.TransactionClient): Promise<AccountRecoveryJob | null> {
    const user = await this.users.lockById(candidate.expected.id, tx);
    await this.lockCredentials(candidate.expected.id, tx);
    const job = await this.lockJob(id, tx), now = await this.now(tx);
    if (!this.owns(job, leaseId, now)) return null;
    // A stale initial read must never cause writes under another user's lock.
    if (job.userId !== null && job.userId !== candidate.expected.id) return null;
    if (job.deadlineAt <= now) return this.skip(job, now, "EXPIRED", tx);
    if (!this.matches(user, candidate.expected) || job.emailHmac !== candidate.expected.emailHmac)
      return this.skip(job, now, "INELIGIBLE", tx);
    if (job.credentialId) {
      const credential = await tx.passwordResetCredential.findUnique({ where: { id: job.credentialId } });
      // Another invocation with this same fence may have issued after our
      // preflight read. Replay the committed credential, never a stale candidate.
      const persisted = this.secrets.openPayload(job);
      if (!credential || persisted.kind !== "RESET_LINK" ||
        credential.tokenHash !== this.secrets.hashToken(persisted.token) ||
        credential.userId !== user.id || credential.authorizationVersion !== user.authorizationVersion ||
        credential.emailHmac !== candidate.expected.emailHmac || credential.consumedAt || credential.invalidatedAt || credential.expiresAt <= now)
        return this.skip(job, now, "OBSOLETE", tx);
      return job;
    }
    const usable = await tx.passwordResetCredential.count({ where: {
      userId: user.id, emailHmac: candidate.expected.emailHmac, authorizationVersion: user.authorizationVersion,
      consumedAt: null, invalidatedAt: null, expiresAt: { gt: now },
    } });
    if (usable >= 6) return this.skip(job, now, "CAP_REACHED", tx);
    const expiresAt = new Date(now.getTime() + 1800000);
    await tx.passwordResetCredential.create({ data: {
      id: candidate.id, userId: user.id, tokenHash: candidate.tokenHash,
      emailHmac: candidate.expected.emailHmac, authorizationVersion: user.authorizationVersion,
      createdAt: now, expiresAt,
    } });
    return tx.accountRecoveryJob.update({ where: { id }, data: {
      userId: user.id, credentialId: candidate.id, authorizationVersion: user.authorizationVersion,
      payload: candidate.payload, deadlineAt: expiresAt,
    } });
  }

  async consumeAndRevoke(id: string, expected: RecoveryUserSnapshot, passwordHash: string, notice: RecoveryNotice, tx: Prisma.TransactionClient): Promise<void> {
    const user = await this.users.lockById(expected.id, tx);
    await this.lockCredentials(expected.id, tx);
    const affected = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM account_recovery_jobs
      WHERE kind='RESET_REQUEST' AND status='PENDING' AND (user_id=${expected.id}::uuid OR email_hmac=${expected.emailHmac}) ORDER BY id FOR UPDATE`;
    const credential = await tx.passwordResetCredential.findUnique({ where: { id } }), now = await this.now(tx);
    if (!this.matches(user, expected) || !credential || credential.userId !== expected.id ||
      credential.emailHmac !== expected.emailHmac || credential.authorizationVersion !== expected.authorizationVersion ||
      credential.consumedAt || credential.invalidatedAt || credential.expiresAt <= now)
      throw new AccountRecoveryException("RESET_LINK_INVALID");

    // Only password/session version change. Role, verification and farm state stay intact.
    await tx.user.update({ where: { id: expected.id }, data: { passwordHash } });
    await this.users.invalidateSessions(expected.id, tx);
    await this.sessions.revokeAllForUser(expected.id, now, tx);
    await tx.passwordResetCredential.update({ where: { id }, data: { consumedAt: now } });
    await tx.passwordResetCredential.updateMany({ where: {
      userId: expected.id, id: { not: id }, consumedAt: null, invalidatedAt: null,
    }, data: { invalidatedAt: now } });
    await tx.accountRecoveryJob.updateMany({ where: { id: { in: affected.map((job) => job.id) } }, data: {
      status: "CANCELLED", payload: null, completedAt: now, leaseId: null, leaseUntil: null, failureCode: "OBSOLETE",
    } });
    await this.audit.record({ userId: expected.id, action: "PASSWORD_RESET_COMPLETED", entityType: "PasswordResetCredential",
      entityId: id, traceId: randomUUID(), newValues: { purpose: "ACCOUNT_RECOVERY", authorizationVersion: expected.authorizationVersion + 1 } }, tx);
    await tx.accountRecoveryJob.create({ data: { ...notice, kind: "PASSWORD_CHANGED", userId: expected.id,
      authorizationVersion: expected.authorizationVersion + 1, createdAt: now, availableAt: now, deadlineAt: new Date(now.getTime() + 86400000) } });
  }
}
