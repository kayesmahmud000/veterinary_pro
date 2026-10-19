import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  PlatformSettings,
  PlatformSettingsSave,
  PlatformReportQuery,
  PlatformAuditQuery,
  PlatformSystem,
  platformSettingsSchema,
  platformReportSchema,
  platformDiagnosticResultSchema,
} from "@vetralink/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import {
  auditMetadataSelect,
  operationalAuditActions,
} from "./directory.repository";

export const platformSettingsId = "00000000-0000-4000-8000-000000000008";
const defaults: PlatformSettings = {
  organizationBn: "ভেট্রালিংক প্রো",
  organizationEn: "VetraLink Pro",
  supportEmail: "",
  reportTimezone: "Asia/Dhaka",
  version: 0,
  updatedAt: null,
};
export function reportInstants(q: PlatformReportQuery) {
  const offset = q.timezone === "Asia/Dhaka" ? "+06:00" : "Z";
  return {
    start: new Date(q.from + "T00:00:00" + offset),
    end: new Date(q.to + "T00:00:00" + offset),
  };
}
type CountRow = { status: string; count: bigint };
type MoneyRow = {
  currency: string;
  status: string;
  count: bigint;
  totalMinor: Prisma.Decimal | bigint;
  period?: string;
};
const counts = (rows: CountRow[]) =>
  rows.map((r) => ({ status: r.status, count: Number(r.count) }));
const money = (rows: MoneyRow[]) =>
  rows.map((r) => ({
    ...r,
    count: Number(r.count),
    totalMinor: r.totalMinor.toString(),
  }));
