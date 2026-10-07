"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Sprout,
  X,
} from "lucide-react";
import {
  PUBLIC_ROLES,
  validateAuthForm,
  type AuthErrorCode,
  type AuthField,
  type FieldErrors,
} from "@/lib/auth/contracts";
import { useAuth } from "./auth-provider";
import styles from "./auth.module.css";

export function AuthDialog() {
  const router = useRouter();
  const {
    user,
    modal,
    messages: t,
    close,
    open,
    mutate,
    error: sessionError,
    restore,
  } = useAuth();
  const mode = modal === "register" ? "register" : "login";
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const feedback = useRef<HTMLDivElement>(null);
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<AuthErrorCode>();
  const [fields, setFields] = useState<FieldErrors>({});
  const [success, setSuccess] = useState<string>();
  const [showPassword, setShowPassword] = useState(false);
  const [values, setValues] = useState({
    email: "",
    password: "",
    name: "",
    phone: "",
    role: "LEARNER",
    confirmation: "",
  });

  useEffect(() => {
    const element = dialog.current;
    const opener =
      document.activeElement instanceof HTMLElement &&
      document.activeElement !== document.body
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    element?.showModal();
    element?.querySelector<HTMLInputElement>("input")?.focus();
    // Disabled fields can move focus out of the dialog. Capture Escape before
    // the browser's native close action while a mutation is still pending.
    const preventPendingEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && busy.current) event.preventDefault();
    };
    document.addEventListener("keydown", preventPendingEscape, true);
    return () => {
      document.removeEventListener("keydown", preventPendingEscape, true);
      element?.close();
      document.body.style.overflow = previousOverflow;
      if (opener?.isConnected && opener.getClientRects().length) opener.focus();
      else
        Array.from(
          document.querySelectorAll<HTMLElement>(
            "[data-auth-trigger], .menu-toggle",
          ),
        )
          .find((candidate) => candidate.getClientRects().length)
          ?.focus();
    };
  }, []);

  function change(field: AuthField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFields((current) => ({ ...current, [field]: undefined }));
    setError(undefined);
  }

  function switchMode() {
    if (busy.current) return;
    open(mode === "login" ? "register" : "login");
    setValues((current) => ({ ...current, password: "", confirmation: "" }));
    setShowPassword(false);
    setError(undefined);
    setFields({});
    setSuccess(undefined);
    requestAnimationFrame(() =>
      form.current?.querySelector<HTMLInputElement>("input")?.focus(),
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const validation = validateAuthForm(mode, values);
    setFields(validation.fields);
    if (Object.keys(validation.fields).length || !validation.payload) {
      const field = Object.keys(validation.fields)[0];
      form.current
        ?.querySelector<HTMLInputElement>(`[name="${field}"]`)
        ?.focus();
      return;
    }
    busy.current = true;
    setPending(true);
    setError(undefined);
    const result = await mutate(mode, validation.payload);
    if (result.code) {
      setError(result.code);
      setFields(result.fields ?? {});
      requestAnimationFrame(() => feedback.current?.focus());
    } else {
      if (
        result.user?.role === "FARMER" &&
        result.user.farmerOnboardingRequired
      ) {
        close();
        router.push("/account/farm-onboarding");
      }
      setValues((current) => ({ ...current, password: "", confirmation: "" }));
      setShowPassword(false);
      setSuccess(mode === "register" ? t.registerSuccess : t.loginSuccess);
      requestAnimationFrame(() =>
        dialog.current
          ?.querySelector<HTMLElement>("[data-account-title]")
          ?.focus(),
      );
    }
    busy.current = false;
    setPending(false);
  }

  async function logout() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError(undefined);
    const result = await mutate("logout");
    busy.current = false;
    setPending(false);
    if (result.code) {
      setError(result.code);
      requestAnimationFrame(() => feedback.current?.focus());
    } else close();
  }

  function input(
    field: Exclude<AuthField, "role">,
    label: string,
    type = "text",
    hint?: string,
  ) {
    const issue = fields[field];
    const isPassword = field === "password" || field === "confirmation";
    return (
      <div className={styles.field}>
        <label htmlFor={`auth-${field}`}>{label}</label>
        <div
          className={
            isPassword && field === "password" ? styles.password : undefined
          }
        >
          <input
            id={`auth-${field}`}
            name={field}
            type={isPassword ? (showPassword ? "text" : "password") : type}
            value={values[field]}
            onChange={(event) => change(field, event.target.value)}
            autoComplete={
              field === "password"
                ? mode === "login"
                  ? "current-password"
                  : "new-password"
                : field === "confirmation"
                  ? "new-password"
                  : field === "phone"
                    ? "tel"
                    : field === "email"
                      ? "username"
                      : "name"
            }
            autoCapitalize={field === "email" ? "none" : undefined}
            spellCheck={field === "name"}
            aria-invalid={issue ? true : undefined}
            aria-describedby={
              issue
                ? `auth-${field}-error`
                : hint
                  ? `auth-${field}-hint`
                  : undefined
            }
            required={field !== "phone"}
          />
          {field === "password" && (
            <button
              type="button"
              className={styles.eye}
              aria-label={showPassword ? t.hidePassword : t.showPassword}
              aria-pressed={showPassword}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? (
                <EyeOff size={18} aria-hidden="true" />
              ) : (
                <Eye size={18} aria-hidden="true" />
              )}
            </button>
          )}
        </div>
        {issue && (
          <span id={`auth-${field}-error`} className={styles.fieldError}>
            {t.fields[issue]}
          </span>
        )}
        {hint && (
          <span id={`auth-${field}-hint`} className={styles.hint}>
            {hint}
          </span>
        )}
      </div>
    );
  }

  const visibleError = error ?? sessionError;
  return (
    <dialog
      ref={dialog}
      className={styles.dialog}
      aria-labelledby="auth-title"
      aria-describedby="auth-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy.current) close();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy.current) {
          const rect = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < rect.left ||
            event.clientX > rect.right ||
            event.clientY < rect.top ||
            event.clientY > rect.bottom
          )
            close();
        }
      }}
    >
      <div className={styles.content}>
        <button
          type="button"
          className={styles.close}
          onClick={close}
          disabled={pending}
          aria-label={t.close}
        >
          <X size={20} aria-hidden="true" />
        </button>
        <div className={styles.mark}>
          <Sprout aria-hidden="true" size={25} />
        </div>
        <div className={styles.eyebrow}>{t.eyebrow}</div>
        <h2
          id="auth-title"
          data-account-title={user ? "" : undefined}
          tabIndex={-1}
        >
          {user
            ? t.accountTitle
            : mode === "register"
              ? t.registerTitle
              : t.loginTitle}
        </h2>
        <p id="auth-description" className={styles.description}>
          {user
            ? t.accountNote
            : mode === "register"
              ? t.registerBody
              : t.loginBody}
        </p>
        {success && user && (
          <div className={styles.success} role="status">
            <CheckCircle2 size={20} aria-hidden="true" />
            {success}
          </div>
        )}
        {visibleError && (
          <div
            ref={feedback}
            className={styles.error}
            role="alert"
            tabIndex={-1}
          >
            {t.errors[visibleError]}
            {user && (
              <button
                type="button"
                className={styles.inlineButton}
                disabled={pending}
                onClick={() => {
                  setError(undefined);
                  void restore();
                }}
              >
                {t.retry}
              </button>
            )}
          </div>
        )}
        {user ? (
          <>
            <div className={styles.profile}>
              <strong>{user.name}</strong>
              <dl>
                <div>
                  <dt>{t.email}</dt>
                  <dd>{user.email}</dd>
                </div>
                <div>
                  <dt>{t.role}</dt>
                  <dd>{t.roles[user.role]}</dd>
                </div>
                {user.maskedPhone && (
                  <div>
                    <dt>{t.phone}</dt>
                    <dd>{user.maskedPhone}</dd>
                  </div>
                )}
              </dl>
              <span className={styles.hint}>
                {user.isEmailVerified ? t.verified : t.unverified}
              </span>
            </div>
            <p className={styles.sessionNote}>{t.sessionNote}</p>
            <div className={styles.accountLinks}>
              <Link href="/account/role-requests" onClick={close}>
                {t.applications}
              </Link>
              {user.role === "LEARNER" && (
                <Link href="/account/role-requests/new" onClick={close}>
                  {t.applyRole}
                </Link>
              )}
              {user.role === "FARMER" && (
                <Link
                  href={
                    user.farmerOnboardingRequired
                      ? "/account/farm-onboarding"
                      : "/farm"
                  }
                  onClick={close}
                >
                  {user.farmerOnboardingRequired
                    ? t.setupFarm
                    : t.farmDashboard}
                </Link>
              )}
              {["ADMIN", "SUPER_ADMIN"].includes(user.role) && (
                <Link href="/admin/role-requests" onClick={close}>
                  {t.reviewApplications}
                </Link>
              )}
              {user.role === "SUPER_ADMIN" && (
                <Link href="/admin/administrative-access" onClick={close}>
                  {t.manageAccess}
                </Link>
              )}
            </div>
            <button
              type="button"
              className={styles.primary}
              disabled={pending}
              onClick={close}
            >
              {t.continue}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={styles.signOut}
              disabled={pending}
              onClick={() => void logout()}
            >
              {pending ? t.signingOut : t.signOut}
            </button>
          </>
        ) : (
          <>
            <form ref={form} onSubmit={submit} noValidate aria-busy={pending}>
              <fieldset disabled={pending} className={styles.formFields}>
                {mode === "register" && input("name", t.name)}
                {input("email", t.email, "email")}
                {mode === "register" &&
                  input("phone", t.phone, "tel", t.phoneHint)}
                {input(
                  "password",
                  t.password,
                  "password",
                  mode === "register" ? t.passwordHint : undefined,
                )}
                {mode === "register" && (
                  <>
                    {input("confirmation", t.confirmation, "password")}
                    <fieldset className={styles.roles}>
                      <legend>{t.role}</legend>
                      {PUBLIC_ROLES.map((role) => (
                        <label
                          key={role}
                          className={
                            values.role === role
                              ? styles.selectedRole
                              : undefined
                          }
                        >
                          <input
                            type="radio"
                            name="role"
                            value={role}
                            checked={values.role === role}
                            onChange={() => change("role", role)}
                          />
                          {t.roles[role]}
                        </label>
                      ))}
                      {fields.role && (
                        <span className={styles.fieldError}>
                          {t.fields.role}
                        </span>
                      )}
                    </fieldset>
                  </>
                )}
                <button
                  type="submit"
                  className={styles.primary}
                  disabled={pending}
                >
                  {pending ? (
                    <>
                      <Loader2
                        className={styles.spinner}
                        size={18}
                        aria-hidden="true"
                      />
                      {mode === "register"
                        ? t.submittingRegister
                        : t.submittingLogin}
                    </>
                  ) : (
                    <>
                      {mode === "register" ? t.create : t.signIn}
                      <ArrowRight size={18} aria-hidden="true" />
                    </>
                  )}
                </button>
              </fieldset>
              <span className={styles.srOnly} role="status">
                {pending
                  ? mode === "register"
                    ? t.submittingRegister
                    : t.submittingLogin
                  : ""}
              </span>
            </form>
            <div className={styles.switch}>
              {mode === "register" ? t.hasAccount : t.noAccount}{" "}
              <button type="button" onClick={switchMode} disabled={pending}>
                {mode === "register" ? t.signIn : t.signUp}
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
