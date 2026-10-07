"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import {
  authUserSchema,
  privilegedRoleSchema,
  UserRole,
  type PrivilegedRoleInput,
} from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import {
  adminTargetSchema,
  adminUserListSchema,
} from "@/lib/workspace/contracts";
import { workspaceRequest } from "@/lib/workspace/client";
import type { WorkspaceMessages } from "@/lib/i18n/workspace";
import {
  Confirmation,
  Field,
  Notice,
  option,
  useRemote,
  validate,
  type Issues,
} from "./workspace-ui";
import styles from "./workspace.module.css";
export function AdministrativeAccess({ t }: { t: WorkspaceMessages }) {
  const auth = useAuth(),
    [search, setSearch] = useState(""),
    [searchValue, setSearchValue] = useState(""),
    [cursor, setCursor] = useState(""),
    [email, setEmail] = useState(""),
    [targetPath, setTargetPath] = useState<string | null>(null),
    [action, setAction] =
      useState<PrivilegedRoleInput["action"]>("GRANT_ADMIN"),
    [reason, setReason] = useState(""),
    [password, setPassword] = useState(""),
    [issues, setIssues] = useState<Issues>({}),
    [code, setCode] = useState<string>(),
    [success, setSuccess] = useState(false),
    [pending, setPending] = useState(false),
    [confirmation, setConfirmation] = useState<PrivilegedRoleInput | null>(
      null,
    );
  const busy = useRef(false),
    list = useRemote(
      `admin/users?limit=20${search ? `&search=${encodeURIComponent(search)}` : ""}${cursor ? `&cursor=${cursor}` : ""}`,
      adminUserListSchema,
    ),
    target = useRemote(targetPath, adminTargetSchema),
    user = target.data;
  useEffect(() => {
    setAction(
      user?.role === UserRole.ADMIN ? "GRANT_SUPER_ADMIN" : "GRANT_ADMIN",
    );
    setPassword("");
    setReason("");
    setIssues({});
  }, [user?.id, user?.roleVersion]);
  function lookup(event: FormEvent) {
    event.preventDefault();
    const result = validate(
      z.object({ email: z.string().trim().toLowerCase().email().max(254) }),
      { email },
      setIssues,
      t,
    );
    if (result) {
      setTargetPath(
        `admin/users/lookup?email=${encodeURIComponent(result.email)}`,
      );
      target.reload();
      setSuccess(false);
      setCode(undefined);
    }
  }
  function review(event: FormEvent) {
    event.preventDefault();
    if (!user || busy.current) return;
    const input = validate(
      privilegedRoleSchema,
      {
        action,
        expectedRoleVersion: user.roleVersion ?? 0,
        reason,
        actorPassword: password,
      },
      setIssues,
      t,
    );
    if (input) setConfirmation(input);
  }
  async function submit() {
    if (!confirmation || !user || busy.current) return;
    busy.current = true;
    setPending(true);
    setCode(undefined);
    const result = await workspaceRequest(
      `admin/users/${user.id}`,
      authUserSchema,
      "PATCH",
      confirmation,
    );
    busy.current = false;
    setPending(false);
    setPassword("");
    setConfirmation(null);
    if (result.data) {
      setSuccess(true);
      target.reload();
      list.reload();
    } else {
      setCode(result.code);
      target.reload();
    }
  }
  const actionLabel = (value: PrivilegedRoleInput["action"]) =>
    value === "GRANT_ADMIN"
      ? t.grantAdmin
      : value === "GRANT_SUPER_ADMIN"
        ? t.grantSuper
        : t.removePrivilege;
  return (
    <>
      <p className={styles.intro}>{t.accessBody}</p>
      <Notice code={code} text={success ? t.accessChanged : undefined} t={t} />
      <form className={styles.card} onSubmit={lookup} noValidate>
        <Field name="email" label={t.userEmail} error={issues.email}>
          <input
            id="email"
            type="email"
            maxLength={254}
            value={email}
            autoComplete="off"
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={!!issues.email}
            aria-describedby={issues.email ? "email-error" : undefined}
          />
        </Field>
        <div className={styles.actions}>
          <button className={styles.primary} disabled={pending}>
            {t.findTarget}
          </button>
        </div>
      </form>
      {targetPath &&
        (target.loading ? (
          <Notice text={t.loading} t={t} />
        ) : target.code ? (
          <>
            <Notice code={target.code} t={t} />
            <button className={styles.secondary} onClick={target.reload}>
              {t.retry}
            </button>
          </>
        ) : (
          user && (
            <section className={styles.card}>
              <h2>{user.name}</h2>
              <p>
                {user.email} · {option(t, user.role)} · {option(t, user.status)}
              </p>
              <p>
                {t.fallback}: {option(t, user.fallbackRole)}
              </p>
              {user.id === auth.user?.id ? (
                <Notice text={t.selfBlocked} t={t} />
              ) : user.status !== "ACTIVE" ? (
                <Notice code="TARGET_INELIGIBLE" t={t} />
              ) : (
                <form onSubmit={review} noValidate aria-busy={pending}>
                  <fieldset className={styles.formFields} disabled={pending}>
                    <div className={styles.grid}>
                      <Field
                        name="action"
                        label={t.action}
                        error={issues.action}
                      >
                        <select
                          id="action"
                          value={action}
                          onChange={(event) =>
                            setAction(
                              event.target
                                .value as PrivilegedRoleInput["action"],
                            )
                          }
                        >
                          {(
                            [
                              "GRANT_ADMIN",
                              "GRANT_SUPER_ADMIN",
                              "REMOVE_PRIVILEGE",
                            ] as const
                          )
                            .filter((v) =>
                              v === "REMOVE_PRIVILEGE"
                                ? [
                                    UserRole.ADMIN,
                                    UserRole.SUPER_ADMIN,
                                  ].includes(user.role)
                                : v === "GRANT_ADMIN"
                                  ? user.role !== UserRole.ADMIN
                                  : user.role !== UserRole.SUPER_ADMIN,
                            )
                            .map((v) => (
                              <option key={v} value={v}>
                                {actionLabel(v)}
                              </option>
                            ))}
                        </select>
                      </Field>
                      <Field
                        name="actorPassword"
                        label={t.actorPassword}
                        error={issues.actorPassword}
                      >
                        <input
                          id="actorPassword"
                          type="password"
                          autoComplete="current-password"
                          maxLength={128}
                          value={password}
                          onChange={(event) => setPassword(event.target.value)}
                          aria-invalid={!!issues.actorPassword}
                          aria-describedby={
                            issues.actorPassword
                              ? "actorPassword-error"
                              : undefined
                          }
                        />
                      </Field>
                      <div className={styles.full}>
                        <Field
                          name="reason"
                          label={t.reason}
                          error={issues.reason}
                        >
                          <textarea
                            id="reason"
                            rows={3}
                            maxLength={500}
                            value={reason}
                            onChange={(event) => setReason(event.target.value)}
                            aria-invalid={!!issues.reason}
                            aria-describedby={
                              issues.reason ? "reason-error" : undefined
                            }
                          />
                        </Field>
                      </div>
                    </div>
                    <div className={styles.actions}>
                      <button className={styles.primary} disabled={pending}>
                        {actionLabel(action)}
                      </button>
                      <button
                        className={styles.secondary}
                        type="button"
                        onClick={target.reload}
                      >
                        {t.refresh}
                      </button>
                    </div>
                  </fieldset>
                </form>
              )}
            </section>
          )
        ))}
      <section className={styles.card}>
        <h2>{t.accessTitle}</h2>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            setSearch(searchValue.trim());
            setCursor("");
          }}
        >
          <Field name="admin-search" label={t.search}>
            <input
              id="admin-search"
              maxLength={100}
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
            />
          </Field>
          <div className={styles.actions}>
            <button className={styles.secondary}>{t.search}</button>
            <button
              type="button"
              className={styles.secondary}
              onClick={list.reload}
            >
              {t.refresh}
            </button>
          </div>
        </form>
        <Notice code={list.code} t={t} />
        {list.loading ? (
          <Notice text={t.loading} t={t} />
        ) : (
          <ul className={styles.list}>
            {list.data?.users.map((row) => (
              <li key={row.id}>
                <div>
                  <strong>{row.name}</strong>
                  <small>
                    {row.email} · {option(t, row.role)} ·{" "}
                    {option(t, row.status)}
                  </small>
                </div>
                <button
                  type="button"
                  className={styles.secondary}
                  disabled={pending}
                  onClick={() => {
                    setTargetPath(`admin/users/${row.id}`);
                    setSuccess(false);
                    setCode(undefined);
                  }}
                >
                  {t.details}
                </button>
              </li>
            ))}
          </ul>
        )}
        {list.data?.nextCursor && (
          <div className={styles.actions}>
            <button
              className={styles.secondary}
              onClick={() => setCursor(list.data!.nextCursor!)}
            >
              {t.next}
            </button>
          </div>
        )}
      </section>
      {confirmation && user && (
        <Confirmation
          title={t.accessConfirm}
          confirm={() => void submit()}
          cancel={() => {
            setConfirmation(null);
            setPassword("");
          }}
          pending={pending}
          t={t}
        >
          <p>
            {user.name} · {user.email}
          </p>
          <p>{actionLabel(confirmation.action)}</p>
          {confirmation.action === "REMOVE_PRIVILEGE" && (
            <p>
              {t.fallback}: {option(t, user.fallbackRole)}
            </p>
          )}
          <p>{confirmation.reason}</p>
        </Confirmation>
      )}
    </>
  );
}
