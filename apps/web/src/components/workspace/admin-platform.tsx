"use client";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { z } from "zod";
import {
  UserRole,
  platformSettingsSchema,
  platformSettingsSaveSchema,
  platformIntegrationsSchema,
  platformSystemSchema,
  platformDiagnosticSchema,
  platformDiagnosticResultSchema,
  platformReportSchema,
  platformReportExportSchema,
  platformReportExportResultSchema,
  platformAuditExportSchema,
  platformAuditExportResultSchema,
  reportTimezones,
  type PlatformSettings,
  type PlatformReport,
  type PlatformSystem,
} from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import { workspaceRequest } from "@/lib/workspace/client";
import {
  platformMessages,
  platformLabel,
  platformError,
} from "@/lib/i18n/admin-platform";
import { workspaceBn, workspaceEn } from "@/lib/i18n/workspace";
import { formatReportAmount } from "@/lib/i18n/report-amount";
import { validateReportRange, type ReportRangeIssues } from "@/lib/workspace/report-range";
import { WorkspaceGate } from "./workspace-gate";
import { Confirmation, Field, useRemote } from "./workspace-ui";
import { useUnsavedChanges } from "./use-unsaved-changes";
import styles from "./workspace.styles";
const roles = [UserRole.ADMIN, UserRole.SUPER_ADMIN];
function useCopy() {
  const auth = useAuth(),
    t = platformMessages(auth.locale);
  return {
    auth,
    t,
    label: (v: string) => platformLabel(auth.locale, v),
    number: (v: number | string) =>
      new Intl.NumberFormat(auth.locale === "bn" ? "bn-BD" : "en-GB").format(
        typeof v === "string" ? BigInt(v) : v,
      ),
  };
}
function Feedback({ code }: { code?: string }) {
  const { auth } = useCopy();
  return code ? (
    <p role="alert" className={styles.error}>
      {platformError(auth.locale, code)}
    </p>
  ) : null;
}
function Frame({
  kind,
  children,
}: {
  kind: "settings" | "integrations" | "system" | "metrics" | "reports";
  children: ReactNode;
}) {
  const { auth, t } = useCopy();
  return (
    <main id="main-content" className={styles.shell}>
      <WorkspaceGate
        allowedRoles={
          ["metrics", "reports"].includes(kind) ? roles : [UserRole.SUPER_ADMIN]
        }
      >
        <div className="space-y-6" data-platform={kind}>
          <h1 className={styles.heading}>{t[kind]}</h1>
          <nav aria-label={t.reports} className="flex flex-wrap gap-3">
            {(
              [
                "metrics",
                "reports",
                ...(auth.user?.role === UserRole.SUPER_ADMIN
                  ? ["settings", "integrations", "system"]
                  : []),
              ] as const
            ).map((k) => (
              <Link
                key={k}
                className={styles.secondary}
                href={
                  k === "integrations"
                    ? "/admin/settings/integrations"
                    : `/admin/${k}`
                }
              >
                {t[k as keyof typeof t]}
              </Link>
            ))}
          </nav>
          {children}
        </div>
      </WorkspaceGate>
    </main>
  );
}
function Action<T>({
  title,
  path,
  input,
  schema,
  response,
  saved,
  reload,
  children,
  disabled,
  onPending,
}: {
  title: string;
  path: string;
  input: Record<string, unknown>;
  schema: z.ZodTypeAny;
  response: z.ZodType<T, any, any>;
  saved: (value: T) => void;
  reload: () => void;
  children?: ReactNode;
  disabled?: boolean;
  onPending?: (pending: boolean) => void;
}) {
  const { auth, t } = useCopy(),
    id = useId();
  const [password, setPassword] = useState(""),
    [reason, setReason] = useState(""),
    [code, setCode] = useState(""),
    [confirm, setConfirm] = useState(false),
    [pending, setPending] = useState(false),
    [blocked, setBlocked] = useState(false);
  const busy = useRef(false),
    alive = useRef(true),
    inputKey = JSON.stringify(input);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  useEffect(() => {
    setPassword("");
    setConfirm(false);
  }, [auth.checking, auth.error, inputKey]);
  const actor = auth.user
    ? `${auth.user.id}:${auth.user.role}:${auth.user.roleVersion ?? 0}`
    : "";
  const value = () =>
    schema.safeParse({
      ...input,
      actorPassword: password,
      reason,
      confirmed: true,
    });
  async function submit() {
    if (
      busy.current ||
      blocked ||
      disabled ||
      auth.checking ||
      auth.error ||
      !actor
    )
      return;
    const parsed = value();
    if (!parsed.success) {
      setCode("VALIDATION_FAILED");
      setConfirm(false);
      return;
    }
    busy.current = true;
    setPending(true);
    onPending?.(true);
    setCode("");
    const r = await workspaceRequest(
      path,
      response,
      "POST",
      parsed.data,
      actor,
    );
    busy.current = false;
    if (!alive.current) return;
    setPassword("");
    setPending(false);
    onPending?.(false);
    setConfirm(false);
    if (r.data) {
      setReason("");
      saved(r.data);
    } else {
      setCode(r.code ?? "UNAVAILABLE");
      if (
        ![
          "PASSWORD_CONFIRMATION_FAILED",
          "VALIDATION_FAILED",
          "RATE_LIMITED",
        ].includes(r.code ?? "")
      )
        setBlocked(true);
    }
  }
  return (
    <section className={`${styles.card} space-y-4`} data-platform-action={path}>
      <h3>{title}</h3>
      {children}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (value().success) setConfirm(true);
          else setCode("VALIDATION_FAILED");
        }}
      >
        <fieldset
          disabled={
            pending || blocked || disabled || auth.checking || !!auth.error
          }
          className={`${styles.formFields} space-y-4`}
        >
          <Field name={`reason-${id}`} label={t.reason}>
            <textarea
              id={`reason-${id}`}
              required
              minLength={10}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <Field name={`password-${id}`} label={t.password}>
            <input
              id={`password-${id}`}
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <button className={styles.primary} type="submit">
            {pending ? t.pending : t.confirm}
          </button>
        </fieldset>
      </form>
      <Feedback code={code} />
      {blocked && (
        <button className={styles.secondary} onClick={reload}>
          {t.refresh}
        </button>
      )}
      {confirm && (
        <Confirmation
          title={title}
          pending={pending}
          confirm={() => void submit()}
          cancel={() => {
            setConfirm(false);
            setPassword("");
          }}
          t={auth.locale === "bn" ? workspaceBn : workspaceEn}
        >
          <p>{reason}</p>
          {children}
        </Confirmation>
      )}
    </section>
  );
}
function SettingsForm({
  record,
  reload,
  saved,
}: {
  record: PlatformSettings;
  reload: () => void;
  saved: () => void;
}) {
  const { auth, t } = useCopy();
  const [pending, setPending] = useState(false);
  const initial = {
    organizationBn: record.organizationBn,
    organizationEn: record.organizationEn,
    supportEmail: record.supportEmail,
    reportTimezone: record.reportTimezone,
  };
  const [fields, setFields] = useState(initial);
  const [baseline, setBaseline] = useState(initial);
  const dirty = (Object.keys(fields) as (keyof typeof fields)[]).some((k) => fields[k] !== baseline[k]);
  const confirmDiscard = useUnsavedChanges(dirty,
    (auth.locale === "bn" ? workspaceBn : workspaceEn).discardUnsaved,
    () => setFields(baseline));
  const reloadSaved = () => { if (confirmDiscard()) reload(); };
  return (
    <>
      <button className={styles.secondary} data-settings-reload disabled={pending} onClick={reloadSaved}>
        {t.refresh}
      </button>
      <p>
        {t.version}: {record.version}
      </p>
      <fieldset
        disabled={pending}
        className={`${styles.formFields} ${styles.grid}`}
      >
        {(["organizationBn", "organizationEn", "supportEmail"] as const).map(
          (k) => (
            <Field key={k} name={k} label={t[k]}>
              <input
                id={k}
                type={k === "supportEmail" ? "email" : "text"}
                maxLength={k === "supportEmail" ? 254 : 100}
                value={fields[k]}
                onChange={(e) => setFields({ ...fields, [k]: e.target.value })}
              />
            </Field>
          ),
        )}
        <Field name="reportTimezone" label={t.reportTimezone}>
          <select
            id="reportTimezone"
            value={fields.reportTimezone}
            onChange={(e) =>
              setFields({
                ...fields,
                reportTimezone: e.target
                  .value as PlatformSettings["reportTimezone"],
              })
            }
          >
            {reportTimezones.map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
        </Field>
      </fieldset>
      <Action
        title={t.save}
        path="admin/platform/settings"
        input={{ ...fields, expectedVersion: record.version }}
        schema={platformSettingsSaveSchema}
        response={platformSettingsSchema}
        saved={() => { setBaseline(fields); saved(); }}
        reload={reloadSaved}
        onPending={setPending}
      >
        <dl className={styles.details}>
          {Object.entries(fields).map(([k, v]) => (
            <div key={k}>
              <dt>{t[k as keyof typeof t]}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </Action>
    </>
  );
}
function Settings() {
  const { t } = useCopy(),
    r = useRemote("admin/platform/settings", platformSettingsSchema),
    [saved, setSaved] = useState(false);
  return (
    <>
      <p>{t.settingsNote}</p>
      {saved && (
        <p role="status" className={styles.notice}>
          {t.saved}
        </p>
      )}
      {!r.data && <button className={styles.secondary} onClick={r.reload}>
        {t.refresh}
      </button>}
      <Feedback code={r.code} />
      {r.loading ? (
        <p role="status">{t.loading}</p>
      ) : (
        r.data && (
          <SettingsForm
            key={r.data.version}
            record={r.data}
            reload={r.reload}
            saved={() => {
              setSaved(true);
              r.reload();
            }}
          />
        )
      )}
    </>
  );
}
export function AdminSettings() {
  return (
    <Frame kind="settings">
      <Settings />
    </Frame>
  );
}
function Integrations() {
  const { t, label } = useCopy(),
    r = useRemote("admin/platform/integrations", platformIntegrationsSchema);
  return (
    <>
      <p>{t.integrationNote}</p>
      <button className={styles.secondary} onClick={r.reload}>
        {t.refresh}
      </button>
      <Feedback code={r.code} />
      {r.loading ? (
        <p role="status">{t.loading}</p>
      ) : (
        r.data && (
          <div className={styles.grid}>
            {r.data.items.map((i) => (
              <article key={i.name} className={styles.card}>
                <h2>{label(i.name)}</h2>
                <p>{i.provider}</p>
                <strong>{label(i.status)}</strong>
                {i.fallbackPossible && <p>{t.fallback}</p>}
              </article>
            ))}
          </div>
        )
      )}
    </>
  );
}
export function AdminIntegrations() {
  return (
    <Frame kind="integrations">
      <Integrations />
    </Frame>
  );
}
function SystemView({ data }: { data: PlatformSystem }) {
  const { t, label, number } = useCopy();
  return (
    <div className="space-y-4">
      <p>
        {t.snapshot}: <time dateTime={data.checkedAt}>{data.checkedAt}</time>{" "}
        (UTC)
      </p>
      <dl className={styles.details}>
        <div>
          <dt>{t.database}</dt>
          <dd>{label(data.database)}</dd>
        </div>
        <div>
          <dt>{t.redis}</dt>
          <dd>{label(data.redis)}</dd>
        </div>
      </dl>
      <h2>{t.queues}</h2>
      <div className={styles.grid}>
        {data.queues.map((q) => (
          <article className={styles.card} key={q.name}>
            <h3 className="break-all">{q.name}</h3>
            <p>{label(q.status)}</p>
            {q.counts && (
              <dl className={styles.details}>
                {Object.entries(q.counts).map(([k, v]) => (
                  <div key={k}>
                    <dt>{t[k as keyof typeof t]}</dt>
                    <dd>{number(v)}</dd>
                  </div>
                ))}
                <div>
                  <dt>{t.workers}</dt>
                  <dd>{number(q.registeredWorkers!)}</dd>
                </div>
              </dl>
            )}
          </article>
        ))}
      </div>
      <h2>{t.roleEmail}</h2>
      {data.roleEmail ? (
        <dl className={styles.details}>
          <div>
            <dt>{t.pendingEmail}</dt>
            <dd>{number(data.roleEmail.pending)}</dd>
          </div>
          <div>
            <dt>{t.failedEmail}</dt>
            <dd>{number(data.roleEmail.failed)}</dd>
          </div>
        </dl>
      ) : (
        <p>{label("UNAVAILABLE")}</p>
      )}
    </div>
  );
}
function System() {
  const { t } = useCopy(),
    r = useRemote("admin/platform/system", platformSystemSchema),
    [record, setRecord] =
      useState<z.infer<typeof platformDiagnosticResultSchema>>(),
    [generation, setGeneration] = useState(0);
  const requestId = useMemo(() => crypto.randomUUID(), [generation]);
  const reload = () => {
    setGeneration((g) => g + 1);
    setRecord(undefined);
    r.reload();
  };
  return (
    <>
      <p>{t.systemNote}</p>
      <button className={styles.secondary} onClick={reload}>
        {t.refresh}
      </button>
      <Feedback code={r.code} />
      {r.loading ? (
        <p role="status">{t.loading}</p>
      ) : (
        (record?.result ?? r.data) && (
          <SystemView data={(record?.result ?? r.data)!} />
        )
      )}
      {record && (
        <p role="status" className={styles.notice}>
          {t.recorded}: {record.requestId}
        </p>
      )}
      <Action
        key={generation}
        title={t.run}
        path="admin/platform/diagnostics"
        schema={platformDiagnosticSchema}
        response={platformDiagnosticResultSchema}
        input={{ requestId, action: "RUN_DIAGNOSTICS" }}
        saved={(v) => {
          setRecord(v);
          setGeneration((g) => g + 1);
        }}
        reload={reload}
        disabled={r.loading}
      >
        <p>{t.diagnosticNote}</p>
      </Action>
    </>
  );
}
export function AdminSystem() {
  return (
    <Frame kind="system">
      <System />
    </Frame>
  );
}
function ReportView({ report }: { report: PlatformReport }) {
  const { auth, t, number, label } = useCopy();
  const statuses = (
    title: string,
    rows: Array<{ status: string; count: number }>,
  ) => (
    <section className={styles.card}>
      <h2>{title}</h2>
      {rows.length ? (
        <dl className={styles.details}>
          {rows.map((r) => (
            <div key={r.status}>
              <dt>{label(r.status)}</dt>
              <dd>{number(r.count)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>{t.empty}</p>
      )}
    </section>
  );
  const amounts = (
    title: string,
    rows: PlatformReport["orders"] | PlatformReport["orderMonths"],
  ) => (
    <section className={styles.card}>
      <h2>{title}</h2>
      {rows.length ? (
        <ul className={`${styles.list} space-y-3`}>
          {rows.map((r, i) => (
            <li key={i} className="flex flex-wrap gap-x-4 gap-y-1">
              <strong>
                {"period" in r ? `${r.period} · ` : ""}
                {r.currency} · {label(r.status)}
              </strong>
              <span>
                {t.count}: {number(r.count)}
              </span>
              <span className="min-w-0 [overflow-wrap:anywhere]">
                {t.amount}: {formatReportAmount(r.totalMinor, r.currency, auth.locale)}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p>{t.empty}</p>
      )}
    </section>
  );
  return (
    <div data-platform-report>
      <section className={styles.card}>
        <h2>
          {auth.locale === "bn"
            ? report.branding.organizationBn
            : report.branding.organizationEn}
        </h2>
        <p>{report.branding.supportEmail}</p>
        <p>
          {t.generated}: {report.generatedAt} (UTC)
        </p>
        <p>
          {t.range}: {report.range.from} → {report.range.to} ·{" "}
          {report.range.timezone}
        </p>
        <p className="break-all">
          {report.range.startInstant} → {report.range.endInstant}
        </p>
      </section>
      <section className={styles.card}>
        <h2>{t.totals}</h2>
        <dl className={styles.details}>
          {Object.entries(report.totals).map(([k, v]) => (
            <div key={k}>
              <dt>{t[k as keyof typeof t]}</dt>
              <dd>{number(v)}</dd>
            </div>
          ))}
        </dl>
      </section>
      <div className={styles.grid}>
        {statuses(t.subscriptions, report.subscriptions.status)}
        {statuses(
          t.tiers,
          report.subscriptions.tiers.map((r) => ({
            status: r.tier,
            count: r.count,
          })),
        )}
      </div>
      <section className={styles.card}>
        <h2>{t.estimatedMrr}</h2>
        <p className="text-2xl font-semibold [overflow-wrap:anywhere]">
          {formatReportAmount(report.subscriptions.estimatedMrr.totalMinor, report.subscriptions.estimatedMrr.currency, auth.locale)}
        </p>
        <p>{t.mrrNote}</p>
      </section>
      {statuses(
        t.created,
        report.subscriptions.created.map((r) => ({
          status: r.period,
          count: r.count,
        })),
      )}
      {amounts(t.orders, report.orders)}
      {amounts(t.orderMonths, report.orderMonths)}
      <div className={styles.grid}>
        {statuses(t.support, report.support)}
        {statuses(t.consultations, report.consultations)}
      </div>
    </div>
  );
}
function initialRange(timezone: "Asia/Dhaka" | "UTC") {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const today = ["year", "month", "day"]
    .map((k) => parts.find((p) => p.type === k)!.value)
    .join("-");
  return {
    from: today.slice(0, 7) + "-01",
    to: new Date(Date.parse(today + "T00:00:00Z") + 86400000)
      .toISOString()
      .slice(0, 10),
    timezone,
  };
}
function Reports({ exports }: { exports: boolean }) {
  const { auth, t } = useCopy();
  const [draft, setDraft] = useState(() => initialRange("Asia/Dhaka")),
    [query, setQuery] = useState(draft),
    [issues, setIssues] = useState<ReportRangeIssues>({}),
    [tick, setTick] = useState(0);
  const [audit, setAudit] = useState({
    actorId: "",
    entityId: "",
    action: "",
    entityType: "",
    cursor: "",
    limit: "500",
  });
  const [artifact, setArtifact] = useState<{
    url: string;
    kind: string;
    rows?: number;
    nextCursor?: string | null;
  }>();
  const url = useRef<string>();
  const queryString = new URLSearchParams(query).toString(),
    r = useRemote(
      `admin/platform/reports?${queryString}`,
      platformReportSchema,
    );
  const queryKey = JSON.stringify(query),
    draftKey = JSON.stringify(draft),
    auditKey = JSON.stringify(audit);
  // Report defaults are returned through the report projection for both roles.
  const touched = useRef(false);
  useEffect(() => {
    if (
      r.data &&
      !touched.current &&
      r.data.branding.reportTimezone !== draft.timezone
    ) {
      const initial = initialRange(r.data.branding.reportTimezone);
      setDraft(initial);
      setQuery(initial);
    }
  }, [r.data, draft.timezone]);
  const clear = () => {
    if (url.current) URL.revokeObjectURL(url.current);
    url.current = undefined;
    setArtifact(undefined);
  };
  useEffect(() => {
    clear();
  }, [queryKey, draftKey, auditKey, auth.checking, auth.error]);
  useEffect(
    () => () => {
      if (url.current) URL.revokeObjectURL(url.current);
    },
    [],
  );
  function prepare(
    value: unknown,
    kind: string,
    rows?: number,
    nextCursor?: string | null,
  ) {
    clear();
    url.current = URL.createObjectURL(
      new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
    );
    setArtifact({ url: url.current, kind, rows, nextCursor });
  }
  const reload = () => {
    clear();
    setTick((n) => n + 1);
    r.reload();
  };
  const auditQuery = {
    ...query,
    ...Object.fromEntries(
      Object.entries(audit).filter(([k, v]) => k !== "limit" && v),
    ),
    limit: Number(audit.limit),
  };
  const changed = JSON.stringify(draft) !== JSON.stringify(query);
  const errorMessages = {
    required: t.dateRequired, calendar: t.dateCalendar, order: t.dateOrder,
    length: t.dateLength, future: t.dateFuture, timezone: t.dateTimezone,
  };
  const error = (key: keyof ReportRangeIssues) => issues[key] ? errorMessages[issues[key]!] : undefined;
  function changeRange(next: typeof draft) {
    touched.current = true;
    setDraft(next);
    if (Object.keys(issues).length) {
      const result = validateReportRange(next);
      setIssues(result.success ? {} : result.issues);
    }
  }
  return (
    <>
      <p>{t.reportNote}</p>
      <p>{t.rangeNote}</p>
      <form
        className={styles.card}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          const result = validateReportRange(draft);
          if (!result.success) {
            setIssues(result.issues);
            const first = (["from", "to", "timezone"] as const).find(k => result.issues[k]);
            requestAnimationFrame(() => first && document.getElementById(first)?.focus());
          }
          else {
            touched.current = true;
            setIssues({});
            setQuery(result.data);
            reload();
          }
        }}
      >
        {Object.keys(issues).length > 0 && <p role="alert" data-report-date-errors className={styles.error}>{t.dateValidation}</p>}
        <div className={styles.grid}>
          {(["from", "to"] as const).map((k) => (
            <Field key={k} name={k} label={t[k]} error={error(k)}>
              <input
                id={k}
                required
                type="date"
                aria-invalid={!!issues[k]}
                aria-describedby={issues[k] ? `${k}-error` : undefined}
                value={draft[k]}
                onChange={(e) => {
                  changeRange({ ...draft, [k]: e.target.value });
                }}
              />
            </Field>
          ))}
          <Field name="timezone" label={t.timezone} error={error("timezone")}>
            <select
              id="timezone"
              aria-invalid={!!issues.timezone}
              aria-describedby={issues.timezone ? "timezone-error" : undefined}
              value={draft.timezone}
              onChange={(e) => {
                changeRange({
                  ...draft,
                  timezone: e.target.value as typeof draft.timezone,
                });
              }}
            >
              {reportTimezones.map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </Field>
        </div>
        <button className={`${styles.primary} mt-4`} type="submit">
          {t.apply}
        </button>
      </form>
      {changed && <p role="status" data-report-unapplied className={styles.notice}>{t.unappliedDates}</p>}
      {r.code === "VALIDATION_FAILED" ? <p role="alert" className={styles.error}>{t.dateRejected}</p> : <Feedback code={r.code} />}
      <button className={styles.secondary} onClick={reload}>
        {t.refresh}
      </button>
      {r.loading ? (
        <p role="status">{t.loading}</p>
      ) : (
        r.data && <ReportView report={r.data} />
      )}
      {exports && (
        <>
          <p className={styles.notice}>{t.exportNote}</p>
          <Action
            key={`report-${queryKey}-${draftKey}-${tick}`}
            title={t.exportReport}
            path="admin/platform/reports/export"
            input={{ query }}
            schema={platformReportExportSchema}
            response={platformReportExportResultSchema}
            saved={(v) => prepare(v, "report")}
            reload={reload}
            disabled={r.loading || !r.data || changed}
          >
            <p>
              {query.from} → {query.to} · {query.timezone}
            </p>
          </Action>
          <section className={styles.card}>
            <h2>{t.audit}</h2>
            <div className={styles.grid}>
              {(Object.keys(audit) as Array<keyof typeof audit>).map((k) => (
                <Field key={k} name={`audit-${k}`} label={t[k]}>
                  <input
                    id={`audit-${k}`}
                    type={k === "limit" ? "number" : "text"}
                    min={k === "limit" ? 1 : undefined}
                    max={k === "limit" ? 500 : undefined}
                    maxLength={
                      k === "action" ? 50 : k === "entityType" ? 100 : 36
                    }
                    value={audit[k]}
                    onChange={(e) =>
                      setAudit({ ...audit, [k]: e.target.value })
                    }
                  />
                </Field>
              ))}
            </div>
          </section>
          <Action
            key={`audit-${queryKey}-${draftKey}-${auditKey}-${tick}`}
            title={t.exportAudit}
            path="admin/platform/audit-export"
            input={{ query: auditQuery }}
            schema={platformAuditExportSchema}
            response={platformAuditExportResultSchema}
            saved={(v) => prepare(v, "audit", v.items.length, v.nextCursor)}
            reload={reload}
            disabled={changed}
          >
            <p>
              {query.from} → {query.to} · {query.timezone}
            </p>
          </Action>
          {artifact && (
            <section
              className={`${styles.card} space-y-3`}
              data-platform-artifact
            >
              <a
                className={styles.primary}
                href={artifact.url}
                download={`vetralink-${artifact.kind}-${query.from}-${query.to}.json`}
              >
                {t.download}
              </a>
              {artifact.rows !== undefined && (
                <p>
                  {t.rows}: {artifact.rows}
                </p>
              )}
              {artifact.nextCursor && (
                <>
                  <p>{t.truncated}</p>
                  <p className="break-all">
                    {t.continuation}: <code>{artifact.nextCursor}</code>
                  </p>
                </>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}
export function AdminMetrics() {
  return (
    <Frame kind="metrics">
      <Reports exports={false} />
    </Frame>
  );
}
export function AdminReports() {
  return (
    <Frame kind="reports">
      <Reports exports />
    </Frame>
  );
}
