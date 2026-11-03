"use client";
import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import {
  adminCourseUserCreateSchema,
  adminCourseUserCreateResultSchema,
} from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import { workspaceRequest } from "@/lib/workspace/client";
import {
  getEnrollmentMessages,
  enrollmentError,
} from "@/lib/i18n/admin-course-enrollments";
import { Button } from "@/components/ui/button";
import { AdminCourseDialog } from "./admin-course-dialog";
import { Field } from "./workspace-ui";
export function AdminCourseUserCreate({
  courseId,
  courseTitle,
  onCreated,
  onClose,
  onExisting,
}: {
  courseId: string;
  courseTitle: string;
  onCreated: () => void;
  onClose: () => void;
  onExisting: (email: string) => void;
}) {
  const auth = useAuth(),
    t = getEnrollmentMessages(auth.locale),
    [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [confirm, setConfirm] = useState(""),
    [actorPassword, setActorPassword] = useState(""),
    [reason, setReason] = useState(""),
    [show, setShow] = useState(false),
    [busy, setBusy] = useState(false),
    [code, setCode] = useState(""),
    [submittedEmail, setSubmittedEmail] = useState(""),
    [uncertain, setUncertain] = useState(false),
    running = useRef(false),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const clear = () => {
    setPassword("");
    setConfirm("");
    setActorPassword("");
    setShow(false);
  };
  async function submit() {
    if (
      running.current ||
      uncertain ||
      code === "ACCOUNT_EXISTS" ||
      auth.checking ||
      auth.error ||
      !auth.user
    )
      return;
    const parsed = adminCourseUserCreateSchema.safeParse({
      name,
      email,
      newUserPassword: password,
      actorPassword,
      reason,
    });
    if (!parsed.success || confirm !== password) {
      setCode("VALIDATION_FAILED");
      clear();
      return;
    }
    running.current = true;
    setBusy(true);
    setCode("");
    setSubmittedEmail(parsed.data.email);
    const result = await workspaceRequest(
      `admin/courses/${courseId}/enrollments/create-user`,
      adminCourseUserCreateResultSchema,
      "POST",
      parsed.data,
      `${auth.user.id}:${auth.user.role}:${auth.user.roleVersion ?? 0}`,
    );
    if (!active.current) return;
    clear();
    setBusy(false);
    running.current = false;
    if (result.data) onCreated();
    else {
      setCode(result.code ?? "UNAVAILABLE");
      setUncertain(
        ["TIMEOUT", "UNAVAILABLE", "INVALID_RESPONSE"].includes(
          result.code ?? "UNAVAILABLE",
        ),
      );
    }
  }
  const inputClass =
    "box-border w-full rounded-lg border border-solid border-line bg-white p-3 text-ink";
  return (
    <AdminCourseDialog
      title={t.create}
      close={() => {
        clear();
        onClose();
      }}
      busy={busy}
    >
      <form
        data-create-course-user
        className="space-y-4"
        aria-busy={busy}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <strong className="block break-words">{courseTitle}</strong>
        <p>{t.createHint}</p>
        {code && <p role="alert">{enrollmentError(code, t)}</p>}
        {uncertain && <p role="alert">{t.uncertain}</p>}
        {(uncertain || code === "ACCOUNT_EXISTS") && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              clear();
              onExisting(submittedEmail);
            }}
          >
            {t.reconcile}: {submittedEmail}
          </Button>
        )}
        <Field name="new-learner-name" label={t.name}>
          <input
            className={inputClass}
            id="new-learner-name"
            required
            minLength={2}
            maxLength={100}
            value={name}
            disabled={busy}
            autoComplete="off"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field name="new-learner-email" label={t.email}>
          <input
            className={inputClass}
            id="new-learner-email"
            type="email"
            required
            maxLength={254}
            value={email}
            disabled={busy}
            autoComplete="off"
            onChange={(e) => setEmail(e.target.value)}
          />
        </Field>
        <Field
          name="new-learner-password"
          label={t.password}
          hint={t.passwordHint}
        >
          <input
            className={inputClass}
            id="new-learner-password"
            type={show ? "text" : "password"}
            required
            minLength={8}
            maxLength={128}
            value={password}
            disabled={busy}
            autoComplete="new-password"
            aria-describedby="new-learner-password-hint"
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <Button
          type="button"
          variant="outline"
          disabled={busy}
          aria-pressed={show}
          size="icon"
          aria-label={show ? t.hide : t.show}
          title={show ? t.hide : t.show}
          data-icon-action
          onClick={() => setShow((v) => !v)}
        >
          {show ? (
            <EyeOff size={18} aria-hidden="true" />
          ) : (
            <Eye size={18} aria-hidden="true" />
          )}
        </Button>
        <Field name="new-learner-confirm" label={t.confirm}>
          <input
            className={inputClass}
            id="new-learner-confirm"
            type="password"
            required
            minLength={8}
            maxLength={128}
            value={confirm}
            disabled={busy}
            autoComplete="new-password"
            onChange={(e) => setConfirm(e.target.value)}
          />
        </Field>
        <Field name="new-learner-reason" label={t.reason}>
          <input
            className={inputClass}
            id="new-learner-reason"
            required
            minLength={10}
            maxLength={500}
            value={reason}
            disabled={busy}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <Field name="new-learner-actor-password" label={t.actorPassword}>
          <input
            className={inputClass}
            id="new-learner-actor-password"
            type="password"
            required
            maxLength={128}
            value={actorPassword}
            disabled={busy}
            autoComplete="current-password"
            onChange={(e) => setActorPassword(e.target.value)}
          />
        </Field>
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={
              busy ||
              uncertain ||
              code === "ACCOUNT_EXISTS" ||
              auth.checking ||
              !!auth.error
            }
          >
            {busy ? t.working : t.submitCreate}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              clear();
              onClose();
            }}
          >
            {t.cancel}
          </Button>
        </div>
      </form>
    </AdminCourseDialog>
  );
}
