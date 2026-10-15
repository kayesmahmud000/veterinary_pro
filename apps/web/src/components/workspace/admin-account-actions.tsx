"use client";
import { useRef, useState, type FormEvent } from "react";
import {
  accountActionSchema,
  accountActionResultSchema,
  UserRole,
  type AccountActionInput,
} from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import { workspaceRequest } from "@/lib/workspace/client";
import { getDirectoryMessages } from "@/lib/i18n/admin-directory";
import { workspaceBn, workspaceEn } from "@/lib/i18n/workspace";
import { Confirmation, Field } from "./workspace-ui";
import styles from "./workspace.styles";
type Account = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: string;
  authorizationVersion: number;
};
export function AdminAccountActions({
  account,
  reload,
}: {
  account: Account;
  reload: (code: string) => void;
}) {
  const auth = useAuth(),
    t = getDirectoryMessages(auth.locale),
    common = auth.locale === "bn" ? workspaceBn : workspaceEn;
  const [action, setAction] = useState<AccountActionInput["action"]>(
    account.status === "SUSPENDED" ? "REACTIVATE" : "SUSPEND",
  );
  const [reason, setReason] = useState(""),
    [password, setPassword] = useState(""),
    [confirmation, setConfirmation] = useState<AccountActionInput | null>(null),
    [pending, setPending] = useState(false),
    [code, setCode] = useState(""),
    [saved, setSaved] = useState(false);
  const busy = useRef(false);
  // WorkspaceGate remounts this subtree on account/role changes.
  const actorKey = auth.user?.id;
  if (
    [UserRole.ADMIN, UserRole.SUPER_ADMIN].includes(account.role) ||
    account.id === actorKey
  )
    return <p>{t.restricted}</p>;
  function review(e: FormEvent) {
    e.preventDefault();
    if (busy.current) return;
    const effectiveAction =
      account.status === "PENDING_VERIFICATION"
        ? "REVOKE_SESSIONS"
        : action === "REVOKE_SESSIONS"
          ? action
          : account.status === "SUSPENDED"
            ? "REACTIVATE"
            : "SUSPEND";
    const parsed = accountActionSchema.safeParse({
      action: effectiveAction,
      reason,
      actorPassword: password,
      expectedAuthorizationVersion: account.authorizationVersion,
    });
    setCode(parsed.success ? "" : "VALIDATION_FAILED");
    setSaved(false);
    if (parsed.success) setConfirmation(parsed.data);
  }
  async function submit() {
    if (!confirmation || busy.current) return;
    busy.current = true;
    setPending(true);
    setCode("");
    const result = await workspaceRequest(
      `admin/directory/users/${account.id}/actions`,
      accountActionResultSchema,
      "POST",
      confirmation,
    );
    busy.current = false;
    setPending(false);
    setConfirmation(null);
    setPassword("");
    if (result.data) {
      setSaved(true);
      setReason("");
    } else setCode(result.code ?? "DEFAULT");
    reload(result.data ? "SAVED" : (result.code ?? "DEFAULT"));
  }
  const error = (t.errors as Record<string, string>)[code] ?? t.errors.DEFAULT;
  return (
    <section className={styles.card} data-account-actions>
      <h2>{t.action}</h2>
      {code && <p role="alert">{error}</p>}
      {saved && <p role="status">{t.saved}</p>}
      {account.status === "PENDING_VERIFICATION" && <p>{t.pending}</p>}
      <form onSubmit={review} aria-busy={pending}>
        <fieldset disabled={pending} className={styles.formFields}>
          <Field name="support-action" label={t.action}>
            <select
              id="support-action"
              value={
                account.status === "PENDING_VERIFICATION"
                  ? "REVOKE_SESSIONS"
                  : action === "REVOKE_SESSIONS"
                    ? action
                    : account.status === "SUSPENDED"
                      ? "REACTIVATE"
                      : "SUSPEND"
              }
              onChange={(e) =>
                setAction(e.target.value as AccountActionInput["action"])
              }
            >
              {account.status !== "PENDING_VERIFICATION" && (
                <option
                  value={
                    account.status === "SUSPENDED" ? "REACTIVATE" : "SUSPEND"
                  }
                >
                  {account.status === "SUSPENDED" ? t.REACTIVATE : t.SUSPEND}
                </option>
              )}
              <option value="REVOKE_SESSIONS">{t.REVOKE_SESSIONS}</option>
            </select>
          </Field>
          <Field name="support-reason" label={t.reason}>
            <textarea
              id="support-reason"
              required
              minLength={10}
              maxLength={500}
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <Field name="support-password" label={t.actorPassword}>
            <input
              id="support-password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <button className={styles.primary} type="submit" disabled={pending}>
            {common.confirm}
          </button>
        </fieldset>
      </form>
      {confirmation && (
        <Confirmation
          title={t.confirmTitle}
          confirm={() => void submit()}
          cancel={() => setConfirmation(null)}
          pending={pending}
          t={common}
        >
          <p>
            {account.name} · {account.email}
          </p>
          <p>{t[confirmation.action]}</p>
          <p>{confirmation.reason}</p>
        </Confirmation>
      )}
    </section>
  );
}
