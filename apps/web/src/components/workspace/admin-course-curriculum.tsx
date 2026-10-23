"use client";
import { useEffect, useRef, useState } from "react";
import { YouTubePlayer } from "@/components/courses/youtube-player";
import Link from "next/link";
import {
  adminCurriculumSchema,
  adminCurriculumWriteSchema,
  adminProductSchema,
  normalizeYouTubeVideoId,
  UserRole,
  type AdminCurriculum,
} from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import { getAdminCourseMessages } from "@/lib/i18n/admin-courses";
import { getCatalogMessages } from "@/lib/i18n/admin-catalog";
import { workspaceRequest } from "@/lib/workspace/client";
import { useUnsavedChanges } from "./use-unsaved-changes";
import { WorkspaceGate } from "./workspace-gate";
import { Field, useRemote } from "./workspace-ui";
import { CatalogError } from "./admin-products";
import styles from "./workspace.styles";
type Row = {
  key: string;
  id?: string;
  title: string;
  summary: string;
  access: "PUBLIC_DEMO" | "ENROLLED";
  videoUrl: string;
};
export function CourseLessonEditor({
  initial,
  reload,
  courseWorkspace = false,
  courseTitle,
  embedded = false,
  locked = false,
  previewEnabled = true,
  onSaved,
  onStateChange,
}: {
  initial: AdminCurriculum;
  reload: () => void;
  courseWorkspace?: boolean;
  courseTitle?: string;
  embedded?: boolean;
  locked?: boolean;
  previewEnabled?: boolean;
  onSaved?: (value: AdminCurriculum) => void;
  onStateChange?: (value: { dirty: boolean; busy: boolean }) => void;
}) {
  const auth = useAuth(),
    t = getAdminCourseMessages(auth.locale),
    common = getCatalogMessages(auth.locale);
  const [version, setVersion] = useState(initial.version),
    [rows, setRows] = useState<Row[]>(() =>
      initial.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        summary: lesson.summary,
        access: lesson.access,
        key: lesson.id,
        videoUrl: `https://www.youtube.com/watch?v=${lesson.youtubeVideoId}`,
      })),
    ),
    [busy, setBusy] = useState(false),
    [code, setCode] = useState(""),
    [dirty, setDirty] = useState(false),
    [saved, setSaved] = useState(false),
    [preview, setPreview] = useState<{ id: string; title: string } | null>(
      null,
    );
  const running = useRef(false),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const disabled =
    locked || busy || initial.isPublished || auth.checking || !!auth.error;
  const [savedRows, setSavedRows] = useState(rows);
  useEffect(() => setVersion(initial.version), [initial.version]);
  useEffect(
    () => onStateChange?.({ dirty, busy }),
    [dirty, busy, onStateChange],
  );
  const confirmDiscard = useUnsavedChanges(
    !embedded && dirty,
    t.discard,
    () => {
      setRows(savedRows);
      setDirty(false);
      setPreview(null);
    },
  );
  function change(next: Row[]) {
    setRows(next);
    setDirty(true);
    setSaved(false);
    setCode("");
    setPreview(null);
  }
  function move(index: number, offset: number) {
    const next = [...rows];
    [next[index], next[index + offset]] = [next[index + offset], next[index]];
    change(next);
  }
  async function save() {
    if (disabled || running.current) return;
    const input = adminCurriculumWriteSchema.safeParse({
      expectedVersion: version,
      lessons: rows.map(({ key, ...row }) => row),
    });
    if (!input.success) {
      setCode("INVALID_CURRICULUM");
      return;
    }
    running.current = true;
    setBusy(true);
    setCode("");
    setSaved(false);
    setPreview(null);
    const result = await workspaceRequest(
      `admin/products/${initial.productId}/curriculum`,
      adminCurriculumSchema,
      "PUT",
      input.data,
      auth.user
        ? `${auth.user.id}:${auth.user.role}:${auth.user.roleVersion ?? 0}`
        : undefined,
    );
    if (!active.current) return;
    running.current = false;
    setBusy(false);
    if (result.data) {
      setVersion(result.data.version);
      const nextRows = result.data.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title,
        summary: lesson.summary,
        access: lesson.access,
        key: lesson.id,
        videoUrl: `https://www.youtube.com/watch?v=${lesson.youtubeVideoId}`,
      }));
      setRows(nextRows);
      setSavedRows(nextRows);
      setDirty(false);
      setSaved(true);
      onSaved?.(result.data);
    } else setCode(result.code ?? "DEFAULT");
  }
  return (
    <div data-course-editor className="space-y-6">
      {courseTitle && <h2 className="text-xl font-semibold">{courseTitle}</h2>}
      {!embedded && (
        <>
          <Link
            className={styles.secondary}
            href={
              courseWorkspace
                ? "/admin/courses"
                : `/admin/products/${initial.productId}`
            }
          >
            {courseWorkspace ? t.backCourses : common.back}
          </Link>
          {courseWorkspace && (
            <Link
              className={styles.secondary}
              href={`/admin/products/${initial.productId}`}
            >
              {t.courseDetails}
            </Link>
          )}
        </>
      )}
      <p>{embedded ? t.publicHint : t.hint}</p>
      {!embedded && (
        <Link className={styles.secondary} href="/courses">
          {getCatalogMessages(auth.locale).viewCourses}
        </Link>
      )}
      {initial.isPublished && (
        <p role="status" className={styles.notice}>
          {embedded ? t.publishedEditing : t.published}
        </p>
      )}
      {code &&
        (code === "INVALID_CURRICULUM" ? (
          <p role="alert" className={styles.error}>
            {t.invalid}
          </p>
        ) : (
          <CatalogError code={code} />
        ))}
      {saved && <p role="status">{t.saved}</p>}
      {dirty && <p role="status">{t.unsaved}</p>}
      <p>
        {t.count}:{" "}
        {new Intl.NumberFormat(auth.locale === "bn" ? "bn-BD" : "en-GB").format(
          rows.length,
        )}{" "}
        ·{" "}
        {new Intl.NumberFormat(auth.locale === "bn" ? "bn-BD" : "en-GB").format(
          rows.filter((row) => row.access === "PUBLIC_DEMO").length,
        )}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        aria-busy={busy}
        className="space-y-6"
      >
        {!rows.length && <p>{t.empty}</p>}
        {rows.map((row, index) => (
          <fieldset
            data-course-lesson
            key={row.key}
            disabled={disabled}
            className={`${styles.card} space-y-5`}
          >
            <legend className="px-2 text-lg font-semibold">
              {index + 1}. {row.title || t.title}
            </legend>
            <Field name={`${row.key}-title`} label={t.title}>
              <input
                id={`${row.key}-title`}
                required
                maxLength={200}
                value={row.title}
                onChange={(e) =>
                  change(
                    rows.map((r) =>
                      r.key === row.key ? { ...r, title: e.target.value } : r,
                    ),
                  )
                }
              />
            </Field>
            <Field name={`${row.key}-summary`} label={t.summary}>
              <textarea
                id={`${row.key}-summary`}
                maxLength={1000}
                value={row.summary}
                onChange={(e) =>
                  change(
                    rows.map((r) =>
                      r.key === row.key ? { ...r, summary: e.target.value } : r,
                    ),
                  )
                }
              />
            </Field>
            <Field name={`${row.key}-url`} label={t.url}>
              <input
                id={`${row.key}-url`}
                required
                type="url"
                maxLength={2048}
                value={row.videoUrl}
                onChange={(e) =>
                  change(
                    rows.map((r) =>
                      r.key === row.key
                        ? { ...r, videoUrl: e.target.value }
                        : r,
                    ),
                  )
                }
              />
            </Field>
            <Field name={`${row.key}-access`} label={t.access}>
              <select
                id={`${row.key}-access`}
                value={row.access}
                onChange={(e) =>
                  change(
                    rows.map((r) =>
                      r.key === row.key
                        ? { ...r, access: e.target.value as Row["access"] }
                        : r,
                    ),
                  )
                }
              >
                <option value="ENROLLED">{t.ENROLLED}</option>
                <option value="PUBLIC_DEMO">{t.PUBLIC_DEMO}</option>
              </select>
            </Field>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.secondary}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                {t.up}
              </button>
              <button
                type="button"
                className={styles.secondary}
                disabled={index === rows.length - 1}
                onClick={() => move(index, 1)}
              >
                {t.down}
              </button>
              <button
                type="button"
                className={styles.secondary}
                onClick={() => {
                  if (window.confirm(t.removeConfirm))
                    change(rows.filter((r) => r.key !== row.key));
                }}
              >
                {t.remove}
              </button>
            </div>
          </fieldset>
        ))}
        <div className={styles.actions}>
          <button
            data-add-lesson
            type="button"
            disabled={disabled || rows.length >= 100}
            className={styles.secondary}
            onClick={() =>
              change([
                ...rows,
                {
                  key: crypto.randomUUID(),
                  title: "",
                  summary: "",
                  access: "ENROLLED",
                  videoUrl: "",
                },
              ])
            }
          >
            {t.add}
          </button>
          <button
            data-save-lessons
            type="submit"
            disabled={disabled || !dirty}
            className={styles.primary}
          >
            {busy ? t.saving : t.save}
          </button>
          <button
            type="button"
            data-reload-lessons
            disabled={busy || locked}
            className={styles.secondary}
            onClick={() => {
              if (embedded || !dirty || confirmDiscard()) reload();
            }}
          >
            {t.reload}
          </button>
        </div>
      </form>
      {rows.length > 0 && (
        <section className={`${styles.card} space-y-4`} aria-label={t.preview}>
          <h2>{t.preview}</h2>
          <div className={styles.actions}>
            {rows.map((row, index) => (
              <button
                key={row.key}
                type="button"
                className={styles.secondary}
                disabled={busy || locked}
                onClick={() => {
                  try {
                    setPreview({
                      id: normalizeYouTubeVideoId(row.videoUrl),
                      title: row.title || t.title,
                    });
                    setCode("");
                  } catch {
                    setCode("INVALID_CURRICULUM");
                  }
                }}
              >
                {index + 1}. {row.title || t.preview}
              </button>
            ))}
          </div>
          {preview && previewEnabled && !auth.checking && !auth.error && (
            <>
              {embedded ? (
                <div data-admin-video-preview>
                  <YouTubePlayer videoId={preview.id} title={preview.title} />
                </div>
              ) : (
                <iframe
                  key={`${preview.id}:${preview.title}`}
                  data-youtube-preview
                  className="aspect-video min-h-[200px] w-full rounded-xl border-0"
                  title={preview.title}
                  src={`https://www.youtube-nocookie.com/embed/${preview.id}?autoplay=0&controls=1&playsinline=1&rel=0&hl=${auth.locale}`}
                  referrerPolicy="strict-origin-when-cross-origin"
                  allow="encrypted-media; picture-in-picture; fullscreen"
                  allowFullScreen
                />
              )}
              <button
                type="button"
                className={styles.secondary}
                onClick={() => setPreview(null)}
              >
                {t.close}
              </button>
            </>
          )}
          <p>{t.privacy}</p>
        </section>
      )}
    </div>
  );
}
function Curriculum({
  id,
  courseWorkspace,
}: {
  id: string;
  courseWorkspace: boolean;
}) {
  const data = useRemote(
      `admin/products/${id}/curriculum`,
      adminCurriculumSchema,
    ),
    product = useRemote(
      courseWorkspace ? `admin/products/${id}` : null,
      adminProductSchema,
    ),
    t = getCatalogMessages(useAuth().locale);
  if (data.loading || product.loading) return <p role="status">{t.loading}</p>;
  if (courseWorkspace && (product.code || !product.data))
    return (
      <CatalogError code={product.code ?? "NOT_FOUND"} retry={product.reload} />
    );
  if (data.code || !data.data)
    return <CatalogError code={data.code ?? "NOT_FOUND"} retry={data.reload} />;
  return (
    <CourseLessonEditor
      initial={data.data}
      reload={data.reload}
      courseWorkspace={courseWorkspace}
      courseTitle={product.data?.title}
    />
  );
}
export function AdminCourseCurriculum({
  id,
  courseWorkspace = false,
}: {
  id: string;
  courseWorkspace?: boolean;
}) {
  const t = getAdminCourseMessages(useAuth().locale);
  return (
    <main
      id="main-content"
      data-admin-course-workspace={courseWorkspace || undefined}
      className={styles.shell}
    >
      <h1 className={styles.heading}>{t.heading}</h1>
      <WorkspaceGate allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
        <Curriculum id={id} courseWorkspace={courseWorkspace} />
      </WorkspaceGate>
    </main>
  );
}
