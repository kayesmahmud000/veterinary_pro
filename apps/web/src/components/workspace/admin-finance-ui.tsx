"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { z } from "zod";
import { useAuth } from "@/components/auth/auth-provider";
import { workspaceRequest } from "@/lib/workspace/client";
import {
  financeError,
  financeLabel,
  getFinanceMessages,
} from "@/lib/i18n/admin-finance";
import { workspaceBn, workspaceEn } from "@/lib/i18n/workspace";
import { Confirmation, Field } from "./workspace-ui";
import styles from "./workspace.styles";
export function useFinance() {
  const { locale } = useAuth();
  const language = locale === "bn" ? "bn-BD" : "en-GB";
  const number = (value: number) =>
    new Intl.NumberFormat(language).format(value);
  return {
    t: getFinanceMessages(locale),
    label: (value: string) => financeLabel(locale, value),
    number,
    percent: (value: number) =>
      new Intl.NumberFormat(language, {
        style: "percent",
        maximumFractionDigits: 2,
      }).format(value),
    money: (value: number, currency: string) => {
      // Keep integer minor units exact, including amounts near MAX_SAFE_INTEGER.
      const cents = BigInt(value);
      const fraction = new Intl.NumberFormat(language, {
        minimumIntegerDigits: 2,
        useGrouping: false,
      }).format(Number(cents % BigInt(100)));
      return new Intl.NumberFormat(language, {
        style: "currency",
        currency,
        currencyDisplay: "code",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
        .formatToParts(cents / BigInt(100))
        .map((part) => (part.type === "fraction" ? fraction : part.value))
        .join("");
    },
    date: (value: string | null) =>
      value
        ? `${new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Dhaka" }).format(new Date(value))} (Asia/Dhaka)`
        : "—",
    identity: (value: { id: string; name: string } | null) =>
      value
        ? `${value.name} · ${value.id}`
        : getFinanceMessages(locale).deleted,
  };
}
export function FinanceError({
  code,
  retry,
}: {
  code?: string;
  retry?: () => void;
}) {
  const { locale } = useAuth(),
    t = getFinanceMessages(locale);
  return (
    <div className={styles.error}>
      <p role="alert">{financeError(locale, code)}</p>
      {retry && (
        <button data-finance-retry className={styles.secondary} onClick={retry}>
          {t.retry}
        </button>
      )}
    </div>
  );
}
export function Facts({ pairs }: { pairs: Array<[string, ReactNode]> }) {
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
export function History({
  items,
  truncated,
}: {
  items: Array<{
    id: string;
    action: string;
    actor: { id: string; name: string } | null;
    reason: string | null;
    createdAt: string;
  }>;
  truncated: boolean;
}) {
  const f = useFinance();
  return (
    <section className={styles.card}>
      <h2>{f.t.history}</h2>
      {!items.length ? (
        <p>{f.t.noHistory}</p>
      ) : (
        <ol className="space-y-4 pl-5">
          {items.map((event) => (
            <li key={event.id}>
              <strong>{f.label(event.action)}</strong>
              <p>
                {f.identity(event.actor)} · {f.date(event.createdAt)}
              </p>
              <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                {event.reason}
              </p>
            </li>
          ))}
        </ol>
      )}
      {truncated && <p>{f.t.truncated}</p>}
    </section>
  );
}
export function FinanceAction<T>({
  kind,
  bulk = false,
  path,
  schema,
  parse,
  rows,
  allowed = true,
  refreshing,
  readToken,
  onReload,
  onSaved,
  actions,
  children,
}: {
  kind: "settlement" | "review";
  bulk?: boolean;
  path: string;
  schema: z.ZodType<T, any, any>;
  parse: (fields: {
    reason: string;
    actorPassword: string;
    payoutReference: string;
    payoutBatchId?: string;
    status: string;
  }) => { success: false } | { success: true; data: unknown };
  rows: ReactNode;
  allowed?: boolean;
  refreshing: boolean;
  readToken: unknown;
  onReload: () => void;
  onSaved: (v: T) => void;
  actions?: string[];
  children?: ReactNode;
}) {
  const auth = useAuth(),
    f = useFinance(),
    t = f.t;
  const [reason, setReason] = useState(""),
    [password, setPassword] = useState(""),
    [reference, setReference] = useState(""),
    [batch, setBatch] = useState(""),
    [action, setAction] = useState(actions?.[0] ?? "APPROVED"),
    [pending, setPending] = useState(false),
    [confirm, setConfirm] = useState(false),
    [code, setCode] = useState(""),
    [blocked, setBlocked] = useState(false);
  const saving = useRef(false),
    mounted = useRef(true),
    previousRead = useRef(readToken);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (readToken && previousRead.current !== readToken) {
      previousRead.current = readToken;
      setBlocked(false);
      setCode("");
      setConfirm(false);
      setPassword("");
    }
  }, [readToken]);
  useEffect(() => {
    if (auth.checking || auth.error || refreshing) {
      setPassword("");
      setConfirm(false);
    }
  }, [auth.checking, auth.error, refreshing]);
  function input() {
    return parse({
      reason,
      actorPassword: password,
      payoutReference: reference,
      ...(batch.trim() ? { payoutBatchId: batch } : {}),
      status: action,
    });
  }
  async function submit() {
    if (
      saving.current ||
      blocked ||
      refreshing ||
      !allowed ||
      auth.checking ||
      auth.error
    )
      return;
    const parsed = input();
    if (!parsed.success) {
      setCode("VALIDATION_FAILED");
      setConfirm(false);
      return;
    }
    saving.current = true;
    setPending(true);
    setPassword("");
    setCode("");
    const actor = auth.user
      ? `${auth.user.id}:${auth.user.role}:${auth.user.roleVersion ?? 0}`
      : undefined;
    const result = await workspaceRequest(
      path,
      schema,
      "POST",
      parsed.data,
      actor,
    );
    saving.current = false;
    if (!mounted.current) return;
    setPending(false);
    setConfirm(false);
    if (result.data) {
      setReason("");
      onSaved(result.data);
    } else {
      const next = result.code ?? "UNAVAILABLE";
      setCode(next);
      if (
        next.includes("CONFLICT") ||
        next.includes("UNAVAILABLE") ||
        [
          "TIMEOUT",
          "INVALID_RESPONSE",
          "AUTHORIZATION_CHANGED",
          "UNAUTHORIZED",
          "FORBIDDEN",
        ].includes(next)
      )
        setBlocked(true);
    }
  }
  return (
    <section
      data-settlement-support={kind === "settlement" ? true : undefined}
      data-review-support={kind === "review" ? true : undefined}
      className={`${styles.card} space-y-5`}
    >
      <h2>
        {kind === "settlement" ? (bulk ? t.bulk : t.reconcile) : t.action}
      </h2>
      <p>{kind === "settlement" ? t.local : t.privacy}</p>
      {children}
      {!allowed ? (
        <p>{t.readonly}</p>
      ) : (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setCode("");
            if (!input().success) setCode("VALIDATION_FAILED");
            else if (!blocked && !refreshing) setConfirm(true);
          }}
        >
          <fieldset
            disabled={pending || refreshing}
            className={`${styles.formFields} space-y-5`}
          >
            {kind === "review" ? (
              <Field name="review-action" label={t.action}>
                <select
                  id="review-action"
                  value={action}
                  onChange={(e) => {
                    setAction(e.target.value);
                    setPassword("");
                    setConfirm(false);
                  }}
                >
                  {actions?.map((v) => (
                    <option key={v} value={v}>
                      {f.label(v)}
                    </option>
                  ))}
                  {!actions?.includes(action) && (
                    <option value={action} disabled>
                      {f.label(action)}
                    </option>
                  )}
                </select>
              </Field>
            ) : (
              <>
                <Field name="settlement-reference" label={t.reference}>
                  <input
                    id="settlement-reference"
                    required
                    minLength={3}
                    maxLength={255}
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                  />
                </Field>
                <Field name="settlement-batch" label={t.batch}>
                  <input
                    id="settlement-batch"
                    maxLength={100}
                    value={batch}
                    onChange={(e) => setBatch(e.target.value)}
                  />
                </Field>
              </>
            )}
            <Field name={`${kind}-reason`} label={t.reason}>
              <textarea
                id={`${kind}-reason`}
                rows={3}
                required
                minLength={5}
                maxLength={1000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </Field>
            <Field name={`${kind}-password`} label={t.password}>
              <input
                id={`${kind}-password`}
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </Field>
            {code && <FinanceError code={code} />}
            <button
              className={styles.primary}
              disabled={
                pending ||
                blocked ||
                !allowed ||
                (kind === "review" && !actions?.includes(action))
              }
            >
              {pending ? t.saving : t.review}
            </button>
          </fieldset>
        </form>
      )}
      {blocked && <p role="status">{t.stale}</p>}
      {blocked && (
        <button
          type="button"
          data-finance-reload
          className={styles.secondary}
          onClick={() => {
            setConfirm(false);
            setPassword("");
            onReload();
          }}
        >
          {t.refresh}
        </button>
      )}
      {confirm && (
        <Confirmation
          title={t.confirm}
          t={auth.locale === "bn" ? workspaceBn : workspaceEn}
          pending={pending}
          confirmAttributes={{ "data-finance-confirm": true }}
          confirm={() => void submit()}
          cancel={() => {
            setPassword("");
            setConfirm(false);
          }}
        >
          {rows}
          <p>
            {kind === "settlement"
              ? `${reference} · ${batch}`
              : f.label(action)}
          </p>
          <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
            {reason.trim()}
          </p>
          <p>{kind === "settlement" ? t.local : t.privacy}</p>
        </Confirmation>
      )}
    </section>
  );
}
