"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import {
  UserRole,
  adminCourseEnrollmentListSchema,
  adminUserCourseListSchema,
  adminCourseCandidateListSchema,
  adminProductSchema,
  type AdminCourseEnrollment,
  type AdminCourseCandidateList,
} from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import {
  getEnrollmentMessages,
  enrollmentError,
  enrollmentValue,
} from "@/lib/i18n/admin-course-enrollments";
import { Button, buttonVariants } from "@/components/ui/button";
import { WorkspaceGate } from "./workspace-gate";
import { useRemote, Field } from "./workspace-ui";
import { AdminCourseDialog } from "./admin-course-dialog";
import { AdminEnrollmentAction } from "./admin-course-enrollment-actions";
import { AdminCourseUserCreate } from "./admin-course-user-create";
const roles = [UserRole.ADMIN, UserRole.SUPER_ADMIN];
export function useEnrollmentRefresh(reload: () => void) {
  useEffect(() => {
    const run = () => reload();
    window.addEventListener("focus", run);
    window.addEventListener("vetralink-enrollments-updated", run);
    return () => {
      window.removeEventListener("focus", run);
      window.removeEventListener("vetralink-enrollments-updated", run);
    };
  }, [reload]);
}
function Candidates({
  id,
  email,
  close,
  select,
  create,
}: {
  id: string;
  email?: string;
  close: () => void;
  select: (candidate: AdminCourseCandidateList["items"][number]) => void;
  create: () => void;
}) {
  const auth = useAuth(),
    t = getEnrollmentMessages(auth.locale),
    [search, setSearch] = useState(email ?? ""),
    [applied, setApplied] = useState(
      email ? `email=${encodeURIComponent(email)}` : "",
    ),
    [cursors, setCursors] = useState([""]),
    [invalid, setInvalid] = useState(false);
  const data = useRemote(
    applied
      ? `admin/courses/${id}/enrollment-candidates?limit=20&${applied}${cursors.at(-1) ? `&cursor=${cursors.at(-1)}` : ""}`
      : null,
    adminCourseCandidateListSchema,
  );
  return (
    <AdminCourseDialog title={t.add} close={close}>
      <div className="space-y-4">
        <form
          data-candidate-search
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            const value = search.trim();
            if (value.length < 2) {
              setInvalid(true);
              return;
            }
            setApplied(
              `${/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value) ? "email" : "search"}=${encodeURIComponent(value)}`,
            );
            setCursors([""]);
            setInvalid(false);
          }}
        >
          <Field name="candidate-search" label={t.search}>
            <input
              id="candidate-search"
              className="box-border w-full rounded-lg border border-solid border-line p-3"
              value={search}
              maxLength={254}
              required
              minLength={2}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
          <Button>{t.find}</Button>
        </form>
        {invalid && <p role="alert">{t.validation}</p>}
        {applied &&
          (data.loading ? (
            <p role="status">{t.loading}</p>
          ) : data.code ? (
            <p role="alert">{enrollmentError(data.code, t)}</p>
          ) : !data.data?.items.length ? (
            <p>{t.noUsers}</p>
          ) : (
            <ul className="list-none space-y-3 p-0">
              {data.data.items.map((user) => (
                <li
                  key={user.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-solid border-line p-3"
                >
                  <div className="min-w-0 break-words">
                    <strong>{user.name}</strong>
                    <div className="[overflow-wrap:anywhere]">{user.email}</div>
                    <small>{enrollmentValue(user.status, auth.locale)}</small>
                  </div>
                  {user.canAdd || user.canRestore ? (
                    <Button
                      data-select-learner
                      type="button"
                      onClick={() => select(user)}
                    >
                      {user.canRestore ? t.restore : t.select}
                    </Button>
                  ) : (
                    <span>
                      {user.enrollment?.status === "ACTIVE"
                        ? t.already
                        : t.noAction}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ))}
        <div className="flex flex-wrap gap-3">
          {cursors.length > 1 && (
            <Button
              variant="outline"
              onClick={() => setCursors((v) => v.slice(0, -1))}
            >
              {t.previous}
            </Button>
          )}
          {data.data?.nextCursor && (
            <Button
              variant="outline"
              onClick={() => setCursors((v) => [...v, data.data!.nextCursor!])}
            >
              {t.next}
            </Button>
          )}
          <Button type="button" variant="outline" onClick={create}>
            {t.create}
          </Button>
          <Button type="button" variant="outline" onClick={close}>
            {t.cancel}
          </Button>
        </div>
      </div>
    </AdminCourseDialog>
  );
}
type Action = {
  courseId: string;
  courseTitle: string;
  user: AdminCourseEnrollment["user"];
  action: "ADD" | "REMOVE" | "RESTORE";
  version?: number;
};
function MembershipDirectory({
  courseId,
  userId,
}: {
  courseId?: string;
  userId?: string;
}) {
  const auth = useAuth(),
    t = getEnrollmentMessages(auth.locale),
    [status, setStatus] = useState("ACTIVE"),
    [search, setSearch] = useState(""),
    [applied, setApplied] = useState(""),
    [cursors, setCursors] = useState([""]),
    [action, setAction] = useState<Action | null>(null),
    [adding, setAdding] = useState(false),
    [exactEmail, setExactEmail] = useState<string | undefined>(),
    [creating, setCreating] = useState(false),
    [notice, setNotice] = useState("");
  const suffix = `?limit=20&status=${status}${cursors.at(-1) ? `&cursor=${cursors.at(-1)}` : ""}${applied ? `&search=${encodeURIComponent(applied)}` : ""}`;
  const courseData = useRemote(
      courseId ? `admin/courses/${courseId}/enrollments${suffix}` : null,
      adminCourseEnrollmentListSchema,
    ),
    userData = useRemote(
      userId ? `admin/directory/users/${userId}/courses${suffix}` : null,
      adminUserCourseListSchema,
    );
  const courseSummary = useRemote(
    courseId && courseData.code ? `admin/products/${courseId}` : null,
    adminProductSchema,
  );
  const reload = () => {
    courseData.reload();
    userData.reload();
    courseSummary.reload();
  };
  useEnrollmentRefresh(reload);
  const data = courseId ? courseData : userData;
  const date = (v: string) =>
    new Intl.DateTimeFormat(auth.locale === "bn" ? "bn-BD" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Dhaka",
    }).format(new Date(v));
  const completed = (created = false) => {
    setAction(null);
    setCreating(false);
    setCursors([""]);
    setNotice(created ? t.created : t.saved);
    window.dispatchEvent(new Event("vetralink-enrollments-updated"));
  };
  const rows = courseId
    ? courseData.data?.items.map((r) => ({
        ...r,
        course: courseData.data!.course,
      }))
    : userData.data?.items.map((r) => ({ ...r, user: userData.data!.user }));
  const title =
    courseData.data?.course.title ?? courseSummary.data?.title ?? t.title;
  return (
    <section data-enrollment-manager className="min-w-0 space-y-5">
      {courseId ? (
        <>
          <Link
            className={buttonVariants({ variant: "outline" })}
            href="/admin/courses"
          >
            {t.back}
          </Link>
          <div className="space-y-2">
            <p className="m-0 text-sm font-medium text-muted">{t.title}</p>
            <h1 className="m-0 break-words text-3xl font-semibold">{title}</h1>
          </div>
          {courseData.data && (
            <>
              <p>
                {courseData.data.course.isPublished
                  ? t.published
                  : t.unpublished}{" "}
                · {t.active}:{" "}
                {new Intl.NumberFormat(auth.locale).format(
                  courseData.data.activeCount,
                )}{" "}
                · {t.revoked}:{" "}
                {new Intl.NumberFormat(auth.locale).format(
                  courseData.data.revokedCount,
                )}
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  data-add-learner
                  onClick={() => {
                    setExactEmail(undefined);
                    setAdding(true);
                  }}
                >
                  {t.add}
                </Button>
                <Button
                  data-create-learner
                  variant="outline"
                  disabled={!courseData.data.course.isPublished}
                  onClick={() => setCreating(true)}
                >
                  {t.create}
                </Button>
              </div>
            </>
          )}
        </>
      ) : (
        <h2 className="text-xl font-semibold">{t.courses}</h2>
      )}
      {notice && <p role="status">{notice}</p>}
      <p className="text-sm text-muted">{t.timezone}</p>
      <div className="flex flex-wrap items-end gap-3">
        <Field
          name={`enrollment-status-${courseId ?? userId}`}
          label={t.status}
        >
          <select
            id={`enrollment-status-${courseId ?? userId}`}
            data-enrollment-status
            className="box-border w-full rounded-lg border border-solid border-line bg-white p-3"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setCursors([""]);
            }}
          >
            <option value="ACTIVE">{t.active}</option>
            <option value="REVOKED">{t.revoked}</option>
            <option value="ALL">{t.all}</option>
          </select>
        </Field>
        {courseId && (
          <form
            className="flex min-w-0 flex-wrap items-end gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              setApplied(search.trim());
              setCursors([""]);
            }}
          >
            <Field name="enrollment-search" label={t.search}>
              <input
                id="enrollment-search"
                className="box-border w-full rounded-lg border border-solid border-line p-3"
                value={search}
                maxLength={100}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
            <Button>{t.find}</Button>
          </form>
        )}
        <Button variant="outline" onClick={reload}>
          {t.retry}
        </Button>
      </div>
      {data.loading ? (
        <p role="status">{t.loading}</p>
      ) : data.code ? (
        <p role="alert">{enrollmentError(data.code, t)}</p>
      ) : !rows?.length ? (
        <p role="status">{t.empty}</p>
      ) : (
        <div
          className="max-w-full overflow-x-auto rounded-xl border border-solid border-line focus-visible:outline focus-visible:outline-2 focus-visible:outline-green"
          role="region"
          aria-label={courseId ? t.title : t.courses}
          tabIndex={0}
        >
          <table
            className={
              courseId
                ? "w-full min-w-[64rem] table-fixed border-collapse text-left"
                : "w-full table-fixed border-collapse text-left"
            }
          >
            <caption className="sr-only">
              {courseId ? `${title} · ${t.title}` : t.courses}
            </caption>
            <thead>
              <tr>
                <th scope="col" className="p-3">
                  {courseId ? t.name : t.courses}
                </th>
                {courseId && (
                  <>
                    <th scope="col" className="p-3">
                      {t.email}
                    </th>
                    <th scope="col" className="w-36 p-3">
                      {t.status}
                    </th>
                    <th scope="col" className="w-64 p-3">
                      {t.dates}
                    </th>
                  </>
                )}
                <th scope="col" className="w-24 p-3 text-right sm:w-44">
                  {t.actions}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const ordinary = !["ADMIN", "SUPER_ADMIN"].includes(
                  row.user.role,
                );
                const dates = (
                  <div className="space-y-2 text-sm">
                    <p className="m-0">
                      {t.original}: {date(row.createdAt)}
                    </p>
                    <p className="m-0">
                      {t.latest}: {date(row.activatedAt)}
                    </p>
                    {row.revokedAt && (
                      <p className="m-0">
                        {t.removedAt}: {date(row.revokedAt)}
                      </p>
                    )}
                  </div>
                );
                return (
                  <tr
                    key={row.id}
                    data-membership-row
                    className="border-0 border-t border-solid border-line align-top"
                  >
                    <td className="min-w-0 break-words p-3">
                      {courseId ? (
                        <>
                          <Link
                            href={`/admin/users/${row.userId}`}
                            className="font-semibold text-teal"
                          >
                            {row.user.name}
                          </Link>
                          <p className="mb-0 mt-2 text-sm text-muted">
                            {t.account}:{" "}
                            {enrollmentValue(row.user.status, auth.locale)}
                          </p>
                        </>
                      ) : row.course.deletedAt ? (
                        <strong>
                          {row.course.title} · {t.unavailable}
                        </strong>
                      ) : (
                        <Link
                          href={`/admin/courses/${row.productId}/learners`}
                          className="font-semibold text-teal"
                        >
                          {row.course.title}
                        </Link>
                      )}
                      {!courseId && (
                        <>
                          <p className="my-2 text-sm">
                            {enrollmentValue(row.status, auth.locale)} ·{" "}
                            {row.course.isPublished
                              ? t.published
                              : t.unpublished}
                          </p>
                          {dates}
                        </>
                      )}
                    </td>
                    {courseId && (
                      <>
                        <td className="p-3 [overflow-wrap:anywhere]">
                          {row.user.email}
                        </td>
                        <td className="p-3">
                          <span
                            className={
                              row.status === "ACTIVE"
                                ? "inline-flex rounded-full bg-green/10 px-3 py-1 text-sm font-medium text-green"
                                : "inline-flex rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700"
                            }
                          >
                            {enrollmentValue(row.status, auth.locale)}
                          </span>
                        </td>
                        <td className="p-3">{dates}</td>
                      </>
                    )}
                    <td className="p-3 text-right">
                      {ordinary &&
                      !row.course.deletedAt &&
                      (row.status === "ACTIVE" ||
                        (row.course.isPublished &&
                          row.user.status === "ACTIVE")) ? (
                        <Button
                          type="button"
                          data-membership-remove={
                            row.status === "ACTIVE" ? "" : undefined
                          }
                          data-membership-restore={
                            row.status === "REVOKED" ? "" : undefined
                          }
                          variant={
                            row.status === "ACTIVE" ? "ghost" : "outline"
                          }
                          aria-label={
                            row.status === "ACTIVE"
                              ? `${t.remove}: ${row.user.name}`
                              : undefined
                          }
                          title={row.status === "ACTIVE" ? t.remove : undefined}
                          className={
                            row.status === "ACTIVE"
                              ? "h-11 w-11 shrink-0 p-0 text-red-600 hover:bg-red-50 hover:text-red-700 focus-visible:outline-red-600"
                              : "w-full whitespace-normal px-2"
                          }
                          onClick={() =>
                            setAction({
                              courseId: row.productId,
                              courseTitle: row.course.title,
                              user: row.user,
                              action:
                                row.status === "ACTIVE" ? "REMOVE" : "RESTORE",
                              version: row.version,
                            })
                          }
                        >
                          {row.status === "ACTIVE" ? (
                            <Trash2 size={18} aria-hidden="true" />
                          ) : (
                            t.restore
                          )}
                        </Button>
                      ) : (
                        <small>{t.noAction}</small>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        {cursors.length > 1 && (
          <Button
            variant="outline"
            disabled={data.loading}
            onClick={() => setCursors((v) => v.slice(0, -1))}
          >
            {t.previous}
          </Button>
        )}
        {data.data?.nextCursor && (
          <Button
            variant="outline"
            disabled={data.loading}
            onClick={() => setCursors((v) => [...v, data.data!.nextCursor!])}
          >
            {t.next}
          </Button>
        )}
      </div>
      {action && (
        <AdminEnrollmentAction
          {...action}
          close={() => {
            setAction(null);
            reload();
          }}
          saved={() => completed()}
        />
      )}
      {adding && courseId && (
        <Candidates
          id={courseId}
          email={exactEmail}
          close={() => setAdding(false)}
          create={() => {
            setAdding(false);
            setCreating(true);
          }}
          select={(user) => {
            setAdding(false);
            setAction({
              courseId,
              courseTitle: title,
              user,
              action: user.enrollment?.status === "REVOKED" ? "RESTORE" : "ADD",
              version: user.enrollment?.version,
            });
          }}
        />
      )}
      {creating && courseId && (
        <AdminCourseUserCreate
          courseId={courseId}
          courseTitle={title}
          onCreated={() => completed(true)}
          onClose={() => setCreating(false)}
          onExisting={(email) => {
            setCreating(false);
            setExactEmail(email);
            setAdding(true);
          }}
        />
      )}
    </section>
  );
}
export function AdminCourseEnrollments({ courseId }: { courseId: string }) {
  const auth = useAuth();
  return (
    <WorkspaceGate allowedRoles={roles}>
      <MembershipDirectory
        key={`${courseId}:${auth.user?.id}:${auth.user?.roleVersion}`}
        courseId={courseId}
      />
    </WorkspaceGate>
  );
}
export function AdminUserCourses({ userId }: { userId: string }) {
  const auth = useAuth();
  return (
    <WorkspaceGate allowedRoles={roles}>
      <MembershipDirectory
        key={`${userId}:${auth.user?.id}:${auth.user?.roleVersion}`}
        userId={userId}
      />
    </WorkspaceGate>
  );
}
