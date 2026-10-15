"use client";
import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { z } from "zod";
import {
  directoryQueries,
  directoryLists,
  directoryDetails,
  UserRole,
  UserStatus,
  FarmType,
  type DirectoryKind,
} from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import {
  getDirectoryMessages,
  type DirectoryMessages,
} from "@/lib/i18n/admin-directory";
import { WorkspaceGate } from "./workspace-gate";
import { useRemote, Field } from "./workspace-ui";
import { AdminAccountActions } from "./admin-account-actions";
import styles from "./workspace.styles";
const roles = [UserRole.ADMIN, UserRole.SUPER_ADMIN];
const root = (kind: DirectoryKind) => `/admin/${kind}`;
function value(t: DirectoryMessages, v: string) {
  return (t.values as Record<string, string>)[v] ?? v;
}
function ErrorState({ code, retry }: { code?: string; retry: () => void }) {
  const t = getDirectoryMessages(useAuth().locale);
  return (
    <div className={styles.error}>
      <p role="alert">{code === "NOT_FOUND" ? t.missing : t.unavailable}</p>
      <button className={styles.secondary} onClick={retry}>
        {t.retry}
      </button>
    </div>
  );
}
function DirectoryList({ kind }: { kind: DirectoryKind }) {
  const auth = useAuth(),
    t = getDirectoryMessages(auth.locale),
    [filter, setFilter] = useState<Record<string, string>>({}),
    [applied, setApplied] = useState(""),
    [cursors, setCursors] = useState<string[]>([""]),
    [code, setCode] = useState("");
  const cursor = cursors[cursors.length - 1];
  const schema = directoryLists[kind] as z.ZodType<{
    items: Array<{
      id: string;
      name?: string;
      email?: string;
      role?: string;
      status?: string;
      country?: string;
      farmType?: string;
      action?: string;
      entityType?: string;
      createdAt: string;
    }>;
    nextCursor: string | null;
  }>;
  const data = useRemote(
    `admin/directory/${kind}?limit=20${applied ? `&${applied}` : ""}${cursor ? `&cursor=${cursor}` : ""}`,
    schema,
  );
  const date = (v: string) =>
    new Intl.DateTimeFormat(auth.locale === "bn" ? "bn-BD" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Dhaka",
    }).format(new Date(v));
  function change(key: string, v: string) {
    setFilter((f) => ({ ...f, [key]: v }));
  }
  function apply(e: FormEvent) {
    e.preventDefault();
    const query: Record<string, string> = {};
    for (const [key, v] of Object.entries(filter))
      if (v.trim())
        query[key] =
          key === "from" || key === "to"
            ? new Date(`${v}:00+06:00`).toISOString()
            : v.trim();
    const parsed = directoryQueries[kind].safeParse(query);
    if (!parsed.success) {
      setCode("VALIDATION_FAILED");
      return;
    }
    setApplied(new URLSearchParams(query).toString());
    setCursors([""]);
    setCode("");
  }
  const text = (key: string, label: string, type = "text", max = 100) => (
    <Field key={key} name={`directory-${key}`} label={label}>
      <input
        id={`directory-${key}`}
        type={type}
        maxLength={max}
        value={filter[key] ?? ""}
        onChange={(e) => change(key, e.target.value)}
      />
    </Field>
  );
  const select = (key: string, label: string, options: string[]) => (
    <Field key={key} name={`directory-${key}`} label={label}>
      <select
        id={`directory-${key}`}
        value={filter[key] ?? ""}
        onChange={(e) => change(key, e.target.value)}
      >
        <option value="">{t.all}</option>
        {options.map((v) => (
          <option key={v} value={v}>
            {value(t, v)}
          </option>
        ))}
      </select>
    </Field>
  );
  return (
    <div data-admin-directory={kind} className="space-y-6">
      <p>{kind === "audit" ? t.redacted : t.intro}</p>
      <form className={styles.card} onSubmit={apply}>
        <div className={styles.grid}>
          {kind === "audit" ? (
            <>
              {text("actorId", t.actorId)}
              {text("entityId", t.entityId)}
              {text("action", t.auditAction, "text", 50)}
              {text("entityType", t.entityType)}
              {text("from", t.from, "datetime-local")}
              {text("to", t.to, "datetime-local")}
            </>
          ) : (
            <>
              {text("search", kind === "farms" ? t.farmSearch : t.search)}
              {kind === "users" &&
                select("role", t.role, Object.values(UserRole))}
              {kind !== "farms" &&
                select("status", t.status, Object.values(UserStatus))}
              {kind === "farms" &&
                select("farmType", t.farmType, Object.values(FarmType))}
            </>
          )}
        </div>
        <div className={styles.actions}>
          <button className={styles.primary} type="submit">
            {t.apply}
          </button>
        </div>
        {code && <p role="alert">{t.errors.VALIDATION_FAILED}</p>}
      </form>
      {data.loading ? (
        <p role="status">{t.loading}</p>
      ) : data.code ? (
        <ErrorState code={data.code} retry={data.reload} />
      ) : !data.data?.items.length ? (
        <p role="status">{t.empty}</p>
      ) : (
        <section className={styles.card}>
          <ul className={styles.list}>
            {data.data.items.map((row) => (
              <li key={row.id} data-directory-row>
                <div className="min-w-0 [overflow-wrap:anywhere]">
                  <strong>{row.name ?? value(t, row.action ?? "")}</strong>
                  {row.email && <small>{row.email}</small>}
                  <small>
                    {[
                      row.role,
                      row.status,
                      row.farmType,
                      row.country,
                      row.entityType,
                    ]
                      .filter(Boolean)
                      .map((v) => value(t, v!))
                      .join(" · ")}
                  </small>
                  {kind === "audit" && (
                    <small>
                      {date(row.createdAt)} · {t.time}
                    </small>
                  )}
                </div>
                <Link
                  className={styles.secondary}
                  href={`${root(kind)}/${row.id}`}
                >
                  {t.details}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className={styles.actions}>
        <button
          className={styles.secondary}
          disabled={data.loading}
          onClick={data.reload}
        >
          {t.retry}
        </button>
        {cursors.length > 1 && (
          <button
            className={styles.secondary}
            disabled={data.loading}
            onClick={() => setCursors((c) => c.slice(0, -1))}
          >
            {t.previous}
          </button>
        )}
        {data.data?.nextCursor && (
          <button
            data-directory-next
            className={styles.secondary}
            disabled={data.loading}
            onClick={() => setCursors((c) => [...c, data.data!.nextCursor!])}
          >
            {t.next}
          </button>
        )}
      </div>
    </div>
  );
}
function DirectoryDetail({ kind, id }: { kind: DirectoryKind; id: string }) {
  const auth = useAuth(),
    t = getDirectoryMessages(auth.locale),
    [feedback, setFeedback] = useState("");
  // Each union branch is narrowed by its directory kind before presentation.
  const detail = useRemote(
    `admin/directory/${kind}/${id}`,
    directoryDetails[kind] as z.ZodTypeAny,
  );
  const row = detail.data as
    | (z.infer<typeof directoryDetails.users> &
        z.infer<typeof directoryDetails.veterinarians> &
        z.infer<typeof directoryDetails.farms> &
        z.infer<typeof directoryDetails.audit>)
    | undefined;
  const date = (v: string) =>
    new Intl.DateTimeFormat(auth.locale === "bn" ? "bn-BD" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Dhaka",
    }).format(new Date(v));
  const number = (v: number) =>
    new Intl.NumberFormat(auth.locale === "bn" ? "bn-BD" : "en-GB").format(v);
  const item = (label: string, content: ReactNode) => (
    <div key={label}>
      <dt>{label}</dt>
      <dd className="[overflow-wrap:anywhere]">{content ?? "—"}</dd>
    </div>
  );
  return (
    <div className="space-y-6" data-admin-detail={kind}>
      <Link className={styles.secondary} href={root(kind)}>
        {t.back}
      </Link>
      {feedback && (
        <p role={feedback === "SAVED" ? "status" : "alert"}>
          {feedback === "SAVED"
            ? t.saved
            : ((t.errors as Record<string, string>)[feedback] ??
              t.errors.DEFAULT)}
        </p>
      )}
      {detail.loading ? (
        <p role="status">{t.loading}</p>
      ) : detail.code || !row ? (
        <ErrorState code={detail.code} retry={detail.reload} />
      ) : (
        <>
          <section className={styles.card}>
            <h2>{row.name ?? value(t, row.action)}</h2>
            <dl className={styles.details}>
              {kind === "users" || kind === "veterinarians" ? (
                <>
                  {item(t.email, row.email)}
                  {item(t.role, value(t, row.role))}
                  {item(t.status, value(t, row.status))}
                  {item(t.createdAt, date(row.createdAt))}
                  {item(t.farmCount, number(row.farmCount))}
                  {item(t.applicationCount, number(row.applicationCount))}
                  {item(t.orderCount, number(row.orderCount))}
                </>
              ) : kind === "farms" ? (
                <>
                  {item(t.farmType, value(t, row.farmType))}
                  {item(t.country, row.country)}
                  {item(
                    t.owner,
                    row.owner ? (
                      <Link href={`/admin/users/${row.owner.id}`}>
                        {row.owner.name}
                      </Link>
                    ) : (
                      t.missing
                    ),
                  )}
                  {item(t.memberCount, number(row.memberCount))}
                  {item(t.animalCount, number(row.animalCount))}
                  {item(t.createdAt, date(row.createdAt))}
                </>
              ) : (
                <>
                  {item(t.actorId, row.actorId)}
                  {item(t.auditAction, value(t, row.action))}
                  {item(t.entityType, row.entityType)}
                  {item(t.entityId, row.entityId)}
                  {item(t.traceId, row.traceId)}
                  {item(t.time, date(row.createdAt))}
                </>
              )}
            </dl>
          </section>
          {(kind === "users" || kind === "veterinarians") && (
            <>
              <section className={styles.card}>
                <h2>{t.relatedFarms}</h2>
                {!row.farms.length ? (
                  <p>{t.empty}</p>
                ) : (
                  <ul className={styles.list}>
                    {row.farms.map((f) => (
                      <li key={`${f.id}-${f.relation}`}>
                        <Link href={`/admin/farms/${f.id}`}>{f.name}</Link>
                        <span>{value(t, f.relation)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              <section className={styles.card}>
                <h2>{t.applications}</h2>
                {!row.applications.length ? (
                  <p>{t.empty}</p>
                ) : (
                  <ul className={styles.list}>
                    {row.applications.map((a) => (
                      <li key={a.id}>
                        <Link href={`/admin/role-requests/${a.id}`}>
                          {value(t, a.targetRole)}
                        </Link>
                        <span>{value(t, a.status)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
              {kind === "veterinarians" && (
                <section className={styles.card}>
                  <h2>{t.profile}</h2>
                  {row.profile ? (
                    <dl className={styles.details}>
                      {item(t.licenseNumber, row.profile.licenseNumber)}
                      {item(t.specialties, row.profile.specialties.join(", "))}
                      {item(
                        t.isAvailable,
                        row.profile.isAvailable ? t.yes : t.no,
                      )}
                      {item(
                        t.maxActiveCases,
                        number(row.profile.maxActiveCases),
                      )}
                      {item(t.consultationCount, number(row.consultationCount))}
                    </dl>
                  ) : (
                    <p>{t.noProfile}</p>
                  )}
                </section>
              )}
              <AdminAccountActions
                key={`${row.id}:${row.authorizationVersion}`}
                account={row}
                reload={(code) => {
                  setFeedback(code);
                  detail.reload();
                }}
              />
            </>
          )}
          {kind === "farms" && (
            <>
              <section className={styles.card}>
                <h2>{t.members}</h2>
                <p>{t.boundedMembers}</p>
                <ul className={styles.list}>
                  {row.members.map((m) => (
                    <li key={m.userId}>
                      <Link href={`/admin/users/${m.userId}`}>{m.name}</Link>
                      <span>{value(t, m.role)}</span>
                    </li>
                  ))}
                </ul>
              </section>
              <section className={styles.card}>
                <h2>{t.subscription}</h2>
                {row.subscription ? (
                  <dl className={styles.details}>
                    {item(t.status, value(t, row.subscription.status))}
                    {item(t.subscription, row.subscription.plan)}
                    {item(t.periodEnd, date(row.subscription.currentPeriodEnd))}
                  </dl>
                ) : (
                  <p>{t.noSubscription}</p>
                )}
              </section>
            </>
          )}
          {kind === "audit" && (
            <>
              <p>{t.redacted}</p>
              {(["oldValues", "newValues"] as const).map((key) => (
                <section className={styles.card} key={key}>
                  <h2>{t[key]}</h2>
                  <dl className={styles.details}>
                    {Object.entries(row[key] ?? {}).map(([k, v]) =>
                      item(
                        value(t, k),
                        typeof v === "number" ? number(v) : value(t, String(v)),
                      ),
                    )}
                  </dl>
                </section>
              ))}
            </>
          )}
          <button className={styles.secondary} onClick={detail.reload}>
            {t.retry}
          </button>
        </>
      )}
    </div>
  );
}
export function AdminDirectory({
  kind,
  id,
}: {
  kind: DirectoryKind;
  id?: string;
}) {
  const t = getDirectoryMessages(useAuth().locale);
  return (
    <main id="main-content" className={styles.shell}>
      <h1 className={styles.heading}>{t[kind]}</h1>
      <WorkspaceGate allowedRoles={roles}>
        {id ? (
          <DirectoryDetail key={`${kind}:${id}`} kind={kind} id={id} />
        ) : (
          <DirectoryList key={kind} kind={kind} />
        )}
      </WorkspaceGate>
    </main>
  );
}
