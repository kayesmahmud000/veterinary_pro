"use client";
import Link from "next/link";
import { useState } from "react";
import { Plus, Pencil, Eye, EyeOff, Globe, Trash2 } from "lucide-react";
import {
  type AdminProduct,
  adminProductSchema,
  adminProductListSchema,
  adminCurriculumSchema,
  UserRole,
} from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import { getAdminCourseMessages } from "@/lib/i18n/admin-courses";
import { getCatalogMessages } from "@/lib/i18n/admin-catalog";
import { CourseArtwork } from "@/components/courses/course-artwork";
import { CourseLoading } from "@/components/courses/course-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { WorkspaceGate } from "./workspace-gate";
import { useRemote, Field } from "./workspace-ui";
import { CatalogError } from "./admin-products";
import { AdminCourseDialog } from "./admin-course-dialog";
import { AdminCourseAction, type CourseAction } from "./admin-course-actions";
import styles from "./workspace.styles";
import { cn } from "@/lib/ui/cn";

export function AdminCourseFacts({ product }: { product: AdminProduct }) {
  const auth = useAuth(),
    t = getAdminCourseMessages(auth.locale),
    n = new Intl.NumberFormat(auth.locale);
  return (
    <dl className="m-0 grid grid-cols-2 gap-4 rounded-xl bg-paper p-4 text-sm">
      <div>
        <dt className="text-muted">{t.lessonCount}</dt>
        <dd className="m-0 mt-1 font-semibold">
          {product.lessonCount === undefined
            ? t.unavailableCount
            : n.format(product.lessonCount)}
        </dd>
      </div>
      <div>
        <dt className="text-muted">{t.learners}</dt>
        <dd className="m-0 mt-1 font-semibold">
          {product.enrollmentCount === undefined
            ? t.unavailableCount
            : n.format(product.enrollmentCount)}
        </dd>
      </div>
    </dl>
  );
}
export function AdminCourseDetails({
  id,
  close,
}: {
  id: string;
  close: () => void;
}) {
  const t = getAdminCourseMessages(useAuth().locale),
    data = useRemote(`admin/products/${id}`, adminProductSchema),
    curriculum = useRemote(
      `admin/products/${id}/curriculum`,
      adminCurriculumSchema,
    ),
    p = data.data;
  return (
    <AdminCourseDialog title={t.details} close={close}>
      {data.loading ? (
        <CourseLoading />
      ) : data.code || !p ? (
        <CatalogError code={data.code ?? "NOT_FOUND"} retry={data.reload} />
      ) : (
        <div data-admin-course-details className="space-y-5">
          <div className="overflow-hidden rounded-xl">
            <CourseArtwork
              src={p.thumbnailUrl ?? p.previewImageUrl}
              title={p.title}
              priority
            />
          </div>
          <h3 className="break-words text-xl font-semibold">{p.title}</h3>
          <p className="break-words whitespace-pre-wrap">{p.description}</p>
          <p className="break-all text-sm text-muted">/{p.slug}</p>
          <p>
            {p.isPublished ? t.live : t.draft} ·{" "}
            {p.priceCents === 0
              ? t.freeCourse
              : `${t.paidCourse} · ${p.currency} ${p.priceCents / 100}`}
          </p>
          <AdminCourseFacts product={p} />
          {curriculum.loading ? (
            <CourseLoading />
          ) : curriculum.code ? (
            <CatalogError code={curriculum.code} retry={curriculum.reload} />
          ) : (
            <ol className="space-y-2 pl-5">
              {curriculum.data?.lessons.map((lesson) => (
                <li key={lesson.id} className="break-words">
                  {lesson.title}
                </li>
              ))}
            </ol>
          )}
          <Link className={buttonVariants()} href={`/admin/courses/${id}`}>
            {t.edit}
          </Link>
        </div>
      )}
    </AdminCourseDialog>
  );
}
function CourseManagement() {
  const auth = useAuth(),
    t = getAdminCourseMessages(auth.locale),
    common = getCatalogMessages(auth.locale);
  const [search, setSearch] = useState(""),
    [publication, setPublication] = useState(""),
    [query, setQuery] = useState(""),
    [cursors, setCursors] = useState([""]),
    [details, setDetails] = useState<string | null>(null),
    [action, setAction] = useState<{
      product: AdminProduct;
      kind: CourseAction;
    } | null>(null),
    [notice, setNotice] = useState("");
  const data = useRemote(
    `admin/products?limit=20&type=VIDEO_COURSE&contentProvider=YOUTUBE${query ? `&${query}` : ""}${cursors.at(-1) ? `&cursor=${cursors.at(-1)}` : ""}`,
    adminProductListSchema,
  );
  return (
    <div data-admin-courses-list className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="mb-0 max-w-2xl">{t.manageIntro}</p>
        <Link
          data-add-course
          href="/admin/courses/new"
          className={buttonVariants()}
        >
          <Plus size={18} aria-hidden="true" />
          {t.addNew}
        </Link>
      </div>
      <form
        className={`${styles.card} flex flex-wrap items-end gap-4`}
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(
            new URLSearchParams({
              ...(search ? { search } : {}),
              ...(publication ? { publication } : {}),
            }).toString(),
          );
          setCursors([""]);
        }}
      >
        <div className="min-w-0 flex-1">
          <Field name="catalog-search" label={common.search}>
            <input
              id="catalog-search"
              maxLength={100}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </Field>
        </div>
        <Field name="catalog-publication" label={common.publication}>
          <select
            id="catalog-publication"
            value={publication}
            onChange={(event) => setPublication(event.target.value)}
          >
            <option value="">{common.all}</option>
            <option value="DRAFT">{t.draft}</option>
            <option value="PUBLISHED">{t.live}</option>
          </select>
        </Field>
        <Button>{common.apply}</Button>
      </form>
      {notice && (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      )}
      {data.loading ? (
        <CourseLoading />
      ) : data.code ? (
        <CatalogError code={data.code} retry={data.reload} />
      ) : !data.data?.items.length ? (
        <section className={styles.card}>
          <p>{t.emptyList}</p>
        </section>
      ) : (
        <div
          data-course-table
          className="rounded-2xl border border-solid border-line bg-white"
        >
          <table className="w-full table-fixed border-collapse text-left text-sm">
            <caption className="sr-only">{t.courses}</caption>
            <thead className="bg-paper text-muted">
              <tr>
                {[
                  { label: t.course, classes: "xl:w-[28%]" },
                  {
                    label: common.publication,
                    classes: "hidden xl:table-cell xl:w-[12%]",
                  },
                  {
                    label: t.pricing,
                    classes: "hidden xl:table-cell xl:w-[12%]",
                  },
                  {
                    label: t.lessonCount,
                    classes: "hidden xl:table-cell xl:w-[8%]",
                  },
                  {
                    label: t.learners,
                    classes: "hidden xl:table-cell xl:w-[10%]",
                  },
                  {
                    label: common.updatedAt,
                    classes: "hidden xl:table-cell xl:w-[12%]",
                  },
                  { label: t.actions, classes: "w-28 text-right sm:w-52 xl:w-[18%]" },
                ].map(({ label, classes }) => (
                  <th
                    key={label}
                    scope="col"
                    className={`${classes} break-words px-2 py-4 font-semibold sm:px-3`}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.data.items.map((p, index) => {
                const number = new Intl.NumberFormat(auth.locale),
                  lessons =
                    p.lessonCount === undefined
                      ? t.unavailableCount
                      : number.format(p.lessonCount),
                  learners =
                    p.enrollmentCount === undefined
                      ? t.unavailableCount
                      : number.format(p.enrollmentCount),
                  publication = p.isPublished ? t.live : t.draft,
                  pricing =
                    p.priceCents === 0
                      ? t.freeCourse
                      : `${t.paidCourse} · ${p.currency} ${new Intl.NumberFormat(auth.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(p.priceCents / 100)}`,
                  updated = new Intl.DateTimeFormat(auth.locale, {
                    dateStyle: "medium",
                    timeZone: "Asia/Dhaka",
                  }).format(new Date(p.updatedAt)),
                  actionLabel = p.isPublished ? t.unpublish : t.publish;
                return (
                  <tr
                    data-product-row
                    key={p.id}
                    className="border-0 border-b border-solid border-line align-top last:border-b-0"
                  >
                    <th
                      scope="row"
                      className="break-words px-2 py-4 font-normal sm:px-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="hidden w-16 shrink-0 overflow-hidden rounded-lg sm:block">
                          <CourseArtwork
                            src={p.thumbnailUrl ?? p.previewImageUrl}
                            title={p.title}
                            priority={index === 0}
                            compact
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/admin/courses/${p.id}`}
                            className="break-words font-semibold text-green underline underline-offset-4"
                          >
                            {p.title}
                          </Link>
                          <p className="mb-0 mt-2 break-all text-xs text-muted">
                            /{p.slug}
                          </p>
                          <div className="mt-3 space-y-2 text-xs xl:hidden">
                            <p className="m-0">
                              <span className="font-semibold">
                                {publication}
                              </span>{" "}
                              · {pricing}
                            </p>
                            <dl className="m-0 space-y-1 text-muted">
                              <div>
                                <dt className="inline">{t.lessonCount}: </dt>
                                <dd className="m-0 inline tabular-nums">
                                  {lessons}
                                </dd>
                              </div>
                              <div>
                                <dt className="inline">{t.learners}: </dt>
                                <dd className="m-0 inline tabular-nums">
                                  {learners}
                                </dd>
                              </div>
                              <div>
                                <dt className="inline">{t.updated}: </dt>
                                <dd className="m-0 inline">
                                  <time dateTime={p.updatedAt}>{updated}</time>
                                </dd>
                              </div>
                            </dl>
                          </div>
                        </div>
                      </div>
                    </th>
                    <td className="hidden break-words px-3 py-4 xl:table-cell">
                      <span className="inline-block rounded-full bg-paper px-2 py-1 text-xs font-semibold">
                        {publication}
                      </span>
                    </td>
                    <td className="hidden break-words px-3 py-4 text-xs xl:table-cell">
                      {pricing}
                    </td>
                    <td className="hidden break-words px-3 py-4 tabular-nums xl:table-cell">
                      {lessons}
                    </td>
                    <td className="hidden break-words px-3 py-4 tabular-nums xl:table-cell">
                      {learners}
                    </td>
                    <td className="hidden break-words px-3 py-4 text-muted xl:table-cell">
                      <time dateTime={p.updatedAt}>{updated}</time>
                    </td>
                    <td className="px-2 py-4 sm:px-3">
                      <div className="ml-auto grid w-fit grid-cols-2 gap-1 sm:grid-cols-4 xl:grid-cols-2 2xl:grid-cols-4">
                        <Button
                          data-course-details
                          variant="outline"
                          className="box-border h-11 w-11 p-0"
                          aria-label={t.details}
                          title={t.details}
                          onClick={() => setDetails(p.id)}
                        >
                          <Eye size={18} aria-hidden="true" />
                        </Button>
                        <Link
                          data-course-edit
                          href={`/admin/courses/${p.id}`}
                          className={cn(
                            buttonVariants({ variant: "outline" }),
                            "box-border h-11 w-11 p-0",
                          )}
                          aria-label={t.edit}
                          title={t.edit}
                        >
                          <Pencil size={18} aria-hidden="true" />
                        </Link>
                        <Button
                          data-course-publication
                          variant="outline"
                          className="box-border h-11 w-11 p-0"
                          aria-label={actionLabel}
                          title={
                            !p.isPublished && p.priceCents > 0
                              ? t.paidHint
                              : actionLabel
                          }
                          disabled={!p.isPublished && p.priceCents > 0}
                          onClick={() =>
                            setAction({
                              product: p,
                              kind: p.isPublished ? "UNPUBLISH" : "PUBLISH",
                            })
                          }
                        >
                          {p.isPublished ? (
                            <EyeOff size={18} aria-hidden="true" />
                          ) : (
                            <Globe size={18} aria-hidden="true" />
                          )}
                        </Button>
                        <Button
                          data-course-delete
                          variant="ghost"
                          className="box-border h-11 w-11 p-0"
                          aria-label={t.delete}
                          title={t.delete}
                          onClick={() =>
                            setAction({ product: p, kind: "DELETE" })
                          }
                        >
                          <Trash2 size={18} aria-hidden="true" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        <Button variant="outline" onClick={data.reload} disabled={data.loading}>
          {common.refresh}
        </Button>
        {cursors.length > 1 && (
          <Button
            variant="outline"
            disabled={data.loading}
            onClick={() => setCursors((v) => v.slice(0, -1))}
          >
            {common.previous}
          </Button>
        )}
        {!data.loading && data.data?.nextCursor && (
          <Button
            variant="outline"
            onClick={() => setCursors((v) => [...v, data.data!.nextCursor!])}
          >
            {common.next}
          </Button>
        )}
      </div>
      {details && (
        <AdminCourseDetails id={details} close={() => setDetails(null)} />
      )}
      {action && (
        <AdminCourseAction
          key={`${action.product.id}:${action.kind}`}
          product={action.product}
          action={action.kind}
          close={() => setAction(null)}
          reload={data.reload}
          saved={(_, kind) => {
            setAction(null);
            setNotice(kind === "DELETE" ? t.deleted : t.actionSaved);
            data.reload();
          }}
        />
      )}
    </div>
  );
}
export function AdminCourses() {
  const t = getAdminCourseMessages(useAuth().locale);
  return (
    <main id="main-content" data-admin-courses className={styles.shell}>
      <h1 className={styles.heading}>{t.courses}</h1>
      <WorkspaceGate
        allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}
        loadingFallback={<CourseLoading />}
      >
        <CourseManagement />
      </WorkspaceGate>
    </main>
  );
}
