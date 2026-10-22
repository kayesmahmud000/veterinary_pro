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
import { useRouter } from "next/navigation";
import { z } from "zod";
import {
  UserRole,
  editorialKinds,
  editorialCreateSchema,
  editorialSaveSchema,
  editorialActionSchema,
  editorialListSchema,
  editorialDetailSchema,
  notificationSources,
  notificationStates,
  notificationListSchema,
  notificationRetrySchema,
  notificationRowSchema,
  supportStatuses,
  supportCreateSchema,
  supportReplySchema,
  supportActionSchema,
  supportListSchema,
  supportDetailSchema,
  type EditorialDraft,
  type EditorialDetail,
  type SupportDetail,
} from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import { workspaceRequest } from "@/lib/workspace/client";
import {
  communicationsMessages,
  communicationsLabel,
  communicationsError,
} from "@/lib/i18n/admin-communications";
import { workspaceBn, workspaceEn } from "@/lib/i18n/workspace";
import { WorkspaceGate } from "./workspace-gate";
import { Confirmation, Field } from "./workspace-ui";
import { useUnsavedChanges } from "./use-unsaved-changes";
import { EditorialText } from "../marketing/editorial-text";
import styles from "./workspace.styles";
const roles = [UserRole.ADMIN, UserRole.SUPER_ADMIN];
function useAlive() {
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  return alive;
}
function useCopy() {
  const auth = useAuth();
  return {
    auth,
    t: communicationsMessages(auth.locale),
    label: (v: string) => communicationsLabel(auth.locale, v),
    date: (v: string) =>
      new Intl.DateTimeFormat(auth.locale === "bn" ? "bn-BD" : "en-GB", {
        timeZone: "Asia/Dhaka",
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(v)) + " (Asia/Dhaka)",
    number: (v: number) =>
      new Intl.NumberFormat(auth.locale === "bn" ? "bn-BD" : "en-GB").format(v),
  };
}
function useData<T>(path: string, schema: z.ZodType<T, any, any>) {
  const scope = useRef(path);
  const [data, setData] = useState<T>(),
    [code, setCode] = useState(""),
    [loading, setLoading] = useState(true),
    [tick, setTick] = useState(0);
  useEffect(() => {
    let active = true;
    if (scope.current !== path) {
      setData(undefined);
      scope.current = path;
    }
    setLoading(true);
    setCode("");
    void workspaceRequest(path, schema).then((r) => {
      if (active) {
        if (r.data) setData(r.data);
        else setCode(r.code ?? "UNAVAILABLE");
        setLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, [path, schema, tick]);
  return {
    data: scope.current === path ? data : undefined,
    setData,
    code,
    loading: loading || scope.current !== path,
    reload: () => setTick((n) => n + 1),
  };
}
function Feedback({ code, reload }: { code: string; reload?: () => void }) {
  const { auth, t } = useCopy();
  return code ? (
    <div className={styles.error}>
      <p role="alert">{communicationsError(auth.locale, code)}</p>
      {reload && (
        <button className={styles.secondary} onClick={reload}>
          {t.retry}
        </button>
      )}
    </div>
  ) : null;
}
function Frame({
  kind,
  own,
  children,
}: {
  kind: "content" | "notifications" | "support";
  own?: boolean;
  children: ReactNode;
}) {
  const { t } = useCopy();
  return (
    <main id="main-content" className={styles.shell}>
      <WorkspaceGate allowedRoles={own ? undefined : roles}>
        <div className="space-y-6" data-communications={kind}>
          <h1 className={styles.heading}>{own ? t.ownSupport : t[kind]}</h1>
          <p>
            {kind === "content"
              ? t.intro
              : kind === "notifications"
                ? t.deliveryNote
                : t.ticketNote}
          </p>
          {children}
        </div>
      </WorkspaceGate>
    </main>
  );
}
function ConfirmationForm<T>({
  path,
  inputSchema,
  responseSchema,
  input,
  onSaved,
  onReload,
  disabled,
  title,
  children,
}: {
  path: string;
  inputSchema: z.ZodTypeAny;
  responseSchema: z.ZodType<T, any, any>;
  input: Record<string, unknown>;
  onSaved: (v: T) => void;
  onReload: () => boolean | void;
  disabled?: boolean;
  title: string;
  children?: ReactNode;
}) {
  const alive = useAlive();
  const { auth, t } = useCopy(),
    [password, setPassword] = useState(""),
    [reason, setReason] = useState(""),
    [confirm, setConfirm] = useState(false),
    [pending, setPending] = useState(false),
    [blocked, setBlocked] = useState(false),
    [code, setCode] = useState(""),
    busy = useRef(false),
    mounted = useRef(true);
  const fieldId = useId();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const inputKey = JSON.stringify(input);
  useEffect(() => {
    setPassword("");
    setConfirm(false);
  }, [auth.checking, auth.error, inputKey]);
  const actor = auth.user
    ? `${auth.user.id}:${auth.user.role}:${auth.user.roleVersion ?? 0}`
    : "";
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
    const parsed = inputSchema.safeParse({
      ...input,
      actorPassword: password,
      reason,
      confirmed: true,
    });
    if (!parsed.success) {
      setCode("VALIDATION_FAILED");
      return;
    }
    busy.current = true;
    setPending(true);
    setCode("");
    const r = await workspaceRequest(
      path,
      responseSchema,
      "POST",
      parsed.data,
      actor,
    );
    busy.current = false;
    if (!alive.current) return;
    if (!mounted.current) return;
    setPassword("");
    setPending(false);
    setConfirm(false);
    if (r.data) {
      setReason("");
      onSaved(r.data);
    } else {
      setCode(r.code ?? "UNAVAILABLE");
      if (
        ![
          "PASSWORD_CONFIRMATION_FAILED",
          "VALIDATION_FAILED",
          "VET_VERIFICATION_REQUIRED",
          "CONTENT_INCOMPLETE",
          "RATE_LIMITED",
        ].includes(r.code ?? "")
      )
        setBlocked(true);
    }
  }
  return (
    <section className={`${styles.card} space-y-4`}>
      <h3>{title}</h3>
      {children}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (
            inputSchema.safeParse({
              ...input,
              actorPassword: password,
              reason,
              confirmed: true,
            }).success
          )
            setConfirm(true);
          else setCode("VALIDATION_FAILED");
        }}
      >
        <fieldset
          className={`${styles.formFields} space-y-4`}
          disabled={
            pending || disabled || blocked || auth.checking || !!auth.error
          }
        >
          <Field name={`reason-${fieldId}`} label={t.reason}>
            <textarea
              id={`reason-${fieldId}`}
              required
              minLength={10}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <Field name={`password-${fieldId}`} label={t.password}>
            <input
              id={`password-${fieldId}`}
              required
              type="password"
              maxLength={128}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <button className={styles.primary}>
            {pending ? t.loading : t.review}
          </button>
        </fieldset>
      </form>
      <Feedback code={code} />
      {blocked && (
        <button
          className={styles.secondary}
          onClick={() => {
            if (onReload() === false) return;
            setPassword("");
            setConfirm(false);
            setBlocked(false);
            setCode("");
          }}
        >
          {t.refresh}
        </button>
      )}
      {confirm && (
        <Confirmation
          title={title}
          t={auth.locale === "bn" ? workspaceBn : workspaceEn}
          pending={pending}
          confirm={() => void submit()}
          cancel={() => {
            setPassword("");
            setConfirm(false);
          }}
        >
          <p>{title}</p>
          <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
            {reason}
          </p>
        </Confirmation>
      )}
    </section>
  );
}
function Filters({
  kind,
  onFilter,
}: {
  kind: "content" | "notifications" | "support";
  onFilter: (query: string) => void;
}) {
  const { t, label } = useCopy();
  return (
    <form
      className={`${styles.card} ${styles.formFields} flex flex-wrap items-end gap-4`}
      onSubmit={(e) => {
        e.preventDefault();
        const values = new URLSearchParams();
        new FormData(e.currentTarget).forEach((v, k) => {
          if (v) values.set(k, String(v));
        });
        onFilter(values.toString());
      }}
    >
      {kind !== "notifications" && (
        <Field name="search" label={t.search}>
          <input id="search" name="search" maxLength={100} />
        </Field>
      )}
      {kind === "notifications" && (
        <Field name="source" label={t.source}>
          <select id="source" name="source">
            {notificationSources.map((v) => (
              <option key={v} value={v}>
                {label(v)}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field
        name="filter-status"
        label={kind === "content" ? t.kind : t.status}
      >
        <select
          id="filter-status"
          name={kind === "content" ? "kind" : "status"}
        >
          <option value="">{t.all}</option>
          {(kind === "content"
            ? editorialKinds
            : kind === "support"
              ? supportStatuses
              : notificationStates
          ).map((v) => (
            <option key={v} value={v}>
              {label(v)}
            </option>
          ))}
        </select>
      </Field>
      <button className={styles.secondary}>{t.apply}</button>
    </form>
  );
}
function Pager({
  next,
  change,
}: {
  next: string | null;
  change: (cursor: string) => void;
}) {
  const { t } = useCopy();
  return (
    <div className="flex flex-wrap gap-3">
      <button className={styles.secondary} onClick={() => change("")}>
        {t.first}
      </button>
      {next && (
        <button className={styles.secondary} onClick={() => change(next)}>
          {t.next}
        </button>
      )}
    </div>
  );
}
const blankDraft = (): EditorialDraft => ({
  bn: { title: "", summary: "", body: "" },
  en: { title: "", summary: "", body: "" },
});
function DraftFields({
  draft,
  setDraft,
}: {
  draft: EditorialDraft;
  setDraft: (d: EditorialDraft) => void;
}) {
  const { t } = useCopy();
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {(["bn", "en"] as const).map((language) => (
        <section key={language} lang={language} className="space-y-4">
          <h3>{language === "bn" ? "বাংলা" : "English"}</h3>
          {(["title", "summary", "body"] as const).map((key) => (
            <Field key={key} name={`${language}-${key}`} label={t[key]}>
              {key === "title" ? (
                <input
                  id={`${language}-${key}`}
                  required
                  maxLength={200}
                  value={draft[language][key]}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      [language]: { ...draft[language], [key]: e.target.value },
                    })
                  }
                />
              ) : (
                <textarea
                  id={`${language}-${key}`}
                  rows={key === "body" ? 10 : 3}
                  maxLength={key === "body" ? 20000 : 600}
                  value={draft[language][key]}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      [language]: { ...draft[language], [key]: e.target.value },
                    })
                  }
                />
              )}
            </Field>
          ))}
        </section>
      ))}
    </div>
  );
}
export function AdminContent({ id }: { id?: string }) {
  return (
    <Frame kind="content">
      {id ? <ContentDetail key={id} id={id} /> : <ContentList />}
    </Frame>
  );
}
function ContentList() {
  const alive = useAlive();
  const { auth, t, label } = useCopy(),
    router = useRouter(),
    [query, setQuery] = useState(""),
    [cursor, setCursor] = useState(""),
    [kind, setKind] = useState<(typeof editorialKinds)[number]>("BLOG"),
    [draft, setDraft] = useState(blankDraft),
    [slug, setSlug] = useState(""),
    [subject, setSubject] = useState(""),
    [code, setCode] = useState(""),
    [pending, setPending] = useState(false),
    busy = useRef(false),
    createId = useRef<string>();
  const remote = useData(
    `admin/content?${query}${cursor ? `&cursor=${cursor}` : ""}`,
    editorialListSchema,
  );
  async function create() {
    if (busy.current) return;
    createId.current ??= crypto.randomUUID();
    const parsed = editorialCreateSchema.safeParse({
      id: createId.current,
      kind,
      slug,
      draft,
      ...(kind === "VET" ? { subjectUserId: subject } : {}),
    });
    if (!parsed.success) {
      setCode("VALIDATION_FAILED");
      return;
    }
    busy.current = true;
    setPending(true);
    const result = await workspaceRequest(
      "admin/content",
      editorialDetailSchema,
      "POST",
      parsed.data,
      `${auth.user!.id}:${auth.user!.role}:${auth.user!.roleVersion ?? 0}`,
    );
    busy.current = false;
    if (!alive.current) return;
    setPending(false);
    if (result.data) router.push(`/admin/content/${result.data.id}`);
    else {
      setCode(result.code ?? "UNAVAILABLE");
      if (result.code === "COMMUNICATION_CONFLICT") remote.reload();
    }
  }
  return (
    <>
      <Filters
        kind="content"
        onFilter={(q) => {
          setQuery(q);
          setCursor("");
        }}
      />
      <Feedback code={remote.code} reload={remote.reload} />
      {remote.loading ? (
        <p role="status">{t.loading}</p>
      ) : (
        <section className={`${styles.card} space-y-3`}>
          {remote.data?.items.length ? (
            remote.data.items.map((r) => (
              <p key={r.id}>
                <Link
                  href={`/admin/content/${r.id}`}
                  className={
                    "font-semibold text-green underline underline-offset-4"
                  }
                >
                  {r.title[auth.locale]}
                </Link>{" "}
                · {label(r.kind)} · {r.publishedAt ? t.published : t.draft}
              </p>
            ))
          ) : (
            <p>{t.empty}</p>
          )}
          <Pager next={remote.data?.nextCursor ?? null} change={setCursor} />
        </section>
      )}
      <details className={styles.card}>
        <summary className="cursor-pointer font-semibold">{t.create}</summary>
        <form
          className={`${styles.formFields} mt-5 space-y-5`}
          onSubmit={(e) => {
            e.preventDefault();
            void create();
          }}
        >
          <fieldset
            disabled={pending}
            className={`${styles.formFields} space-y-5`}
          >
            <Field name="create-kind" label={t.kind}>
              <select
                id="create-kind"
                value={kind}
                onChange={(e) => setKind(e.target.value as typeof kind)}
              >
                {editorialKinds.map((v) => (
                  <option key={v} value={v}>
                    {label(v)}
                  </option>
                ))}
              </select>
            </Field>
            <Field name="create-slug" label={t.slug}>
              <input
                id="create-slug"
                required
                minLength={3}
                maxLength={120}
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
              />
            </Field>
            {kind === "VET" && (
              <Field name="create-subject" label={t.subjectUserId}>
                <input
                  id="create-subject"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                />
              </Field>
            )}
            <p>{t.plain}</p>
            <DraftFields draft={draft} setDraft={setDraft} />
            <Feedback code={code} />
            <button className={styles.primary}>
              {pending ? t.loading : t.create}
            </button>
          </fieldset>
        </form>
      </details>
    </>
  );
}
function ContentDetail({ id }: { id: string }) {
  const { t } = useCopy(),
    remote = useData(`admin/content/${id}`, editorialDetailSchema);
  return (
    <>
      <Link
        className={"font-semibold text-green underline underline-offset-4"}
        href="/admin/content"
      >
        {t.back}
      </Link>
      <Feedback code={remote.code} reload={remote.reload} />
      {!remote.data ? (
        remote.code ? null : (
          <p role="status">{t.loading}</p>
        )
      ) : (
        <ContentEditor
          row={remote.data}
          loading={remote.loading || !!remote.code}
          onSaved={remote.setData}
          reload={remote.reload}
        />
      )}
    </>
  );
}
function ContentEditor({
  row,
  loading,
  onSaved,
  reload,
}: {
  row: EditorialDetail;
  loading: boolean;
  onSaved: (r: EditorialDetail) => void;
  reload: () => void;
}) {
  const alive = useAlive();
  const { auth, t, label, number } = useCopy(),
    [draft, setDraft] = useState(row.draft),
    [draftVersion, setDraftVersion] = useState(row.version),
    [code, setCode] = useState(""),
    [pending, setPending] = useState(false),
    [verified, setVerified] = useState(false),
    [note, setNote] = useState(""),
    [blockedSave, setBlockedSave] = useState(false),
    reloadPhase = useRef(0),
    busy = useRef(false);
  useEffect(() => {
    if (reloadPhase.current === 1 && loading) reloadPhase.current = 2;
    if (reloadPhase.current === 2 && !loading) {
      reloadPhase.current = 0;
      setDraft(row.draft);
      setDraftVersion(row.version);
      setBlockedSave(false);
      setCode("");
    }
  }, [loading, row]);
  const dirty = JSON.stringify(draft) !== JSON.stringify(row.draft),
    stale = draftVersion !== row.version;
  const confirmDiscard = useUnsavedChanges(dirty,
    (auth.locale === "bn" ? workspaceBn : workspaceEn).discardUnsaved,
    () => setDraft(row.draft));
  function reloadDraft() {
    if (!confirmDiscard()) return false;
    reloadPhase.current = 1;
    reload();
    return true;
  }
  function saved(r: EditorialDetail) {
    onSaved(r);
    setDraft(r.draft);
    setDraftVersion(r.version);
    setCode("SAVED");
    setVerified(false);
    setNote("");
    setBlockedSave(false);
  }
  async function save() {
    if (busy.current || stale || blockedSave || loading) return;
    const parsed = editorialSaveSchema.safeParse({
      expectedVersion: draftVersion,
      draft,
    });
    if (!parsed.success) {
      setCode("VALIDATION_FAILED");
      return;
    }
    busy.current = true;
    setPending(true);
    const r = await workspaceRequest(
      `admin/content/${row.id}/save`,
      editorialDetailSchema,
      "POST",
      parsed.data,
      `${auth.user!.id}:${auth.user!.role}:${auth.user!.roleVersion ?? 0}`,
    );
    busy.current = false;
    if (!alive.current) return;
    setPending(false);
    if (r.data) saved(r.data);
    else {
      setCode(r.code ?? "UNAVAILABLE");
      if (!["VALIDATION_FAILED", "RATE_LIMITED"].includes(r.code ?? ""))
        setBlockedSave(true);
    }
  }
  return (
    <>
      <section className={`${styles.card} space-y-5`}>
        <h2>{row.title[auth.locale]}</h2>
        <p>
          {label(row.kind)} · {row.slug} · {t.version} {number(row.version)} ·{" "}
          {row.publishedAt ? t.published : t.draft}
        </p>
        <p>{t.plain}</p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <fieldset
            disabled={loading || pending || stale || blockedSave}
            className={`${styles.formFields} space-y-5`}
          >
            <DraftFields draft={draft} setDraft={setDraft} />
            <button className={styles.primary} disabled={!dirty}>
              {pending ? t.loading : t.save}
            </button>
          </fieldset>
        </form>
        {code === "SAVED" ? (
          <p role="status">{t.saved}</p>
        ) : (
          <Feedback code={code} />
        )}
        {stale && <p role="alert">{t.stale}</p>}
        <button
          className={styles.secondary}
          data-content-reload
          onClick={reloadDraft}
        >
          {t.reloadDraft}
        </button>
      </section>
      <section className={`${styles.card} space-y-4`}>
        <h2>{t.preview}</h2>
        <EditorialText content={draft} locale={auth.locale} />
      </section>
      {row.kind === "VET" && (
        <section className={`${styles.card} ${styles.formFields} space-y-4`}>
          <p>{t.subjectUserId}: <Link className="font-semibold text-green underline" href={`/admin/veterinarians/${row.subjectUserId}`} target="_blank" rel="noreferrer">{row.subjectUserId}</Link></p>
          <label>
            <input
              type="checkbox"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
            />{" "}
            {t.verified}
          </label>
          <Field name="verification-note" label={t.verificationNote}>
            <textarea
              id="verification-note"
              minLength={10}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </Field>
        </section>
      )}
      <ConfirmationForm
        path={`admin/content/${row.id}/actions`}
        inputSchema={editorialActionSchema}
        responseSchema={editorialDetailSchema}
        input={{
          expectedVersion: row.version,
          action: "PUBLISH",
          ...(row.kind === "VET" && verified
            ? { verified: true, verificationNote: note }
            : {}),
        }}
        disabled={
          dirty ||
          stale ||
          loading ||
          (row.kind === "VET" && (!verified || note.trim().length < 10))
        }
        title={t.publish}
        onSaved={saved}
        onReload={reloadDraft}
      />
      {row.published && (
        <ConfirmationForm
          path={`admin/content/${row.id}/actions`}
          inputSchema={editorialActionSchema}
          responseSchema={editorialDetailSchema}
          input={{ expectedVersion: row.version, action: "UNPUBLISH" }}
          disabled={loading || dirty || stale}
          title={t.unpublish}
          onSaved={saved}
          onReload={reloadDraft}
        />
      )}
      <section className={`${styles.card} space-y-4`}>
        <h2>{t.revisions}</h2>
        {row.revisionsTruncated && <p>{t.truncated}</p>}
        {row.revisions.map((r) => (
          <details key={r.version}>
            <summary className="cursor-pointer">
              {t.version} {number(r.version)}
            </summary>
            <EditorialText content={r.draft} locale={auth.locale} />
          </details>
        ))}
      </section>
    </>
  );
}
export function AdminNotifications() {
  return (
    <Frame kind="notifications">
      <NotificationList />
    </Frame>
  );
}
function NotificationList() {
  const { auth, t, label, date, number } = useCopy(),
    [query, setQuery] = useState(""),
    [cursor, setCursor] = useState("");
  const remote = useData(
    `admin/notifications?${query}${cursor ? `&cursor=${cursor}` : ""}`,
    notificationListSchema,
  );
  return (
    <>
      <Filters
        kind="notifications"
        onFilter={(q) => {
          setQuery(q);
          setCursor("");
        }}
      />
      <Feedback code={remote.code} reload={remote.reload} />
      {remote.loading ? (
        <p role="status">{t.loading}</p>
      ) : remote.data?.items.length ? (
        remote.data.items.map((r) => (
          <article
            key={`${r.source}-${r.id}`}
            className={`${styles.card} space-y-3 [overflow-wrap:anywhere]`}
          >
            <h2>{label(r.category)}</h2>
            <p>
              {label(r.source)} · {label(r.channel)} · {label(r.status)}
            </p>
            <p>
              {t.recipient}: {r.recipient?.name ?? t.missing}
            </p>
            <p>
              {t.attempts}: {number(r.attempts)} · {date(r.createdAt)}
            </p>
            {r.acceptedAt && (
              <p>
                {t.accepted}: {date(r.acceptedAt)}
              </p>
            )}
            {r.canRetry && (
              <ConfirmationForm
                path={`admin/notifications/${r.id}/retry`}
                inputSchema={notificationRetrySchema}
                responseSchema={notificationRowSchema}
                input={{ expectedGeneration: r.generation }}
                title={t.retryDelivery}
                onSaved={() => remote.reload()}
                onReload={remote.reload}
              >
                <p>{t.deliveryNote}</p>
              </ConfirmationForm>
            )}
          </article>
        ))
      ) : (
        <p>{t.empty}</p>
      )}
      <Pager next={remote.data?.nextCursor ?? null} change={setCursor} />
    </>
  );
}
export function SupportWorkspace({
  id,
  own = false,
}: {
  id?: string;
  own?: boolean;
}) {
  return (
    <Frame kind="support" own={own}>
      {id ? (
        <TicketDetail key={id} id={id} own={own} />
      ) : (
        <TicketList own={own} />
      )}
    </Frame>
  );
}
function TicketList({ own }: { own: boolean }) {
  const alive = useAlive();
  const { auth, t, label } = useCopy(),
    router = useRouter(),
    [query, setQuery] = useState(""),
    [cursor, setCursor] = useState(""),
    [code, setCode] = useState(""),
    [pending, setPending] = useState(false),
    [uncertain, setUncertain] = useState(false),
    busy = useRef(false),
    createId = useRef<string>(),
    messageId = useRef<string>();
  const api = own ? "support/tickets" : "admin/support",
    base = own ? "/account/support" : "/admin/support",
    remote = useData(
      `${api}?${query}${cursor ? `&cursor=${cursor}` : ""}`,
      supportListSchema,
    );
  async function create(form: HTMLFormElement) {
    if (busy.current || uncertain) return;
    const fd = new FormData(form);
    createId.current ??= crypto.randomUUID();
    messageId.current ??= crypto.randomUUID();
    const parsed = supportCreateSchema.safeParse({
      id: createId.current,
      messageId: messageId.current,
      subject: fd.get("subject"),
      category: fd.get("category"),
      body: fd.get("message"),
      ...(fd.get("farm") ? { farmId: fd.get("farm") } : {}),
      ...(fd.get("order") ? { orderId: fd.get("order") } : {}),
    });
    if (!parsed.success) {
      setCode("VALIDATION_FAILED");
      return;
    }
    busy.current = true;
    setPending(true);
    const r = await workspaceRequest(
      api,
      supportDetailSchema,
      "POST",
      parsed.data,
      `${auth.user!.id}:${auth.user!.role}:${auth.user!.roleVersion ?? 0}`,
    );
    busy.current = false;
    if (!alive.current) return;
    setPending(false);
    if (r.data) router.push(`${base}/${r.data.id}`);
    else {
      setCode(r.code ?? "UNAVAILABLE");
      if (
        ![
          "VALIDATION_FAILED",
          "SUPPORT_LINK_FORBIDDEN",
          "RATE_LIMITED",
        ].includes(r.code ?? "")
      )
        setUncertain(true);
    }
  }
  return (
    <>
      <Filters
        kind="support"
        onFilter={(q) => {
          setQuery(q);
          setCursor("");
        }}
      />
      <Feedback code={remote.code} reload={remote.reload} />
      <section className={`${styles.card} space-y-3`}>
        {remote.loading ? (
          <p role="status">{t.loading}</p>
        ) : remote.data?.items.length ? (
          remote.data.items.map((r) => (
            <p key={r.id}>
              <Link
                className={
                  "font-semibold text-green underline underline-offset-4"
                }
                href={`${base}/${r.id}`}
              >
                {r.subject}
              </Link>{" "}
              · {label(r.status)} · {r.requester?.name ?? t.missing}
            </p>
          ))
        ) : (
          <p>{t.empty}</p>
        )}
        <Pager next={remote.data?.nextCursor ?? null} change={setCursor} />
      </section>
      {own && (
        <details className={styles.card}>
          <summary className="cursor-pointer font-semibold">
            {t.newTicket}
          </summary>
          <form
            className={`${styles.formFields} mt-5 space-y-4`}
            onSubmit={(e) => {
              e.preventDefault();
              void create(e.currentTarget);
            }}
          >
            <fieldset
              disabled={pending || uncertain}
              className={`${styles.formFields} space-y-4`}
            >
              <Field name="support-subject" label={t.subject}>
                <input
                  id="support-subject"
                  name="subject"
                  required
                  minLength={5}
                  maxLength={160}
                />
              </Field>
              <Field name="support-category" label={t.category}>
                <select id="support-category" name="category">
                  {["ACCOUNT", "FARM", "ORDER", "OTHER"].map((v) => (
                    <option key={v} value={v}>
                      {label(v)}
                    </option>
                  ))}
                </select>
              </Field>
              <Field name="support-message" label={t.message}>
                <textarea
                  id="support-message"
                  name="message"
                  required
                  maxLength={4000}
                  rows={5}
                />
              </Field>
              {(["farm", "order"] as const).map((v) => (
                <Field key={v} name={`support-${v}`} label={t[v]}>
                  <input id={`support-${v}`} name={v} />
                </Field>
              ))}
              <button className={styles.primary}>
                {pending ? t.loading : t.newTicket}
              </button>
            </fieldset>
            <Feedback code={code} />
            {uncertain && (
              <p role="status">
                {t.stale}{" "}
                <Link
                  href={`${base}/${createId.current}`}
                  className={
                    "font-semibold text-green underline underline-offset-4"
                  }
                >
                  {t.edit}
                </Link>
              </p>
            )}
          </form>
        </details>
      )}
    </>
  );
}
function TicketDetail({ id, own }: { id: string; own: boolean }) {
  const { t } = useCopy(),
    api = own ? "support/tickets" : "admin/support",
    remote = useData(`${api}/${id}`, supportDetailSchema);
  return (
    <>
      <Link
        className={"font-semibold text-green underline underline-offset-4"}
        href={own ? "/account/support" : "/admin/support"}
      >
        {t.back}
      </Link>
      <Feedback code={remote.code} reload={remote.reload} />
      {!remote.data ? (
        remote.code ? null : (
          <p role="status">{t.loading}</p>
        )
      ) : (
        <TicketEditor
          row={remote.data}
          own={own}
          loading={remote.loading || !!remote.code}
          onSaved={remote.setData}
          reload={remote.reload}
        />
      )}
    </>
  );
}
function TicketEditor({
  row,
  own,
  loading,
  onSaved,
  reload,
}: {
  row: SupportDetail;
  own: boolean;
  loading: boolean;
  onSaved: (r: SupportDetail) => void;
  reload: () => void;
}) {
  const alive = useAlive();
  const { auth, t, label, date } = useCopy(),
    [body, setBody] = useState(""),
    [internal, setInternal] = useState(false),
    [assignee, setAssignee] = useState(row.assignee?.id ?? ""),
    [status, setStatus] = useState(row.status),
    [code, setCode] = useState(""),
    [pending, setPending] = useState(false),
    [blocked, setBlocked] = useState(false),
    busy = useRef(false);
  useEffect(() => {
    if (!loading) setBlocked(false);
  }, [loading]);
  const replyId = useMemo(() => crypto.randomUUID(), [row.id, row.version]);
  async function reply() {
    if (busy.current || blocked || loading) return;
    const parsed = supportReplySchema.safeParse({
      expectedVersion: row.version,
      messageId: crypto.randomUUID(),
      body,
    });
    if (!parsed.success) {
      setCode("VALIDATION_FAILED");
      return;
    }
    busy.current = true;
    setPending(true);
    const r = await workspaceRequest(
      `support/tickets/${row.id}/messages`,
      supportDetailSchema,
      "POST",
      parsed.data,
      `${auth.user!.id}:${auth.user!.role}:${auth.user!.roleVersion ?? 0}`,
    );
    busy.current = false;
    if (!alive.current) return;
    setPending(false);
    if (r.data) {
      onSaved(r.data);
      setBody("");
      setCode("SAVED");
    } else {
      setCode(r.code ?? "UNAVAILABLE");
      setBlocked(true);
    }
  }
  return (
    <>
      <section className={`${styles.card} space-y-4 [overflow-wrap:anywhere]`}>
        <h2>{row.subject}</h2>
        <p>
          {label(row.category)} · {label(row.status)}
        </p>
        <p>
          {t.requester}:{" "}
          {own ? (
            (row.requester?.name ?? t.missing)
          ) : row.requester ? (
            <Link
              className={
                "font-semibold text-green underline underline-offset-4"
              }
              href={`/admin/users/${row.requester.id}`}
            >
              {row.requester.name}
            </Link>
          ) : (
            t.missing
          )}
        </p>
        <p>
          {t.assignee}: {row.assignee?.name ?? "—"}
        </p>
        {row.farmId && (
          <p>
            {t.farm}: {row.farmId}
          </p>
        )}
        {row.orderId && (
          <p>
            {t.order}: {row.orderId}
          </p>
        )}
        <p>{date(row.updatedAt)}</p>
        <button
          className={styles.secondary}
          disabled={loading}
          onClick={reload}
        >
          {t.refresh}
        </button>
      </section>
      <section className={`${styles.card} space-y-4`}>
        <h2>{t.history}</h2>
        {!own &&
          row.events.map((event) => (
            <p key={event.id} className="text-sm">
              {label(event.action)} {event.status && label(event.status)} ·{" "}
              {event.actor?.name ?? t.missing} · {date(event.createdAt)}
            </p>
          ))}
        {!own && row.eventsTruncated && <p>{t.truncated}</p>}
        {row.messagesTruncated && <p>{t.truncated}</p>}
        {row.messages.map((m) => (
          <article
            key={m.id}
            className={`rounded-xl border border-solid border-line p-4 ${m.internal ? "bg-amber-50" : "bg-white"}`}
          >
            <p className="text-sm">
              {m.author?.name ?? t.missing} · {date(m.createdAt)}{" "}
              {m.internal && `· ${t.private}`}
            </p>
            <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
              {m.body}
            </p>
          </article>
        ))}
      </section>
      {row.status !== "CLOSED" && (
        <section className={`${styles.card} ${styles.formFields} space-y-4`}>
          <Field name="reply-body" label={t.message}>
            <textarea
              id="reply-body"
              maxLength={4000}
              rows={5}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </Field>
          {!own && (
            <label>
              <input
                type="checkbox"
                checked={internal}
                onChange={(e) => setInternal(e.target.checked)}
              />{" "}
              {t.internal}
            </label>
          )}
          {own ? (
            <>
              <button
                className={styles.primary}
                disabled={pending || loading || blocked || !body.trim()}
                onClick={() => void reply()}
              >
                {pending ? t.loading : t.send}
              </button>
              {code === "SAVED" ? (
                <p role="status">{t.saved}</p>
              ) : (
                <Feedback code={code} />
              )}
            </>
          ) : (
            <ConfirmationForm
              path={`admin/support/${row.id}/actions`}
              inputSchema={supportActionSchema}
              responseSchema={supportDetailSchema}
              input={{
                expectedVersion: row.version,
                action: "REPLY",
                body,
                internal,
                messageId: replyId,
              }}
              title={internal ? t.private : t.publicReply}
              disabled={loading || !body.trim()}
              onSaved={(r) => {
                onSaved(r);
                setBody("");
              }}
              onReload={reload}
            />
          )}
        </section>
      )}
      {!own && (
        <>
          <section className={`${styles.card} ${styles.formFields} space-y-4`}>
            <Field name="assignee-id" label={t.assignee}>
              <input
                id="assignee-id"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
              />
            </Field>
            <ConfirmationForm
              path={`admin/support/${row.id}/actions`}
              inputSchema={supportActionSchema}
              responseSchema={supportDetailSchema}
              input={{
                expectedVersion: row.version,
                action: "ASSIGN",
                assigneeId: assignee || null,
              }}
              title={t.assign}
              disabled={loading}
              onSaved={onSaved}
              onReload={reload}
            />
          </section>
          <section className={`${styles.card} ${styles.formFields} space-y-4`}>
            <Field name="ticket-status" label={t.status}>
              <select
                id="ticket-status"
                value={status}
                onChange={(e) => setStatus(e.target.value as typeof status)}
              >
                {supportStatuses.map((v) => (
                  <option key={v} value={v}>
                    {label(v)}
                  </option>
                ))}
              </select>
            </Field>
            <ConfirmationForm
              path={`admin/support/${row.id}/actions`}
              inputSchema={supportActionSchema}
              responseSchema={supportDetailSchema}
              input={{ expectedVersion: row.version, action: "STATUS", status }}
              title={t.changeStatus}
              disabled={loading || row.status === status}
              onSaved={onSaved}
              onReload={reload}
            />
          </section>
        </>
      )}
    </>
  );
}
