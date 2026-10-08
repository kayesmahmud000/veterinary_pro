"use client";

import { cn } from "@/lib/ui/cn";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  X,
} from "lucide-react";
import {
  validateAuthForm,
  type AuthErrorCode,
  type AuthField,
  type FieldErrors,
} from "@/lib/auth/contracts";
import { useAuth } from "./auth-provider";
import styles from "./auth.styles";
import { BrandLogo } from "@/components/brand/site-brand";
import { RoleSelect } from "./role-select";
import { PhoneField } from "./phone-field";
import { DEFAULT_PHONE_COUNTRY } from "@/lib/auth/phone";
import type { CountryCode } from "libphonenumber-js/max";

export function AuthDialog() {
  const router = useRouter();
  const {
    user,
    modal,
    messages: t,
    locale,
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
  const [phoneCountry, setPhoneCountry] = useState<CountryCode>(
    DEFAULT_PHONE_COUNTRY,
  );
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
    const wasScrollLocked = document.body.classList.contains("overflow-hidden");
    document.body.classList.add("overflow-hidden");
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
      if (!wasScrollLocked) document.body.classList.remove("overflow-hidden");
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
    const validation = validateAuthForm(mode, { ...values, phoneCountry });
    setFields(validation.fields);
    if (Object.keys(validation.fields).length || !validation.payload) {
      const field = Object.keys(validation.fields)[0];
      form.current?.querySelector<HTMLElement>(`[name="${field}"]`)?.focus();
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
      <div className={cn(styles.field, "auth-field")}>
        <label htmlFor={`auth-${field}`}>{label}</label>
        <div
          className={cn(
            isPassword && field === "password" ? styles.password : undefined,
          )}
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
              className={cn(styles.eye)}
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
          <span id={`auth-${field}-error`} className={cn(styles.fieldError)}>
            {t.fields[issue]}
          </span>
        )}
        {hint && (
          <span id={`auth-${field}-hint`} className={cn(styles.hint)}>
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
      className={cn(
        styles.dialog,
        mode === "register" ? styles.registerDialog : undefined,
      )}
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
      <div className={cn(styles.content)}>
        <button
          type="button"
          className={cn(styles.close)}
          onClick={close}
          disabled={pending}
          aria-label={t.close}
        >
          <X size={20} aria-hidden="true" />
        </button>
        <BrandLogo className="mb-5" />
        <div className={cn(styles.eyebrow)}>{t.eyebrow}</div>
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
        <p id="auth-description" className={cn(styles.description)}>
          {user
            ? t.accountNote
            : mode === "register"
              ? t.registerBody
              : t.loginBody}
        </p>
        {success && user && (
          <div className={cn(styles.success)} role="status">
            <CheckCircle2 size={20} aria-hidden="true" />
            {success}
          </div>
        )}
        {visibleError && (
          <div
            ref={feedback}
            className={cn(styles.error)}
            role="alert"
            tabIndex={-1}
          >
            {t.errors[visibleError]}
            {user && (
              <button
                type="button"
                className={cn(styles.inlineButton)}
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
            <div className={cn(styles.profile)}>
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
              <span className={cn(styles.hint)}>
                {user.isEmailVerified ? t.verified : t.unverified}
              </span>
            </div>
            <p className={cn(styles.sessionNote)}>{t.sessionNote}</p>
            <div className={cn(styles.accountLinks)}>
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
              className={cn(styles.primary)}
              disabled={pending}
              onClick={close}
            >
              {t.continue}
              <ArrowRight size={18} aria-hidden="true" />
            </button>
            <button
              type="button"
              className={cn(styles.signOut)}
              disabled={pending}
              onClick={() => void logout()}
            >
              {pending ? t.signingOut : t.signOut}
            </button>
          </>
        ) : (
          <>
            <form ref={form} onSubmit={submit} noValidate aria-busy={pending}>
              <fieldset disabled={pending} className={cn(styles.formFields)}>
                {mode === "register" && (
                  <div
                    id="auth-register-fields"
                    className={cn(styles.registerFields)}
                  >
                    {input("name", t.name)}
                    {input("email", t.email, "email")}
                    <PhoneField
                      value={values.phone}
                      country={phoneCountry}
                      onChange={(value) => change("phone", value)}
                      onCountryChange={(country) => {
                        setPhoneCountry(country);
                        setFields((current) => ({
                          ...current,
                          phone: undefined,
                        }));
                        setError(undefined);
                      }}
                      copy={t}
                      locale={locale}
                      error={fields.phone ? t.fields.phone : undefined}
                    />
                    {input("password", t.password, "password", t.passwordHint)}
                    {input("confirmation", t.confirmation, "password")}
                    <div className={cn(styles.field, "auth-field")}>
                      <RoleSelect
                        value={values.role}
                        onValueChange={(value) => change("role", value)}
                        copy={t}
                        error={fields.role ? t.fields.role : undefined}
                      />
                    </div>
                  </div>
                )}
                {mode !== "register" && (
                  <>
                    {input("email", t.email, "email")}
                    {input("password", t.password, "password")}
                  </>
                )}
                <button
                  type="submit"
                  className={cn(styles.primary)}
                  disabled={pending}
                >
                  {pending ? (
                    <>
                      <Loader2
                        className={cn(styles.spinner)}
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
              <span className={cn(styles.srOnly)} role="status">
                {pending
                  ? mode === "register"
                    ? t.submittingRegister
                    : t.submittingLogin
                  : ""}
              </span>
            </form>
            <div className={cn(styles.switch)}>
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
