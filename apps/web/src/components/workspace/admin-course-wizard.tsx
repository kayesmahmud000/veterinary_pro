"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Check, ArrowLeft, ArrowRight, BookOpen } from "lucide-react";
import {
  UserRole,
  ProductType,
  ProductContentProvider,
  SubscriptionTier,
  adminProductSchema,
  adminProductListSchema,
  adminProductCreateSchema,
  adminProductEditSchema,
  adminCurriculumSchema,
  type AdminProduct,
  type AdminCurriculum,
} from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import { workspaceRequest } from "@/lib/workspace/client";
import { getAdminCourseMessages } from "@/lib/i18n/admin-courses";
import { getCatalogMessages } from "@/lib/i18n/admin-catalog";
import { CourseArtwork } from "@/components/courses/course-artwork";
import { CourseLoading } from "@/components/courses/course-ui";
import { Button, buttonVariants } from "@/components/ui/button";
import { WorkspaceGate } from "./workspace-gate";
import { Field, useRemote } from "./workspace-ui";
import { CatalogError } from "./admin-products";
import { AdminCourseAction, type CourseAction } from "./admin-course-actions";
import { AdminCourseFacts } from "./admin-courses";
import { CourseLessonEditor } from "./admin-course-curriculum";
import { useUnsavedChanges } from "./use-unsaved-changes";
import styles from "./workspace.styles";
const information = (p?: AdminProduct) => ({
  title: p?.title ?? "",
  slug: p?.slug ?? "",
  description: p?.description ?? "",
  thumbnailUrl: p?.thumbnailUrl ?? "",
  mode: p && p.priceCents > 0 ? "PAID" : "FREE",
  priceCents: p?.priceCents ? String(p.priceCents) : "",
  discountPriceCents:
    p?.discountPriceCents === undefined || p.discountPriceCents === null
      ? ""
      : String(p.discountPriceCents),
  currency: p?.currency ?? "BDT",
});
function Wizard({
  initial,
  initialCurriculum,
}: {
  initial?: AdminProduct;
  initialCurriculum?: AdminCurriculum;
}) {
  const auth = useAuth(),
    t = getAdminCourseMessages(auth.locale),
    common = getCatalogMessages(auth.locale),
    [product, setProduct] = useState(initial),
    [curriculum, setCurriculum] = useState(initialCurriculum),
    [values, setValues] = useState(() => information(initial)),
    [savedInfo, setSavedInfo] = useState(() => information(initial)),
    [step, setStep] = useState(1),
    [busy, setBusy] = useState(false),
    [code, setCode] = useState(""),
    [issues, setIssues] = useState<Record<string, string>>({}),
    [notice, setNotice] = useState(""),
    [action, setAction] = useState<CourseAction | null>(null),
    [lessonState, setLessonState] = useState({ dirty: false, busy: false }),
    [editorRevision, setEditorRevision] = useState(0),
    [submittedSlug, setSubmittedSlug] = useState<string | null>(null),
    [pendingCreateSlug, setPendingCreateSlug] = useState<string | null>(null),
    [matching, setMatching] = useState<AdminProduct | null>(null),
    running = useRef(false),
    active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => {
      active.current = false;
    };
  }, []);
  const infoDirty = JSON.stringify(values) !== JSON.stringify(savedInfo),
    dirty = infoDirty || lessonState.dirty;
  const lessonStateChanged = useCallback(
    (value: { dirty: boolean; busy: boolean }) =>
      setLessonState((current) =>
        current.dirty === value.dirty && current.busy === value.busy
          ? current
          : value,
      ),
    [],
  );
  useUnsavedChanges(dirty, t.discardInfo, () => {
    setValues(savedInfo);
    setEditorRevision((v) => v + 1);
    setLessonState({ dirty: false, busy: false });
  });
  const change = (key: keyof typeof values, value: string) => {
    if (key === "slug" && !product && submittedSlug) return;
    setValues((v) => ({ ...v, [key]: value }));
    if (!pendingCreateSlug) setCode("");
    setIssues({});
    setNotice("");
  };
  async function saveInfo() {
    if (
      running.current ||
      pendingCreateSlug ||
      auth.checking ||
      auth.error ||
      !auth.user
    )
      return;
    const fields = {
      title: values.title,
      slug: !product && submittedSlug ? submittedSlug : values.slug,
      description: values.description,
      thumbnailUrl: values.thumbnailUrl.trim() || null,
      priceCents: values.mode === "FREE" ? 0 : Number(values.priceCents),
      discountPriceCents:
        values.mode === "FREE" || !values.discountPriceCents
          ? null
          : Number(values.discountPriceCents),
      currency: values.currency,
      minSubscriptionTier:
        product?.minSubscriptionTier ?? SubscriptionTier.STARTER,
    };
    const parsed = (
      product ? adminProductEditSchema : adminProductCreateSchema
    ).safeParse({
      ...fields,
      ...(product
        ? { expectedVersion: product.version }
        : {
            type: ProductType.VIDEO_COURSE,
            contentProvider: ProductContentProvider.YOUTUBE,
          }),
    });
    if (
      !parsed.success ||
      (values.mode === "PAID" &&
        (!values.priceCents || fields.priceCents <= 0)) ||
      (product?.isPublished && values.mode === "PAID")
    ) {
      const next: Record<string, string> = {};
      if (!parsed.success)
        for (const issue of parsed.error.issues)
          next[String(issue.path[0])] = t.fieldError;
      if (
        values.mode === "PAID" &&
        (!values.priceCents || fields.priceCents <= 0)
      )
        next.priceCents = t.fieldError;
      setIssues(next);
      setCode("VALIDATION_FAILED");
      requestAnimationFrame(() =>
        document
          .getElementById(`course-${Object.keys(next)[0] ?? "mode"}`)
          ?.focus(),
      );
      return;
    }
    if (product && !infoDirty) {
      setStep(2);
      return;
    }
    running.current = true;
    if (!product) setSubmittedSlug(fields.slug.trim());
    setBusy(true);
    setCode("");
    setMatching(null);
    const result = await workspaceRequest(
      product ? `admin/products/${product.id}` : "admin/products",
      adminProductSchema,
      product ? "PATCH" : "POST",
      parsed.data,
      `${auth.user.id}:${auth.user.role}:${auth.user.roleVersion ?? 0}`,
    );
    if (!active.current) return;
    running.current = false;
    setBusy(false);
    if (result.data) {
      const p = result.data;
      setProduct(p);
      setValues(information(p));
      setSavedInfo(information(p));
      setCurriculum((current) =>
        current
          ? { ...current, version: p.version, isPublished: p.isPublished }
          : {
              productId: p.id,
              version: p.version,
              isPublished: false,
              lessons: [],
            },
      );
      setStep(2);
      setNotice("");
    } else {
      setCode(result.code ?? "UNAVAILABLE");
      if (!product) {
        // A first, definitive rejection created nothing. Ambiguous prior attempts
        // retain their unique slug even if a later retry reports a conflict.
        if (
          !submittedSlug &&
          (result.code === "CONFLICT" || result.code === "VALIDATION_FAILED")
        ) {
          setSubmittedSlug(null);
        } else setPendingCreateSlug(fields.slug.trim());
      }
      if (result.code === "CONFLICT") setIssues({ slug: t.duplicateSlug });
    }
  }
  async function findDraft() {
    if (running.current || !pendingCreateSlug) return;
    running.current = true;
    setBusy(true);
    const result = await workspaceRequest(
      `admin/products?type=VIDEO_COURSE&contentProvider=YOUTUBE&limit=1&slug=${encodeURIComponent(pendingCreateSlug)}`,
      adminProductListSchema,
    );
    if (!active.current) return;
    running.current = false;
    setBusy(false);
    if (result.data) {
      const match =
        result.data.items.find((p) => p.slug === pendingCreateSlug) ?? null;
      setMatching(match);
      setNotice(match ? "" : t.noMatchingDraft);
      if (!match) {
        setPendingCreateSlug(null);
        setCode("");
        setIssues({});
      }
    } else setCode(result.code ?? "UNAVAILABLE");
  }
  async function reload() {
    if (
      !product ||
      running.current ||
      lessonState.busy ||
      auth.checking ||
      auth.error
    )
      return;
    if (dirty && !window.confirm(t.discardInfo)) return;
    running.current = true;
    setBusy(true);
    const [info, lessons] = await Promise.all([
      workspaceRequest(`admin/products/${product.id}`, adminProductSchema),
      workspaceRequest(
        `admin/products/${product.id}/curriculum`,
        adminCurriculumSchema,
      ),
    ]);
    if (!active.current) return;
    running.current = false;
    setBusy(false);
    if (!info.data || !lessons.data) {
      setCode(info.code ?? lessons.code ?? "UNAVAILABLE");
      return;
    }
    if (info.data.version !== lessons.data.version) {
      setCode("PRODUCT_VERSION_CONFLICT");
      return;
    }
    setProduct(info.data);
    setCurriculum(lessons.data);
    setValues(information(info.data));
    setSavedInfo(information(info.data));
    setEditorRevision((v) => v + 1);
    setLessonState({ dirty: false, busy: false });
    setCode("");
    setIssues({});
    setNotice("");
  }
  function savedLessons(value: AdminCurriculum) {
    setCurriculum(value);
    setProduct((p) =>
      p
        ? {
            ...p,
            version: value.version,
            isPublished: value.isPublished,
            lessonCount: value.lessons.length,
            previewImageUrl: value.lessons.find(
              (l) => l.access === "PUBLIC_DEMO",
            )
              ? `https://i.ytimg.com/vi/${value.lessons.find((l) => l.access === "PUBLIC_DEMO")!.youtubeVideoId}/hqdefault.jpg`
              : null,
          }
        : p,
    );
    setLessonState({ dirty: false, busy: false });
  }
  const paid = !!product && product.priceCents > 0,
    ready =
      !!product &&
      !paid &&
      product.discountPriceCents === null &&
      !!curriculum?.lessons.some((l) => l.access === "ENROLLED");
  return (
    <div data-admin-course-wizard className="space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/courses"
          className={buttonVariants({ variant: "outline" })}
        >
          <ArrowLeft size={17} aria-hidden="true" />
          {t.backCourses}
        </Link>
        {product && (
          <span className="rounded-full bg-white px-4 py-2 text-sm font-semibold">
            {product.isPublished ? t.live : t.draft} ·{" "}
            {paid ? t.paidCourse : t.freeCourse}
          </span>
        )}
      </div>
      <ol
        aria-label={t.createHeading}
        className="m-0 grid list-none gap-3 rounded-2xl border border-solid border-line bg-white p-4 sm:grid-cols-3"
      >
        {[t.information, t.videosStep, t.reviewStep].map((label, index) => (
          <li
            key={label}
            aria-current={step === index + 1 ? "step" : undefined}
            className={`flex items-center gap-3 rounded-xl p-3 text-sm font-semibold ${step === index + 1 ? "bg-green text-white" : "bg-paper text-muted"}`}
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-solid border-current">
              {step > index + 1 ? (
                <Check size={16} aria-hidden="true" />
              ) : (
                new Intl.NumberFormat(auth.locale).format(index + 1)
              )}
            </span>
            {label}
          </li>
        ))}
      </ol>
      {notice && (
        <p role="status" className={styles.notice}>
          {notice}
        </p>
      )}
      {code && (
        <div>
          {code === "VALIDATION_FAILED" ? (
            <p role="alert" className={styles.error}>
              {t.invalidInfo}
            </p>
          ) : code === "CONFLICT" ? (
            <p role="alert" className={styles.error}>
              {t.duplicateSlug}
            </p>
          ) : (
            <CatalogError code={code} />
          )}
          {code === "PRODUCT_VERSION_CONFLICT" && (
            <Button
              data-course-refresh
              variant="outline"
              disabled={busy}
              onClick={() => void reload()}
            >
              {common.refresh}
            </Button>
          )}
          {!product && pendingCreateSlug && (
            <div className="mt-3 space-y-3">
              <p>{t.uncertainCreate}</p>
              <Button
                data-find-course-draft
                variant="outline"
                disabled={busy}
                onClick={() => void findDraft()}
              >
                {t.findDraft}
              </Button>
              {matching && (
                <Link
                  className={buttonVariants({ variant: "outline" })}
                  href={`/admin/courses/${matching.id}`}
                >
                  {t.openDraft}: {matching.title}
                </Link>
              )}
            </div>
          )}
        </div>
      )}
      <form
        hidden={step !== 1}
        data-admin-course-form
        className={`${styles.card} space-y-5`}
        aria-busy={busy}
        onSubmit={(event) => {
          event.preventDefault();
          void saveInfo();
        }}
      >
        <h2 className="text-2xl font-semibold">{t.information}</h2>
        <fieldset
          disabled={busy || auth.checking || !!auth.error}
          className="m-0 min-w-0 space-y-5 border-0 p-0"
        >
          <div className="grid gap-5 md:grid-cols-2">
            {(["title", "slug"] as const).map((key) => (
              <Field
                key={key}
                name={`course-${key}`}
                label={common[key]}
                error={issues[key]}
              >
                <input
                  id={`course-${key}`}
                  readOnly={key === "slug" && !product && !!submittedSlug}
                  required
                  minLength={3}
                  maxLength={key === "title" ? 255 : 200}
                  value={values[key]}
                  aria-invalid={!!issues[key]}
                  aria-describedby={
                    issues[key] ? `course-${key}-error` : undefined
                  }
                  onChange={(event) => change(key, event.target.value)}
                />
              </Field>
            ))}
          </div>
          <Field
            name="course-description"
            label={common.description}
            error={issues.description}
          >
            <textarea
              id="course-description"
              required
              minLength={10}
              maxLength={5000}
              rows={5}
              value={values.description}
              aria-invalid={!!issues.description}
              onChange={(event) => change("description", event.target.value)}
            />
          </Field>
          <Field
            name="course-thumbnailUrl"
            label={t.thumbnail}
            hint={t.thumbnailHint}
            error={issues.thumbnailUrl}
          >
            <input
              id="course-thumbnailUrl"
              type="url"
              maxLength={2048}
              value={values.thumbnailUrl}
              onChange={(event) => change("thumbnailUrl", event.target.value)}
            />
          </Field>
          <Field name="course-mode" label={t.pricing}>
            <select
              id="course-mode"
              value={values.mode}
              disabled={product?.isPublished}
              onChange={(event) => change("mode", event.target.value)}
            >
              <option value="FREE">{t.freeCourse}</option>
              <option value="PAID">{t.paidCourse}</option>
            </select>
          </Field>
          <p>{values.mode === "FREE" ? t.publicHint : t.paidHint}</p>
          {values.mode === "PAID" && (
            <div className="grid gap-5 md:grid-cols-3">
              <Field
                name="course-priceCents"
                label={t.price}
                error={issues.priceCents}
              >
                <input
                  id="course-priceCents"
                  type="number"
                  required
                  min={1}
                  max={2147483647}
                  step={1}
                  value={values.priceCents}
                  onChange={(event) => change("priceCents", event.target.value)}
                />
              </Field>
              <Field
                name="course-discountPriceCents"
                label={t.discount}
                error={issues.discountPriceCents}
              >
                <input
                  id="course-discountPriceCents"
                  type="number"
                  min={0}
                  max={2147483647}
                  step={1}
                  value={values.discountPriceCents}
                  onChange={(event) =>
                    change("discountPriceCents", event.target.value)
                  }
                />
              </Field>
              <Field
                name="course-currency"
                label={t.currency}
                error={issues.currency}
              >
                <input
                  id="course-currency"
                  required
                  minLength={3}
                  maxLength={3}
                  value={values.currency}
                  onChange={(event) =>
                    change("currency", event.target.value.toUpperCase())
                  }
                />
              </Field>
            </div>
          )}
          {product?.isPublished && <p role="status">{t.publishedEditing}</p>}
          {!product && submittedSlug && <p>{t.retryIdentity}</p>}
          <Button data-course-next-info disabled={!!pendingCreateSlug}>
            {busy ? t.working : t.continue}
            <ArrowRight size={18} aria-hidden="true" />
          </Button>
        </fieldset>
      </form>
      {product && curriculum && (
        <section
          hidden={step !== 2}
          className="space-y-6"
          aria-label={t.videosStep}
        >
          {product.isPublished && (
            <div className={`${styles.card} space-y-4`}>
              <p>{t.publishedEditing}</p>
              <Button
                data-wizard-unpublish
                disabled={busy}
                variant="outline"
                onClick={() => setAction("UNPUBLISH")}
              >
                {t.unpublish}
              </Button>
            </div>
          )}
          <CourseLessonEditor
            key={`${product.id}:${editorRevision}`}
            initial={curriculum}
            reload={() => void reload()}
            embedded
            locked={busy}
            previewEnabled={step === 2 && !busy}
            onSaved={savedLessons}
            onStateChange={lessonStateChanged}
          />
          {lessonState.dirty && <p role="status">{t.saveLessonsFirst}</p>}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={busy || lessonState.busy}
              onClick={() => setStep(1)}
            >
              {t.previous}
            </Button>
            <Button
              data-course-review
              disabled={busy || lessonState.dirty || lessonState.busy}
              onClick={() => setStep(3)}
            >
              {t.review}
            </Button>
          </div>
        </section>
      )}
      {product && curriculum && (
        <section
          hidden={step !== 3}
          data-course-review-panel
          className={`${styles.card} space-y-6`}
        >
          <h2 className="text-2xl font-semibold">{t.reviewStep}</h2>
          <p>{t.savedOnly}</p>
          <div className="grid items-start gap-6 lg:grid-cols-2">
            <div className="overflow-hidden rounded-xl">
              <CourseArtwork
                src={product.thumbnailUrl ?? product.previewImageUrl}
                title={product.title}
                priority
              />
            </div>
            <div className="min-w-0 space-y-4">
              <h3 className="break-words text-2xl font-semibold">
                {product.title}
              </h3>
              <p className="break-words whitespace-pre-wrap">
                {product.description}
              </p>
              <p>
                {paid
                  ? `${t.paidCourse} · ${product.currency} ${new Intl.NumberFormat(auth.locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(product.priceCents / 100)}`
                  : t.freeCourse}
              </p>
              <AdminCourseFacts product={product} />
            </div>
          </div>
          <ol className="space-y-3 pl-5">
            {curriculum.lessons.map((lesson) => (
              <li key={lesson.id} className="break-words">
                <strong>{lesson.title}</strong> · {t[lesson.access]}
              </li>
            ))}
          </ol>
          {paid ? (
            <p role="status">{t.paidHint}</p>
          ) : (
            !ready && <p role="status">{t.readyHint}</p>
          )}
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setStep(2)}
            >
              {t.previous}
            </Button>
            <Button
              data-course-save-draft
              disabled={busy}
              variant="outline"
              onClick={() =>
                setNotice(product.isPublished ? t.actionSaved : t.savedDraft)
              }
            >
              {product.isPublished ? t.finish : t.saveDraft}
            </Button>
            <Button
              data-wizard-publish
              disabled={busy || !ready || product.isPublished || dirty}
              onClick={() => setAction("PUBLISH")}
            >
              {t.publish}
            </Button>
            <Link
              className={buttonVariants({ variant: "ghost" })}
              href="/admin/courses"
            >
              {t.cancel}
            </Link>
          </div>
          {notice && (
            <Link className={buttonVariants()} href="/admin/courses">
              {t.backCourses}
            </Link>
          )}
        </section>
      )}
      {action && product && (
        <AdminCourseAction
          product={product}
          action={action}
          close={() => setAction(null)}
          reload={reload}
          saved={(p) => {
            setProduct(p);
            setCurriculum((c) =>
              c ? { ...c, version: p.version, isPublished: p.isPublished } : c,
            );
            setAction(null);
            setNotice(t.actionSaved);
          }}
        />
      )}
    </div>
  );
}
function ExistingWizard({ id }: { id: string }) {
  const data = useRemote(`admin/products/${id}`, adminProductSchema),
    curriculum = useRemote(
      `admin/products/${id}/curriculum`,
      adminCurriculumSchema,
    ),
    [revision, setRevision] = useState(0);
  const reload = () => {
    data.reload();
    curriculum.reload();
    setRevision((v) => v + 1);
  };
  if (data.loading || curriculum.loading) return <CourseLoading />;
  if (data.code || curriculum.code || !data.data || !curriculum.data)
    return (
      <CatalogError
        code={data.code ?? curriculum.code ?? "NOT_FOUND"}
        retry={reload}
      />
    );
  if (data.data.contentProvider !== "YOUTUBE")
    return <CatalogError code="CONTENT_PROVIDER_MISMATCH" />;
  if (data.data.version !== curriculum.data.version)
    return <CatalogError code="PRODUCT_VERSION_CONFLICT" retry={reload} />;
  return (
    <Wizard
      key={`${id}:${revision}`}
      initial={data.data}
      initialCurriculum={curriculum.data}
    />
  );
}
export function AdminCourseWizard({ id }: { id?: string }) {
  const t = getAdminCourseMessages(useAuth().locale);
  return (
    <main
      id="main-content"
      data-admin-course-workspace
      className={`${styles.shell} mx-auto w-11/12`}
    >
      <h1 className={styles.heading}>{id ? t.edit : t.addNew}</h1>
      <WorkspaceGate
        allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}
        loadingFallback={<CourseLoading />}
      >
        {id ? <ExistingWizard id={id} /> : <Wizard />}
      </WorkspaceGate>
    </main>
  );
}