@Injectable()
export class PlatformRepository {
  constructor(private readonly prisma: PrismaService) {}
  async settings(
    tx: Prisma.TransactionClient = this.prisma,
  ): Promise<PlatformSettings> {
    const r = await tx.platformSettings.findUnique({
      where: { id: platformSettingsId },
    });
    if (!r) return { ...defaults };
    const { id: _id, ...safe } = r;
    return platformSettingsSchema.parse({
      ...safe,
      updatedAt: r.updatedAt.toISOString(),
    });
  }
  async lockSettings(tx: Prisma.TransactionClient) {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(180000008)`;
    return this.settings(tx);
  }
  async saveSettings(
    input: PlatformSettingsSave,
    tx: Prisma.TransactionClient,
  ) {
    const data = {
      organizationBn: input.organizationBn,
      organizationEn: input.organizationEn,
      supportEmail: input.supportEmail,
      reportTimezone: input.reportTimezone,
      version: input.expectedVersion + 1,
    };
    await tx.platformSettings.upsert({
      where: { id: platformSettingsId },
      create: { id: platformSettingsId, ...data },
      update: data,
    });
    return this.settings(tx);
  }
  diagnostic(id: string, tx: Prisma.TransactionClient = this.prisma) {
    return tx.platformDiagnosticRun.findUnique({
      where: { id },
      select: { actorId: true, result: true },
    });
  }
  async recordDiagnostic(
    id: string,
    actorId: string,
    result: PlatformSystem,
    tx: Prisma.TransactionClient,
  ) {
    await tx.platformDiagnosticRun.create({
      data: {
        id,
        actorId,
        result: result as unknown as Prisma.InputJsonObject,
      },
    });
    return platformDiagnosticResultSchema.parse({ requestId: id, result });
  }
  async databaseProbe() {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SET LOCAL statement_timeout = '1500ms'`;
          await tx.$queryRaw`SELECT 1`;
          const [pending, failed] = await Promise.all([
            tx.roleNotificationOutbox.count({ where: { completedAt: null } }),
            tx.roleNotificationDelivery.count({ where: { status: "FAILED" } }),
          ]);
          return { pending, failed };
        },
        { timeout: 2500, maxWait: 1500 },
      );
    } catch {
      return null;
    }
  }
  async report(q: PlatformReportQuery, tx: Prisma.TransactionClient) {
    await tx.$executeRaw`SET LOCAL statement_timeout = '4000ms'`;
    const { start, end } = reportInstants(q);
    const generatedAt = new Date().toISOString();
    const [
      branding,
      accounts,
      farms,
      pendingRoleRequests,
      statuses,
      tiers,
      rates,
      created,
      orders,
      orderMonths,
      support,
      consultations,
    ] = await Promise.all([
      this.settings(tx),
      tx.user.count({ where: { deletedAt: null } }),
      tx.farm.count({ where: { deletedAt: null } }),
      tx.roleUpgradeRequest.count({ where: { status: "PENDING" } }),
      tx.$queryRaw<
        CountRow[]
      >`SELECT status::text, count(*)::bigint AS count FROM subscriptions GROUP BY status ORDER BY status`,
      tx.$queryRaw<
        Array<{ tier: string; count: bigint }>
      >`SELECT p.tier::text, count(*)::bigint AS count FROM subscriptions s JOIN subscription_plans p ON p.id=s.plan_id GROUP BY p.tier ORDER BY p.tier`,
      // Same >60 day annual inference and per-subscription rounding as the existing calculator.
      tx.$queryRaw<
        Array<{ amount: Prisma.Decimal }>
      >`SELECT COALESCE(sum(CASE WHEN current_period_end-current_period_start > interval '60 days' THEN round(p.price_annual_cents::numeric/12) ELSE p.price_monthly_cents END),0) AS amount FROM subscriptions s JOIN subscription_plans p ON p.id=s.plan_id WHERE s.status='ACTIVE'`,
      tx.$queryRaw<
        Array<{ period: string; count: bigint }>
      >`SELECT to_char(created_at AT TIME ZONE ${q.timezone},'YYYY-MM') AS period, count(*)::bigint AS count FROM subscriptions WHERE created_at >= ${start} AND created_at < ${end} GROUP BY period ORDER BY period LIMIT 13`,
      tx.$queryRaw<
        MoneyRow[]
      >`SELECT currency, status::text, count(*)::bigint AS count, sum(total_cents::bigint) AS "totalMinor" FROM orders WHERE created_at >= ${start} AND created_at < ${end} GROUP BY currency,status ORDER BY currency,status LIMIT 1001`,
      tx.$queryRaw<
        MoneyRow[]
      >`SELECT to_char(created_at AT TIME ZONE ${q.timezone},'YYYY-MM') AS period, currency, status::text, count(*)::bigint AS count, sum(total_cents::bigint) AS "totalMinor" FROM orders WHERE created_at >= ${start} AND created_at < ${end} GROUP BY period,currency,status ORDER BY period,currency,status LIMIT 13001`,
      tx.$queryRaw<
        CountRow[]
      >`SELECT status, count(*)::bigint AS count FROM support_tickets GROUP BY status ORDER BY status`,
      tx.$queryRaw<
        CountRow[]
      >`SELECT status::text, count(*)::bigint AS count FROM consultations GROUP BY status ORDER BY status`,
    ]);
    const { version: _version, updatedAt: _updatedAt, ...fields } = branding;
    return platformReportSchema.parse({
      schemaVersion: 1,
      generatedAt,
      range: {
        ...q,
        startInstant: start.toISOString(),
        endInstant: end.toISOString(),
      },
      branding: fields,
      totals: { accounts, farms, pendingRoleRequests },
      subscriptions: {
        status: counts(statuses),
        tiers: tiers.map((r) => ({ ...r, count: Number(r.count) })),
        estimatedMrr: {
          currency: "USD",
          totalMinor: rates[0].amount.toString(),
          basis: "CURRENT_LOCAL_PLAN_ESTIMATE",
        },
        created: created.map((r) => ({ ...r, count: Number(r.count) })),
      },
      orders: money(orders),
      orderMonths: money(orderMonths),
      support: counts(support),
      consultations: counts(consultations),
    });
  }
  async auditExport(
    q: PlatformAuditQuery,
    superAdmin: boolean,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$executeRaw`SET LOCAL statement_timeout = '4000ms'`;
    const { start, end } = reportInstants(q);
    const items = await tx.auditLog.findMany({
      where: {
        createdAt: { gte: start, lt: end },
        ...(q.cursor ? { id: { gt: q.cursor } } : {}),
        ...(!superAdmin ? { action: { in: operationalAuditActions } } : {}),
        ...(q.action ? { AND: [{ action: q.action }] } : {}),
        ...(q.actorId ? { userId: q.actorId } : {}),
        ...(q.entityId ? { entityId: q.entityId } : {}),
        ...(q.entityType ? { entityType: q.entityType } : {}),
      },
      select: auditMetadataSelect,
      orderBy: { id: "asc" },
      take: q.limit + 1,
    });
    const truncated = items.length > q.limit;
    const safe = items
      .slice(0, q.limit)
      .map(({ userId, createdAt, ...r }) => ({
        ...r,
        actorId: userId,
        createdAt: createdAt.toISOString(),
      }));
    return {
      items: safe,
      truncated,
      nextCursor: truncated ? safe[safe.length - 1].id : null,
    };
  }
}
