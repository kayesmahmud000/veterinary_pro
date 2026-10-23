"use client";
import { useEffect, useRef, useState } from "react";
import {
  type AdminProduct,
  type AdminProductAction,
  adminProductActionSchema,
  adminProductSchema,
} from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import { workspaceRequest } from "@/lib/workspace/client";
import { getAdminCourseMessages } from "@/lib/i18n/admin-courses";
import { Button } from "@/components/ui/button";
import { AdminCourseDialog } from "./admin-course-dialog";
import { CatalogError } from "./admin-products";
import { Field } from "./workspace-ui";
export type CourseAction = AdminProductAction["action"];
export function AdminCourseAction({
  product,
  action,
  close,
  saved,
  reload,
}: {
  product: AdminProduct;
  action: CourseAction;
  close: () => void;
  saved: (product: AdminProduct, action: CourseAction) => void;
  reload: () => void;
}) {
  const auth = useAuth(),
    t = getAdminCourseMessages(auth.locale),
    [reason, setReason] = useState(""),
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
  const label =
    action === "DELETE"
      ? t.delete
      : action === "PUBLISH"
        ? t.publish
        : t.unpublish;
  async function submit() {
    if (running.current || auth.checking || auth.error || !auth.user) return;
    const input = adminProductActionSchema.safeParse({
      action,
      expectedVersion: product.version,
      reason,
    });
    if (!input.success) {
      setCode("VALIDATION_FAILED");
      return;
    }
    running.current = true;
    setBusy(true);
    setCode("");
    const result = await workspaceRequest(
      `admin/products/${product.id}/actions`,
      adminProductSchema,
      "POST",
      input.data,
      `${auth.user.id}:${auth.user.role}:${auth.user.roleVersion ?? 0}`,
    );
    if (!active.current) return;
    running.current = false;
    setBusy(false);
    if (result.data) saved(result.data, action);
    else setCode(result.code ?? "UNAVAILABLE");
  }
  return (
    <AdminCourseDialog title={label} close={close} busy={busy}>
      <form
        data-admin-course-action
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
        aria-busy={busy}
      >
        <strong className="block break-words text-xl">{product.title}</strong>
        <p>
          {action === "DELETE"
            ? t.deleteHint
            : action === "UNPUBLISH"
              ? t.unpublishHint
              : t.publishHint}
        </p>
        {action === "DELETE" && (
          <p>
            {t.learners}:{" "}
            {product.enrollmentCount === undefined
              ? t.unavailableCount
              : new Intl.NumberFormat(auth.locale).format(
                  product.enrollmentCount,
                )}
          </p>
        )}
        {code && (
          <>
            <CatalogError code={code} />
            {code === "PRODUCT_VERSION_CONFLICT" && (
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  close();
                  reload();
                }}
              >
                {t.reload}
              </Button>
            )}
          </>
        )}
        <Field name="course-action-reason" label={t.actionReason}>
          <textarea
            id="course-action-reason"
            required
            minLength={10}
            maxLength={500}
            value={reason}
            disabled={busy}
            onChange={(event) => setReason(event.target.value)}
          />
        </Field>
        <div className="flex flex-wrap gap-3">
          <Button
            data-confirm-course-action
            disabled={busy || auth.checking || !!auth.error}
          >
            {busy ? t.working : t.confirm}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={close}
          >
            {t.cancel}
          </Button>
        </div>
      </form>
    </AdminCourseDialog>
  );
}
