"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  UserRole,
  adminConsultationStatuses,
  adminConsultationTypes,
  adminConsultationQuerySchema,
  adminConsultationListSchema,
  adminConsultationDetailSchema,
  adminConsultationCandidatesSchema,
  adminConsultationActionSchema,
  type AdminConsultationDetail,
  type AdminConsultationAction,
} from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import {
  getConsultationMessages,
  consultationLabel,
} from "@/lib/i18n/admin-consultations";
import { workspaceBn, workspaceEn } from "@/lib/i18n/workspace";
import { workspaceRequest } from "@/lib/workspace/client";
import { WorkspaceGate } from "./workspace-gate";
import { useRemote, Field, Confirmation } from "./workspace-ui";
import styles from "./workspace.styles";
type Section = "triage" | "consultations";
function useFormatting() {
  const { locale } = useAuth(),
    language = locale === "bn" ? "bn-BD" : "en-GB";
  return {
    date: (value: string | null) =>
      value
        ? new Intl.DateTimeFormat(language, {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Dhaka",
          }).format(new Date(value))
        : getConsultationMessages(locale).none,
    money: (value: number, currency: string) =>
      new Intl.NumberFormat(language, {
        style: "currency",
        currency,
        currencyDisplay: "code",
      }).format(value / 100),
    number: (value: number) => new Intl.NumberFormat(language).format(value),
  };
}
function ErrorNotice({ code, retry }: { code?: string; retry?: () => void }) {
  const t = getConsultationMessages(useAuth().locale);
  return (
    <div className={styles.error}>
      <p role="alert">
        {code && code in t ? consultationLabel(t, code) : t.unavailable}
      </p>
      {retry && (
        <button
          data-consultation-retry
          className={styles.secondary}
          onClick={retry}
        >
          {t.retry}
        </button>
      )}
    </div>
  );
}
function ConsultationList({ section }: { section: Section }) {
  const auth = useAuth(),
    t = getConsultationMessages(auth.locale),
    f = useFormatting(),
    router = useRouter(),
    pathname = usePathname(),
    params = useSearchParams();
  const raw = params.toString(),
    initialStatus =
      params.get("status") ?? (section === "triage" ? "SUBMITTED" : "");
  const [search, setSearch] = useState(params.get("search") ?? ""),
    [status, setStatus] = useState(initialStatus),
    [type, setType] = useState(params.get("type") ?? ""),
    [cursors, setCursors] = useState<string[]>([]);
  const expectedQuery = useRef<string | null>(null);
  useEffect(() => {
    // Keep the stack only for our own Next/Previous transition. Following a
    // sidebar link or changing URL filters starts a separate result traversal.
    if (expectedQuery.current !== raw) setCursors([]);
    expectedQuery.current = null;
  }, [raw]);
  useEffect(() => {
    setSearch(params.get("search") ?? "");
    setStatus(
      params.get("status") ?? (section === "triage" ? "SUBMITTED" : ""),
    );
    setType(params.get("type") ?? "");
  }, [raw, section, params]);
  const query = new URLSearchParams(raw);
  if (!query.has("status") && section === "triage")
    query.set("status", "SUBMITTED");
  // An explicit empty status means all statuses in the triage workspace too.
  if (query.get("status") === "") query.delete("status");
  if (!query.has("limit")) query.set("limit", "20");
  const parsed = adminConsultationQuerySchema.safeParse(
      Object.fromEntries(query),
    ),
    data = useRemote(
      parsed.success ? `admin/consultations?${query}` : null,
      adminConsultationListSchema,
    );
  function navigate(next: URLSearchParams) {
    expectedQuery.current = next.toString();
    router.replace(`${pathname}?${next}`);
  }
  return (
    <div data-consultation-list={section} className="space-y-6">
      <form
        className={styles.card}
        onSubmit={(event) => {
          event.preventDefault();
          const next = new URLSearchParams({ status });
          if (search.trim()) next.set("search", search.trim());
          if (type) next.set("type", type);
          setCursors([]);
          navigate(next);
        }}
      >
        <div className={styles.grid}>
          <Field name="consultation-search" label={t.search}>
            <input
              id="consultation-search"
              value={search}
              maxLength={100}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
          <Field name="consultation-status" label={t.status}>
            <select
              id="consultation-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">{t.all}</option>
              {adminConsultationStatuses.map((value) => (
                <option key={value} value={value}>
                  {consultationLabel(t, value)}
                </option>
              ))}
            </select>
          </Field>
          <Field name="consultation-type" label={t.type}>
            <select
              id="consultation-type"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">{t.all}</option>
              {adminConsultationTypes.map((value) => (
                <option key={value} value={value}>
                  {consultationLabel(t, value)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className={styles.actions}>
          <button className={styles.primary}>{t.apply}</button>
          <button
            type="button"
            className={styles.secondary}
            disabled={data.loading}
            onClick={data.reload}
          >
            {t.refresh}
          </button>
        </div>
      </form>
      {!parsed.success ? (
        <ErrorNotice code="VALIDATION_FAILED" />
      ) : data.loading ? (
        <p role="status">{t.loading}</p>
      ) : data.code ? (
        <ErrorNotice code={data.code} retry={data.reload} />
      ) : !data.data?.items.length ? (
        <p className={styles.card}>{t.empty}</p>
      ) : (
        <ul className={`${styles.list} ${styles.card}`}>
          {data.data.items.map((row) => (
            <li key={row.id} data-consultation-row>
              <div className="min-w-0 space-y-2 [overflow-wrap:anywhere]">
                <strong>{row.chiefComplaint}</strong>
                <small>
                  {t.farmer}: {row.farmer?.name ?? t.deleted} · {t.vet}:{" "}
                  {row.vet?.name ?? t.deleted}
                </small>
                <small>
                  {consultationLabel(t, row.status)} ·{" "}
                  {consultationLabel(t, row.type)} ·{" "}
                  {f.money(row.feeCents, row.currency)} ·{" "}
                  {consultationLabel(t, row.paymentStatus)}
                </small>
                <small>
                  {t.scheduled}: {f.date(row.scheduledAt)}
                </small>
                <small>{row.id}</small>
              </div>
              <Link
                className={styles.secondary}
                href={`/admin/${section}/${row.id}`}
              >
                {t.details}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.actions}>
        {(cursors.length > 0 || params.has("cursor")) && (
          <button
            data-consultation-previous
            className={styles.secondary}
            disabled={data.loading}
            onClick={() => {
              const next = new URLSearchParams(raw),
                previous = cursors.at(-1);
              if (previous) next.set("cursor", previous);
              else next.delete("cursor");
              setCursors((v) => v.slice(0, -1));
              navigate(next);
            }}
          >
            {t.previous}
          </button>
        )}
        {data.data?.nextCursor && (
          <button
            data-consultation-next
            className={styles.secondary}
            disabled={data.loading}
            onClick={() => {
              const next = new URLSearchParams(raw);
              setCursors((v) => [...v, params.get("cursor") ?? ""]);
              next.set("cursor", data.data!.nextCursor!);
              navigate(next);
            }}
          >
            {t.next}
          </button>
        )}
      </div>
    </div>
  );
}
function Facts({ row }: { row: AdminConsultationDetail }) {
  const t = getConsultationMessages(useAuth().locale),
    f = useFormatting();
  const identity = (value: { id: string; name: string } | null) =>
    value ? `${value.name} · ${value.id}` : t.deleted;
  const pairs: Array<[string, ReactNode]> = [
    [t.complaint, row.chiefComplaint],
    [t.status, consultationLabel(t, row.status)],
    [t.type, consultationLabel(t, row.type)],
    [t.farmer, identity(row.farmer)],
    [t.vet, identity(row.vet)],
    [t.farm, identity(row.farm)],
    [
      t.animal,
      row.animal
        ? `${row.animal.name ?? t.none} · ${row.animal.tagNumber} · ${row.animal.species} · ${row.animal.id}`
        : t.deleted,
    ],
    [t.fee, f.money(row.feeCents, row.currency)],
    [t.payment, consultationLabel(t, row.paymentStatus)],
    [t.scheduled, f.date(row.scheduledAt)],
    [t.assigned, f.date(row.assignedAt)],
    [t.created, f.date(row.createdAt)],
    [t.updated, f.date(row.updatedAt)],
  ];
  return (
    <dl className={`${styles.details} ${styles.card}`}>
      {pairs.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
function SupportForm({
  row,
  refreshing,
  onReload,
  onSaved,
}: {
  row: AdminConsultationDetail;
  refreshing: boolean;
  onReload: () => void;
  onSaved: (value: AdminConsultationDetail) => void;
}) {
  const auth = useAuth(),
    t = getConsultationMessages(auth.locale),
    common = auth.locale === "bn" ? workspaceBn : workspaceEn,
    f = useFormatting();
  const candidates = useRemote(
    row.allowedActions.some((a) => a === "ASSIGN" || a === "AUTO_ASSIGN")
      ? `admin/consultations/${row.id}/candidates`
      : null,
    adminConsultationCandidatesSchema,
  );
  const [action, setAction] = useState<AdminConsultationAction["action"]>(
      row.allowedActions[0] ?? "CANCEL",
    ),
    [vetId, setVetId] = useState(""),
    [reason, setReason] = useState(""),
    [password, setPassword] = useState(""),
    [pending, setPending] = useState(false),
    [confirm, setConfirm] = useState(false),
    [code, setCode] = useState(""),
    [blocked, setBlocked] = useState(false);
  const saving = useRef(false),
    mounted = useRef(true),
    lastRevision = useRef(row.revision);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (lastRevision.current !== row.revision) {
      lastRevision.current = row.revision;
      setBlocked(false);
      setCode("");
      setConfirm(false);
      setPassword("");
    }
  }, [row.revision]);
  useEffect(() => {
    if (auth.checking || auth.error) {
      setPassword("");
      setConfirm(false);
    }
  }, [auth.checking, auth.error]);
  const selected = candidates.data?.items.find(
      (candidate) => candidate.vetId === vetId,
    ),
    eligible = candidates.data?.items.some((candidate) => candidate.isEligible);
  function input() {
    return adminConsultationActionSchema.safeParse({
      action,
      expectedRevision: row.revision,
      reason,
      actorPassword: password,
      ...(action === "ASSIGN" ? { vetId } : {}),
    });
  }
  const actionAvailable =
    row.allowedActions.includes(action) &&
    (action === "CANCEL" ||
      (!candidates.loading &&
        !candidates.code &&
        (action === "ASSIGN" ? selected?.isEligible : eligible)));
  async function submit() {
    if (saving.current || blocked || refreshing || !actionAvailable) return;
    const parsed = input();
    if (!parsed.success) {
      setConfirm(false);
      setCode("VALIDATION_FAILED");
      return;
    }
    saving.current = true;
    setPending(true);
    setCode("");
    setPassword("");
    const result = await workspaceRequest(
      `admin/consultations/${row.id}/actions`,
      adminConsultationDetailSchema,
      "POST",
      parsed.data,
    );
    saving.current = false;
    if (!mounted.current) return;
    setPending(false);
    setConfirm(false);
    if (result.data) {
      setReason("");
      setVetId("");
      onSaved(result.data);
      candidates.reload();
    } else {
      const next = result.code ?? "UNAVAILABLE";
      setCode(next);
      if (
        [
          "CONSULTATION_VERSION_CONFLICT",
          "CONSULTATION_ACTION_UNAVAILABLE",
          "TIMEOUT",
          "UNAVAILABLE",
        ].includes(next)
      )
        setBlocked(true);
    }
  }
  function reload() {
    setPassword("");
    setConfirm(false);
    candidates.reload();
    onReload();
  }
  // A completed explicit reload permits a new review even if the server revision is unchanged.
  const wasRefreshing = useRef(false);
  useEffect(() => {
    if (wasRefreshing.current && !refreshing) {
      setBlocked(false);
      setCode("");
    }
    wasRefreshing.current = refreshing;
  }, [refreshing]);
  return (
    <section className={`${styles.card} space-y-5`} data-consultation-support>
      <h2>{t.action}</h2>
      <p>{t.assignmentHint}</p>
      <p>{t.cancellationHint}</p>
      <p className="text-sm text-muted">{t.reconciliation}</p>
      {row.allowedActions.some((a) => a !== "CANCEL") && (
        <section data-consultation-candidates aria-busy={candidates.loading}>
          <h3>{t.candidates}</h3>
          {candidates.loading ? (
            <p role="status">{t.loading}</p>
          ) : candidates.code ? (
            <ErrorNotice code={candidates.code} retry={candidates.reload} />
          ) : (
            <>
              {!eligible && <p>{t.noCandidates}</p>}
              <ul className={styles.list}>
                {candidates.data?.items.map((candidate) => (
                  <li
                    data-consultation-candidate={candidate.vetId}
                    key={candidate.vetId}
                  >
                    <div className="min-w-0">
                      <strong>{candidate.name}</strong>
                      <small className="break-all">{candidate.vetId}</small>
                      <small>
                        {t.specialties}:{" "}
                        {candidate.specialties.join(", ") || t.none}
                      </small>
                      <small>
                        {t.availability}: {candidate.isAvailable ? t.yes : t.no}{" "}
                        · {t.workload}: {f.number(candidate.currentActiveCases)}{" "}
                        / {f.number(candidate.maxActiveCases)} · {t.score}:{" "}
                        {f.number(candidate.totalScore)}
                      </small>
                      <small>
                        {candidate.isEligible
                          ? t.eligible
                          : consultationLabel(
                              t,
                              candidate.ineligibilityReason ?? "UNAVAILABLE",
                            )}
                      </small>
                    </div>
                  </li>
                ))}
              </ul>
              {candidates.data?.truncated && <p>{t.candidateLimit}</p>}
              <button
                type="button"
                className={styles.secondary}
                onClick={candidates.reload}
              >
                {t.refresh}
              </button>
            </>
          )}
        </section>
      )}
      {!row.allowedActions.length ? (
        <p>{t.readonly}</p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setCode("");
            if (!input().success || !actionAvailable)
              setCode("VALIDATION_FAILED");
            else if (!blocked && !refreshing) setConfirm(true);
          }}
        >
          <fieldset
            disabled={pending || refreshing}
            className={`${styles.formFields} space-y-5`}
          >
            <Field name="consultation-action" label={t.action}>
              <select
                id="consultation-action"
                value={action}
                onChange={(e) => {
                  setAction(
                    e.target.value as AdminConsultationAction["action"],
                  );
                  setPassword("");
                  setConfirm(false);
                }}
              >
                {row.allowedActions.map((value) => (
                  <option key={value} value={value}>
                    {consultationLabel(t, value)}
                  </option>
                ))}
                {!row.allowedActions.includes(action) && (
                  <option value={action} disabled>
                    {consultationLabel(t, action)}
                  </option>
                )}
              </select>
            </Field>
            {action === "ASSIGN" && (
              <Field name="consultation-vet" label={t.vet}>
                <select
                  id="consultation-vet"
                  required
                  value={vetId}
                  onChange={(e) => setVetId(e.target.value)}
                >
                  <option value="">{t.choose}</option>
                  {candidates.data?.items.map((candidate) => (
                    <option
                      key={candidate.vetId}
                      value={candidate.vetId}
                      disabled={!candidate.isEligible}
                    >
                      {candidate.name} · {candidate.vetId.slice(-8)}
                      {!candidate.isEligible
                        ? ` · ${consultationLabel(t, candidate.ineligibilityReason ?? "UNAVAILABLE")}`
                        : ""}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field name="consultation-reason" label={t.reason}>
              <textarea
                id="consultation-reason"
                rows={3}
                required
                minLength={5}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <Field name="consultation-password" label={t.password}>
              <input
                id="consultation-password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {code && <ErrorNotice code={code} />}
            {blocked && (
              <button
                type="button"
                data-consultation-reload
                className={styles.secondary}
                onClick={reload}
              >
                {t.refresh}
              </button>
            )}
            <button
              className={styles.primary}
              disabled={pending || blocked || !actionAvailable}
            >
              {pending ? t.saving : t.review}
            </button>
          </fieldset>
        </form>
      )}
      {confirm && (
        <Confirmation
          confirmAttributes={{ "data-consultation-confirm": true }}
          title={t.confirm}
          t={common}
          pending={pending}
          confirm={() => void submit()}
          cancel={() => {
            setConfirm(false);
            setPassword("");
          }}
        >
          <p>{row.chiefComplaint}</p>
          <p className="break-all">{row.id}</p>
          <p>
            {consultationLabel(t, action)} ·{" "}
            {action === "ASSIGN"
              ? `${selected?.name ?? t.none} · ${selected?.vetId ?? vetId}`
              : action === "AUTO_ASSIGN"
                ? t.assignmentHint
                : (row.vet?.name ?? t.none)}
          </p>
          <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
            {reason.trim()}
          </p>
          <p>{action === "CANCEL" ? t.cancellationHint : t.assignmentHint}</p>
        </Confirmation>
      )}
    </section>
  );
}
function ConsultationRecord({ section, id }: { section: Section; id: string }) {
  const t = getConsultationMessages(useAuth().locale),
    f = useFormatting(),
    remote = useRemote(
      `admin/consultations/${id}`,
      adminConsultationDetailSchema,
    );
  const [snapshot, setSnapshot] = useState<AdminConsultationDetail>(),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    if (remote.data) setSnapshot(remote.data);
  }, [remote.data]);
  const row = remote.data ?? snapshot;
  function reload() {
    setSaved(false);
    remote.reload();
  }
  if (!row)
    return remote.loading ? (
      <p role="status">{t.loading}</p>
    ) : (
      <ErrorNotice code={remote.code} retry={remote.reload} />
    );
  return (
    <div data-consultation-detail className="space-y-6">
      <Link className={styles.secondary} href={`/admin/${section}`}>
        {t.back}
      </Link>
      <p className="break-all text-sm text-muted">{id}</p>
      {saved && (
        <p data-consultation-saved role="status">
          {t.saved}
        </p>
      )}
      {remote.loading && <p role="status">{t.loading}</p>}
      {remote.code && <ErrorNotice code={remote.code} retry={reload} />}
      <Facts row={row} />
      <SupportForm
        row={row}
        refreshing={remote.loading || !!remote.code}
        onReload={reload}
        onSaved={(value) => {
          setSnapshot(value);
          setSaved(true);
          remote.reload();
        }}
      />
      <section className={styles.card}>
        <h2>{t.history}</h2>
        {!row.history.length ? (
          <p>{t.noHistory}</p>
        ) : (
          <ol className="space-y-4 pl-5">
            {row.history.map((event) => (
              <li key={event.id}>
                <strong>{consultationLabel(t, event.action)}</strong>
                <p>
                  {event.actor?.name ?? t.deleted} · {f.date(event.createdAt)}{" "}
                  (Asia/Dhaka)
                </p>
                {event.reason && (
                  <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                    {event.reason}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
        {row.historyTruncated && <p>{t.truncated}</p>}
      </section>
      <section className={styles.card}>
        <h2>{t.notifications}</h2>
        <p>{t.notificationHint}</p>
        {!row.notifications.length ? (
          <p>{t.noHistory}</p>
        ) : (
          <ul className={styles.list}>
            {row.notifications.map((event) => (
              <li key={event.id}>
                <div>
                  <strong>
                    {consultationLabel(t, event.channel)} ·{" "}
                    {consultationLabel(t, event.status)}
                  </strong>
                  <small>{f.date(event.dispatchedAt)} (Asia/Dhaka)</small>
                  <small>
                    {t.read}: {f.date(event.readAt)}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        )}
        {row.notificationsTruncated && <p>{t.truncated}</p>}
      </section>
      <button
        data-consultation-refresh
        className={styles.secondary}
        disabled={remote.loading}
        onClick={reload}
      >
        {t.refresh}
      </button>
    </div>
  );
}
export function AdminConsultations({
  section,
  id,
}: {
  section: Section;
  id?: string;
}) {
  const t = getConsultationMessages(useAuth().locale);
  return (
    <main id="main-content" className={styles.shell}>
      <h1 className={styles.heading}>{t[section]}</h1>
      <WorkspaceGate allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
        <p className="text-muted">{t.intro}</p>
        <nav aria-label={t.operations} className={`${styles.actions} mb-6`}>
          {(["triage", "consultations"] as const).map((value) => (
            <Link
              key={value}
              href={`/admin/${value}`}
              className={styles.secondary}
              aria-current={value === section ? "page" : undefined}
            >
              {t[value]}
            </Link>
          ))}
        </nav>
        {id ? (
          <ConsultationRecord key={id} section={section} id={id} />
        ) : (
          <ConsultationList key={section} section={section} />
        )}
      </WorkspaceGate>
    </main>
  );
}
