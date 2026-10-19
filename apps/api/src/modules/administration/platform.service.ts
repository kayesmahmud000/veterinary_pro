import { Inject, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  JwtPayload,
  UserRole,
  PlatformSettingsSave,
  PlatformReportQuery,
  platformSettingsSaveSchema,
  platformReportQuerySchema,
  platformDiagnosticSchema,
  platformDiagnosticResultSchema,
  platformReportExportSchema,
  platformAuditExportSchema,
  platformAuditExportResultSchema,
} from "@vetralink/shared-types";
import { z } from "zod";
import {
  USER_REPOSITORY,
  IUserRepository,
} from "../users/repositories/user.repository.interface";
import { UserEntity } from "../users/entities/user.entity";
import {
  PASSWORD_HASHER,
  IPasswordHasher,
} from "../auth/services/password-hasher.interface";
import {
  TRANSACTION_MANAGER,
  ITransactionManager,
} from "../prisma/interfaces/transaction.interface";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../audit/repositories/audit-log.repository.interface";
import { WorkflowRateLimiter } from "../../common/security/workflow-rate-limiter";
import {
  ForbiddenOperationException,
  WorkflowException,
} from "../../common/exceptions/domain.exception";
import { validateWorkflow } from "../../common/utils/validate-workflow";
import {
  PlatformRepository,
  platformSettingsId,
  reportInstants,
} from "./platform.repository";
import { PlatformProbe } from "./platform-probe.service";

