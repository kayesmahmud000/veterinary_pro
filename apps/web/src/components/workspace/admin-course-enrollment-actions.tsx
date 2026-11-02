"use client";
import { useEffect, useRef, useState } from "react";
import {
  adminEnrollmentAddSchema,
  adminEnrollmentActionSchema,
  adminEnrollmentMutationResultSchema,
  type AdminCourseEnrollment,
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
export function AdminEnrollmentAction({
  courseId,
  courseTitle,
  user,
  action,
  version,
  close,
  saved,
}: {
  courseId: string;
  courseTitle: string;
  user: AdminCourseEnrollment["user"];
  action: "ADD" | "REMOVE" | "RESTORE";
  version?: number;
  close: () => void;
  saved: () => void;
}) {
  const auth = useAuth(),
    t = getEnrollmentMessages(auth.locale),
    [reason, setReason] = useState(""),
    [password, setPassword] = useState(""),
    [busy, setBusy] = useState(false),
    [code, setCode] = useState(""),
    running = useRef(false),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  async function submit() {
    if (running.current || auth.checking || auth.error || !auth.user) return;
    const parsed = (
      action === "ADD" ? adminEnrollmentAddSchema : adminEnrollmentActionSchema
    ).safeParse(
      action === "ADD"
        ? {
            userId: user.id,
            expectedVersion: null,
            reason,
            actorPassword: password,
          }
        : { action, expectedVersion: version, reason, actorPassword: password },
    );
    if (!parsed.success) {
      setCode("VALIDATION_FAILED");
      setPassword("");
      return;
    }
    running.current = true;
    setBusy(true);
    setCode("");
    const result = await workspaceRequest(
      `admin/courses/${courseId}/enrollments${action === "ADD" ? "" : `/${user.id}/actions`}`,
      adminEnrollmentMutationResultSchema,
      "POST",
      parsed.data,
      `${auth.user.id}:${auth.user.role}:${auth.user.roleVersion ?? 0}`,
    );
    if (!active.current) return;
    setPassword("");
    setBusy(false);
    running.current = false;
    if (result.data) saved();
    else setCode(result.code ?? "UNAVAILABLE");
  }
  const label =
    action === "REMOVE" ? t.remove : action === "RESTORE" ? t.restore : t.add;
  return (
    <AdminCourseDialog title={label} close={close} busy={busy}>
      <form
        data-enrollment-action
        className="space-y-5"
        aria-busy={busy}
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <p className="break-words">
          <strong>{courseTitle}</strong>
          <br />
          {user.name}
          <br />
          {user.email}
        </p>
        {action === "REMOVE" && <p>{t.removeHint}</p>}
        {code && <p role="alert">{enrollmentError(code, t)}</p>}
        <Field name="enrollment-reason" label={t.reason}>
          <input
            id="enrollment-reason"
            value={reason}
            minLength={10}
            maxLength={500}
            required
            disabled={busy}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <Field name="enrollment-password" label={t.actorPassword}>
          <input
            id="enrollment-password"
            type="password"
            autoComplete="current-password"
            value={password}
            maxLength={128}
            required
            disabled={busy}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        <div className="flex flex-wrap gap-3">
          <Button
            disabled={
              busy ||
              auth.checking ||
              !!auth.error ||
              code === "ENROLLMENT_VERSION_CONFLICT"
            }
          >
            {busy ? t.working : t.confirmAction}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={close}
          >
            {code === "ENROLLMENT_VERSION_CONFLICT" ? t.retry : t.cancel}
          </Button>
        </div>
      </form>
    </AdminCourseDialog>
  );
}
