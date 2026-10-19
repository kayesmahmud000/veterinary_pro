import { z } from "zod";
import { directoryRows } from "./admin-directory.js";

export const reportTimezones = ["Asia/Dhaka", "UTC"] as const;
const uuid = z.string().uuid();
const instant = z.string().datetime({ offset: true });
const text = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .refine((v) => !/[\u0000-\u001f\u007f]/.test(v));
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const minor = z.string().regex(/^\d{1,30}$/);
const currency = z.string().regex(/^[A-Z]{3}$/);
export const platformSettingsFields = z
  .object({
    organizationBn: text(100),
    organizationEn: text(100),
    supportEmail: z.union([z.literal(""), z.string().trim().email().max(254)]),
    reportTimezone: z.enum(reportTimezones),
  })
  .strict();
export const platformSettingsSchema = platformSettingsFields
  .extend({ version: count, updatedAt: instant.nullable() })
  .strict();
export const platformConfirmation = {
  actorPassword: z.string().min(1).max(128),
  reason: text(500).refine((v) => v.length >= 10),
  confirmed: z.literal(true),
};
export const platformSettingsSaveSchema = platformSettingsFields
  .extend({ ...platformConfirmation, expectedVersion: count })
  .strict();
export type PlatformSettings = z.infer<typeof platformSettingsSchema>;
export type PlatformSettingsSave = z.infer<typeof platformSettingsSaveSchema>;
const day = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((v) => {
    const n = Date.parse(v + "T00:00:00Z");
    return (
      Number.isFinite(n) &&
      new Date(n).toISOString().slice(0, 10) === v &&
      v >= "2000-01-01"
    );
  });
const rangeFields = { from: day, to: day, timezone: z.enum(reportTimezones) };
function validRange(v: { from: string; to: string }) {
  const days = (Date.parse(v.to) - Date.parse(v.from)) / 86400000;
  return days > 0 && days <= 366;
}
export const platformReportQuerySchema = z
  .object(rangeFields)
  .strict()
  .refine(validRange, {
    path: ["to"],
    message: "Choose 1–366 days; end is exclusive.",
  });
export type PlatformReportQuery = z.infer<typeof platformReportQuerySchema>;
const statusCounts = z
  .array(z.object({ status: text(40), count }).strict())
  .max(30);
const moneyRow = z
  .object({ currency, status: text(40), count, totalMinor: minor })
  .strict();
export const platformReportSchema = z
  .object({
    schemaVersion: z.literal(1),
    generatedAt: instant,
    range: z
      .object({ ...rangeFields, startInstant: instant, endInstant: instant })
      .strict(),
    branding: platformSettingsFields,
    totals: z
      .object({ accounts: count, farms: count, pendingRoleRequests: count })
      .strict(),
    subscriptions: z
      .object({
        status: statusCounts,
        tiers: z.array(z.object({ tier: text(40), count }).strict()).max(3),
        estimatedMrr: z
          .object({
            currency: z.literal("USD"),
            totalMinor: minor,
            basis: z.literal("CURRENT_LOCAL_PLAN_ESTIMATE"),
          })
          .strict(),
        created: z
          .array(
            z
              .object({ period: z.string().regex(/^\d{4}-\d{2}$/), count })
              .strict(),
          )
          .max(13),
      })
      .strict(),
    orders: z.array(moneyRow).max(1000),
    orderMonths: z
      .array(moneyRow.extend({ period: z.string().regex(/^\d{4}-\d{2}$/) }))
      .max(13000),
    support: statusCounts,
    consultations: statusCounts,
  })
  .strict();
export type PlatformReport = z.infer<typeof platformReportSchema>;
export const platformReportExportSchema = z
  .object({ ...platformConfirmation, query: platformReportQuerySchema })
  .strict();
export const platformAuditQuerySchema = z
  .object({
    ...rangeFields,
    limit: z.number().int().min(1).max(500).default(500),
    cursor: uuid.optional(),
    actorId: uuid.optional(),
    entityId: uuid.optional(),
    action: text(50).optional(),
    entityType: text(100).optional(),
  })
  .strict()
  .refine(validRange, { path: ["to"] });
export const platformAuditExportSchema = z
  .object({ ...platformConfirmation, query: platformAuditQuerySchema })
  .strict();
export type PlatformAuditQuery = z.infer<typeof platformAuditQuerySchema>;
export const platformReportExportResultSchema = z
  .object({ exportId: uuid, report: platformReportSchema })
  .strict();
export const platformAuditExportResultSchema = z
  .object({
    exportId: uuid,
    generatedAt: instant,
    query: platformAuditQuerySchema,
    items: z.array(directoryRows.audit.strict()).max(500),
    nextCursor: uuid.nullable(),
    truncated: z.boolean(),
  })
  .strict()
  .refine(
    (v) =>
      v.items.length <= v.query.limit &&
      v.truncated === !!v.nextCursor &&
      (!v.nextCursor || v.nextCursor === v.items.at(-1)?.id),
  );
export const platformQueues = [
  "transactional-mail",
  "video-transcode",
  "subscription-dunning",
  "watermark",
  "animal-import",
  "milk-anomaly-detection",
  "vaccine-preventative-reminders",
  "health-incident-escalation",
] as const;
export const platformSystemSchema = z
  .object({
    checkedAt: instant,
    database: z.enum(["UP", "UNAVAILABLE"]),
    redis: z.enum(["UP", "UNAVAILABLE"]),
    queues: z
      .array(
        z
          .object({
            name: z.enum(platformQueues),
            status: z.enum(["OBSERVED", "UNAVAILABLE"]),
            counts: z
              .object({
                waiting: count,
                active: count,
                delayed: count,
                failed: count,
                completed: count,
              })
              .strict()
              .nullable(),
            registeredWorkers: count.nullable(),
          })
          .strict(),
      )
      .length(platformQueues.length),
    roleEmail: z.object({ pending: count, failed: count }).strict().nullable(),
  })
  .strict()
  .refine(
    (v) =>
      new Set(v.queues.map((q) => q.name)).size === platformQueues.length &&
      v.queues.every((q) =>
        q.status === "OBSERVED"
          ? q.counts !== null && q.registeredWorkers !== null
          : q.counts === null && q.registeredWorkers === null,
      ),
  );
export type PlatformSystem = z.infer<typeof platformSystemSchema>;
export const platformDiagnosticSchema = z
  .object({
    ...platformConfirmation,
    requestId: uuid,
    action: z.literal("RUN_DIAGNOSTICS"),
  })
  .strict();
export const platformDiagnosticResultSchema = z
  .object({ requestId: uuid, result: platformSystemSchema })
  .strict();
export const platformIntegrationsSchema = z
  .object({
    checkedAt: instant,
    items: z
      .array(
        z
          .object({
            name: z.enum([
              "EMAIL",
              "STORAGE",
              "STRIPE",
              "VIDEO",
              "SMS",
              "PUSH",
              "CLINICAL",
            ]),
            provider: z.enum([
              "MOCK",
              "RESEND",
              "SES",
              "S3",
              "STRIPE",
              "DAILY",
            ]),
            status: z.enum([
              "MOCK",
              "NOT_CONFIGURED",
              "CONFIGURED_UNVERIFIED",
              "SIMULATED",
              "CREDENTIAL_CHAIN_UNVERIFIED",
            ]),
            fallbackPossible: z.boolean(),
            externalTestAvailable: z.literal(false),
          })
          .strict(),
      )
      .length(7),
  })
  .strict()
  .refine((v) => new Set(v.items.map((i) => i.name)).size === 7);