@Injectable()
export class PlatformService {
  constructor(
    private readonly repo: PlatformRepository,
    private readonly probe: PlatformProbe,
    @Inject(USER_REPOSITORY) private readonly users: IUserRepository,
    @Inject(PASSWORD_HASHER) private readonly passwords: IPasswordHasher,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactions: ITransactionManager,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly audit: IAuditLogRepository,
    private readonly limiter: WorkflowRateLimiter,
  ) {}
  private assert(
    user: UserEntity | null,
    claims: JwtPayload,
    superOnly: boolean,
  ): asserts user is UserEntity {
    if (
      !user?.isActive() ||
      user.role !== claims?.role ||
      user.authorizationVersion !== (claims?.authorizationVersion ?? 0) ||
      !(
        superOnly
          ? [UserRole.SUPER_ADMIN]
          : [UserRole.ADMIN, UserRole.SUPER_ADMIN]
      ).includes(user.role)
    )
      throw new ForbiddenOperationException(
        "Current authorized identity required.",
      );
  }
  private async authorize(claims: JwtPayload, superOnly = false) {
    const actor = claims?.sub ? await this.users.findById(claims.sub) : null;
    this.assert(actor, claims, superOnly);
    return actor;
  }
  private async confirm(
    claims: JwtPayload,
    password: string,
    superOnly: boolean,
  ) {
    const actor = await this.authorize(claims, superOnly);
    await this.limiter.hit("admin-platform-write", actor.id, 15, 900);
    if (!(await this.passwords.compare(password, actor.passwordHash)))
      throw new WorkflowException(
        "PASSWORD_CONFIRMATION_FAILED",
        "Password confirmation failed.",
        403,
      );
    return actor;
  }
  private async write<T>(
    claims: JwtPayload,
    actor: UserEntity,
    superOnly: boolean,
    fn: (tx: Prisma.TransactionClient) => Promise<T>,
  ) {
    try {
      return await this.transactions.run(
        async (tx) => {
          const current = await this.users.lockById(actor.id, tx);
          this.assert(current, claims, superOnly);
          if (current.passwordHash !== actor.passwordHash)
            throw new ForbiddenOperationException("Session changed.");
          return fn(tx);
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      const e = error as { code?: string; meta?: { code?: string } };
      if (
        ["P2034", "P2002"].includes(e?.code ?? "") ||
        ["40001", "40P01"].includes(e?.meta?.code ?? "")
      )
        throw new WorkflowException(
          "SETTINGS_CONFLICT",
          "Changed or processing. Reload before retrying.",
        );
      throw error;
    }
  }
  private record(
    claims: JwtPayload,
    id: string,
    action: string,
    values: Record<string, unknown>,
    tx: Prisma.TransactionClient,
  ) {
    return this.audit.record(
      {
        userId: claims.sub,
        entityType: "PlatformAdministration",
        entityId: id,
        action,
        traceId: randomUUID(),
        newValues: values,
      },
      tx,
    );
  }
  private range(q: PlatformReportQuery) {
    const { end } = reportInstants(q);
    // A complete current calendar day may be included, but no later day.
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: q.timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    const localDay = ["year", "month", "day"]
      .map((k) => parts.find((p) => p.type === k)!.value)
      .join("-");
    const tomorrow = new Date(
      reportInstants({ ...q, to: localDay }).end.getTime() + 86400000,
    );
    if (end > tomorrow)
      throw new WorkflowException(
        "VALIDATION_FAILED",
        "Report end date cannot be later than tomorrow.",
        422,
      );
  }
  async settings(claims: JwtPayload) {
    await this.authorize(claims, true);
    return this.repo.settings();
  }
  async saveSettings(claims: JwtPayload, raw: PlatformSettingsSave) {
    const input = validateWorkflow(platformSettingsSaveSchema, raw);
    const actor = await this.confirm(claims, input.actorPassword, true);
    return this.write(claims, actor, true, async (tx) => {
      const previous = await this.repo.lockSettings(tx);
      if (previous.version !== input.expectedVersion)
        throw new WorkflowException(
          "SETTINGS_CONFLICT",
          "Settings changed. Reload and review.",
        );
      const saved = await this.repo.saveSettings(input, tx);
      await this.record(
        claims,
        platformSettingsId,
        "PLATFORM_SETTINGS_UPDATED",
        {
          reason: input.reason,
          previousVersion: previous.version,
          version: saved.version,
          organizationBn: saved.organizationBn,
          organizationEn: saved.organizationEn,
          supportEmail: saved.supportEmail,
          reportTimezone: saved.reportTimezone,
        },
        tx,
      );
      return saved;
    });
  }
  async integrations(claims: JwtPayload) {
    await this.authorize(claims, true);
    return this.probe.integrations();
  }
  async system(claims: JwtPayload) {
    await this.authorize(claims, true);
    await this.limiter.hit("admin-platform-probe", claims.sub, 30, 900);
    return this.probe.system();
  }
  async diagnostics(
    claims: JwtPayload,
    raw: z.infer<typeof platformDiagnosticSchema>,
  ) {
    const input = validateWorkflow(platformDiagnosticSchema, raw);
    const actor = await this.confirm(claims, input.actorPassword, true);
    const existing = await this.repo.diagnostic(input.requestId);
    if (existing) {
      if (existing.actorId !== actor.id)
        throw new ForbiddenOperationException(
          "Request belongs to a different identity.",
        );
      return platformDiagnosticResultSchema.parse({
        requestId: input.requestId,
        result: existing.result,
      });
    }
    const result = await this.probe.system();
    return this.write(claims, actor, true, async (tx) => {
      const found = await this.repo.diagnostic(input.requestId, tx);
      if (found) {
        if (found.actorId !== actor.id) throw new ForbiddenOperationException();
        return platformDiagnosticResultSchema.parse({
          requestId: input.requestId,
          result: found.result,
        });
      }
      const saved = await this.repo.recordDiagnostic(
        input.requestId,
        actor.id,
        result,
        tx,
      );
      await this.record(
        claims,
        input.requestId,
        "PLATFORM_DIAGNOSTICS_RECORDED",
        {
          reason: input.reason,
          database: result.database,
          redis: result.redis,
          observedQueues: result.queues.filter((q) => q.status === "OBSERVED")
            .length,
        },
        tx,
      );
      return saved;
    });
  }
  async report(claims: JwtPayload, raw: PlatformReportQuery) {
    await this.authorize(claims);
    const query = validateWorkflow(platformReportQuerySchema, raw);
    this.range(query);
    await this.limiter.hit("admin-platform-report", claims.sub, 60, 900);
    return this.transactions.run((tx) => this.repo.report(query, tx), {
      isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    });
  }
  async exportReport(
    claims: JwtPayload,
    raw: z.infer<typeof platformReportExportSchema>,
  ) {
    const input = validateWorkflow(platformReportExportSchema, raw);
    this.range(input.query);
    const actor = await this.confirm(claims, input.actorPassword, false);
    return this.write(claims, actor, false, async (tx) => {
      const report = await this.repo.report(input.query, tx),
        exportId = randomUUID();
      await this.record(
        claims,
        exportId,
        "ADMIN_REPORT_EXPORTED",
        {
          reason: input.reason,
          ...input.query,
          generatedAt: report.generatedAt,
        },
        tx,
      );
      return { exportId, report };
    });
  }
  async exportAudit(
    claims: JwtPayload,
    raw: z.infer<typeof platformAuditExportSchema>,
  ) {
    const input = validateWorkflow(platformAuditExportSchema, raw);
    this.range(input.query);
    const actor = await this.confirm(claims, input.actorPassword, false);
    return this.write(claims, actor, false, async (tx) => {
      const result = await this.repo.auditExport(
          input.query,
          actor.role === UserRole.SUPER_ADMIN,
          tx,
        ),
        exportId = randomUUID(),
        generatedAt = new Date().toISOString();
      await this.record(
        claims,
        exportId,
        "ADMIN_AUDIT_EXPORTED",
        {
          reason: input.reason,
          ...input.query,
          count: result.items.length,
          truncated: result.truncated,
        },
        tx,
      );
      return platformAuditExportResultSchema.parse({
        exportId,
        generatedAt,
        query: input.query,
        ...result,
      });
    });
  }
}
