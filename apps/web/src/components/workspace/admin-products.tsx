"use client";
import { cn } from "@/lib/ui/cn";
import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ProductContentProvider,
  UserRole,
  ProductType,
  SubscriptionTier,
  adminProductSchema,
  adminProductListSchema,
  adminProductCreateSchema,
  adminProductEditSchema,
  adminProductActionSchema,
  type AdminProduct,
  type AdminProductAction,
} from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import {
  getCatalogMessages,
  catalogLabel,
  type CatalogMessages,
} from "@/lib/i18n/admin-catalog";
import { getAdminCourseMessages } from "@/lib/i18n/admin-courses";
import { workspaceBn, workspaceEn } from "@/lib/i18n/workspace";
import { workspaceRequest } from "@/lib/workspace/client";
import { WorkspaceGate } from "./workspace-gate";
import { useRemote, Field, Confirmation } from "./workspace-ui";
import styles from "./workspace.styles";
export function CatalogError({
  code,
  retry,
}: {
  code: string;
  retry?: () => void;
}) {
  const t = getCatalogMessages(useAuth().locale);
  return (
    <div className={styles.error}>
      <p role="alert">{(t as Record<string, string>)[code] ?? t.DEFAULT}</p>
      {retry && (
        <button className={styles.secondary} onClick={retry}>
          {t.retry}
        </button>
      )}
    </div>
  );
}
function ProductList({ coursesOnly = false }: { coursesOnly?: boolean }) {
  const auth = useAuth(),
    t = getCatalogMessages(auth.locale),
    course = getAdminCourseMessages(auth.locale),
    [filter, setFilter] = useState({ search: "", type: "", publication: "" }),
    [query, setQuery] = useState(""),
    [cursors, setCursors] = useState([""]);
  const cursor = cursors[cursors.length - 1],
    data = useRemote(
      `admin/products?limit=20${coursesOnly ? "&type=VIDEO_COURSE&contentProvider=YOUTUBE" : ""}${query ? `&${query}` : ""}${cursor ? `&cursor=${cursor}` : ""}`,
      adminProductListSchema,
    );
  return (
    <div data-admin-products data-admin-courses-list={coursesOnly || undefined} className="space-y-6">
      {!coursesOnly && <Link className={styles.primary} href="/admin/products/new">
        {t.newProduct}
      </Link>}
      <form
        className={styles.card}
        onSubmit={(e) => {
          e.preventDefault();
          setQuery(
            new URLSearchParams(
              Object.fromEntries(Object.entries(filter).filter(([, v]) => v)),
            ).toString(),
          );
          setCursors([""]);
        }}
      >
        <div className={styles.grid}>
          <Field name="catalog-search" label={t.search}>
            <input
              id="catalog-search"
              maxLength={100}
              value={filter.search}
              onChange={(e) =>
                setFilter((f) => ({ ...f, search: e.target.value }))
              }
            />
          </Field>
          {(coursesOnly ? (["publication"] as const) : (["type", "publication"] as const)).map((key) => (
            <Field name={`catalog-${key}`} key={key} label={t[key]}>
              <select
                id={`catalog-${key}`}
                value={filter[key]}
                onChange={(e) =>
                  setFilter((f) => ({ ...f, [key]: e.target.value }))
                }
              >
                <option value="">{t.all}</option>
                {(key === "type"
                  ? Object.values(ProductType)
                  : ["DRAFT", "PUBLISHED"]
                ).map((v) => (
                  <option key={v} value={v}>
                    {catalogLabel(t, v)}
                  </option>
                ))}
              </select>
            </Field>
          ))}
        </div>
        <div className={styles.actions}>
          <button className={styles.primary}>{t.apply}</button>
        </div>
      </form>
      {data.loading ? (
        <p role="status">{t.loading}</p>
      ) : data.code ? (
        <CatalogError code={data.code} retry={data.reload} />
      ) : (
        <section className={styles.card}>
          {!data.data?.items.length ? (
            <p>{coursesOnly ? course.emptyCourses : t.empty}</p>
          ) : (
            <ul className={styles.list}>
              {data.data.items.map((p) => (
                <li key={p.id} data-product-row>
                  <div>
                    <strong>{p.title}</strong>
                    <small>
                      {catalogLabel(t, p.type)} ·{" "}
                      {p.isPublished ? t.PUBLISHED : t.DRAFT}
                    </small>
                    {coursesOnly ? <small>{course.YOUTUBE}</small> : <small>
                      {p.currency}{" "}
                      {new Intl.NumberFormat(
                        auth.locale === "bn" ? "bn-BD" : "en-GB",
                        { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                      ).format((p.discountPriceCents ?? p.priceCents) / 100)}
                    </small>}
                  </div>
                  <Link
                    className={styles.secondary}
                    href={coursesOnly ? `/admin/courses/${p.id}` : `/admin/products/${p.id}`}
                  >
                    {coursesOnly ? course.manage : t.details}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
      <div className={styles.actions}>
        <button className={styles.secondary} onClick={data.reload}>
          {t.refresh}
        </button>
        {cursors.length > 1 && (
          <button
            className={styles.secondary}
            disabled={data.loading}
            onClick={() => setCursors((c) => c.slice(0, -1))}
          >
            {t.previous}
          </button>
        )}
        {data.data?.nextCursor && (
          <button
            className={styles.secondary}
            data-product-next
            disabled={data.loading}
            onClick={() => setCursors((c) => [...c, data.data!.nextCursor!])}
          >
            {t.next}
          </button>
        )}
      </div>
    </div>
  );
}
const empty = {
  contentProvider: ProductContentProvider.INTERNAL,
  title: "",
  slug: "",
  description: "",
  type: ProductType.EBOOK,
  priceCents: "",
  discountPriceCents: "",
  currency: "BDT",
  minSubscriptionTier: SubscriptionTier.STARTER,
};
function ProductForm({
  product,
  reload,
  coursesOnly = false,
}: {
  product?: AdminProduct;
  reload?: () => void;
  coursesOnly?: boolean;
}) {
  const auth = useAuth(),
    t = getCatalogMessages(auth.locale),
    course = getAdminCourseMessages(auth.locale),
    router = useRouter(),
    [values, setValues] = useState(() =>
      product
        ? {
            ...empty,
            ...product,
            priceCents: String(product.priceCents),
            discountPriceCents:
              product.discountPriceCents === null
                ? ""
                : String(product.discountPriceCents),
          }
        : coursesOnly
          ? { ...empty, type: ProductType.VIDEO_COURSE, contentProvider: ProductContentProvider.YOUTUBE, priceCents: "0" }
          : empty,
    ),
    [busy, setBusy] = useState(false),
    [code, setCode] = useState("");
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    const fields = {
      title: values.title,
      slug: values.slug,
      description: values.description,
      priceCents: Number(values.priceCents),
      discountPriceCents:
        values.discountPriceCents === ""
          ? null
          : Number(values.discountPriceCents),
      currency: values.currency,
      minSubscriptionTier: values.minSubscriptionTier,
    };
    const parsed = (
      product ? adminProductEditSchema : adminProductCreateSchema
    ).safeParse({
      ...fields,
      ...(product
        ? { expectedVersion: product.version }
        : { type: values.type, contentProvider: values.contentProvider }),
    });
    if (!parsed.success) {
      setCode("VALIDATION_FAILED");
      return;
    }
    setBusy(true);
    setCode("");
    const result = await workspaceRequest(
      product ? `admin/products/${product.id}` : "admin/products",
      adminProductSchema,
      product ? "PATCH" : "POST",
      parsed.data,
    );
    setBusy(false);
    if (result.data) router.push(coursesOnly ? `/admin/courses/${result.data.id}` : `/admin/products/${result.data.id}`);
    else setCode(result.code ?? "DEFAULT");
  }
  const change = (key: string, value: string) => {
    setValues((v) => {
      const next = {...v,[key]:value};
      if (key === "type" && value !== ProductType.VIDEO_COURSE) next.contentProvider = ProductContentProvider.INTERNAL;
      if (key === "contentProvider" && value === ProductContentProvider.YOUTUBE) { next.priceCents="0"; next.discountPriceCents=""; }
      return next;
    });
    setCode("");
  };
  return (
    <form
      className={styles.card}
      data-product-form
      data-admin-course-form={coursesOnly || undefined}
      onSubmit={submit}
      aria-busy={busy}
    >
      {code && (coursesOnly && code === "VALIDATION_FAILED" ? <p role="alert" className={styles.error}>{course.invalidDetails}</p> : <CatalogError code={code} />)}
      {code === "PRODUCT_VERSION_CONFLICT" && reload && (
        <button type="button" className={styles.secondary} onClick={reload}>
          {t.refresh}
        </button>
      )}
      <fieldset disabled={busy} className={cn(styles.formFields, "space-y-5")}>
        {!coursesOnly && values.type === ProductType.VIDEO_COURSE && <Field name="product-provider" label={course.source}>
          <select id="product-provider" disabled={!!product} value={values.contentProvider} onChange={e=>change("contentProvider",e.target.value)}>
            <option value="INTERNAL">{course.INTERNAL}</option><option value="YOUTUBE">{course.YOUTUBE}</option>
          </select>
        </Field>}
        {values.contentProvider === ProductContentProvider.YOUTUBE && <p>{coursesOnly ? course.draftHint : course.free}</p>}
        <div className={cn(styles.grid, coursesOnly && "[&>div:last-child]:col-span-full")}>
          {(
            coursesOnly ? ["title", "slug", "description"] as const : [
              "title",
              "slug",
              "description",
              "priceCents",
              "discountPriceCents",
            ] as const
          ).map((key) => (
            <Field key={key} name={`product-${key}`} label={t[key]}>
              {key === "description" ? (
                <textarea
                  id={`product-${key}`}
                  rows={5}
                  required
                  minLength={10}
                  maxLength={5000}
                  value={values[key]}
                  onChange={(e) => change(key, e.target.value)}
                />
              ) : (
                <input
                  id={`product-${key}`}
                  type={key.endsWith("Cents") ? "number" : "text"}
                  disabled={key.endsWith("Cents") && values.contentProvider === ProductContentProvider.YOUTUBE}
                  min={0}
                  max={key.endsWith("Cents") ? 2147483647 : undefined}
                  step={1}
                  required={key !== "discountPriceCents"}
                  minLength={key === "title" || key === "slug" ? 3 : undefined}
                  pattern={key === "slug" ? "[a-z0-9]+(?:-[a-z0-9]+)*" : undefined}
                  maxLength={key === "title" ? 255 : 200}
                  value={values[key]}
                  onChange={(e) => change(key, e.target.value)}
                />
              )}
            </Field>
          ))}
          {!coursesOnly && (["type", "currency", "minSubscriptionTier"] as const).map((key) => (
            <Field key={key} name={`product-${key}`} label={t[key]}>
              <select
                id={`product-${key}`}
                disabled={(key === "type" && !!product) || (key === "minSubscriptionTier" && values.contentProvider === ProductContentProvider.YOUTUBE)}
                value={values[key]}
                onChange={(e) => change(key, e.target.value)}
              >
                {(key === "type"
                  ? Object.values(ProductType)
                  : key === "currency"
                    ? Array.from(
                        new Set(["BDT", "USD", "EUR", "GBP", values.currency]),
                      )
                    : Object.values(SubscriptionTier)
                ).map((v) => (
                  <option key={v} value={v}>
                    {catalogLabel(t, v)}
                  </option>
                ))}
              </select>
            </Field>
          ))}
        </div>
        <div className={styles.actions}>
          <button className={styles.primary} type="submit" disabled={busy}>
            {busy ? t.saving : coursesOnly ? course.createAndContinue : t.save}
          </button>
          {!coursesOnly && <Link
            className={styles.secondary}
            href={product ? `/admin/products/${product.id}` : "/admin/products"}
          >
            {t.back}
          </Link>}
        </div>
      </fieldset>
    </form>
  );
}
function ProductDetail({ id, edit }: { id: string; edit: boolean }) {
  const auth = useAuth(),
    t = getCatalogMessages(auth.locale),
    course = getAdminCourseMessages(auth.locale),
    common = auth.locale === "bn" ? workspaceBn : workspaceEn,
    router = useRouter(),
    data = useRemote(`admin/products/${id}`, adminProductSchema),
    [action, setAction] = useState<AdminProductAction["action"]>("PUBLISH"),
    [reason, setReason] = useState(""),
    [pending, setPending] = useState(false),
    [confirmation, setConfirmation] = useState<AdminProductAction | null>(null),
    [code, setCode] = useState(""),
    [saved, setSaved] = useState(false);
  const p = data.data;
  async function submit() {
    if (!confirmation || pending) return;
    setPending(true);
    const result = await workspaceRequest(
      `admin/products/${id}/actions`,
      adminProductSchema,
      "POST",
      confirmation,
    );
    setPending(false);
    setConfirmation(null);
    if (result.data) {
      if (confirmation.action === "DELETE") {
        router.push("/admin/products");
        return;
      }
      setSaved(true);
      setReason("");
      data.reload();
    } else {
      setCode(result.code ?? "DEFAULT");
      data.reload();
    }
  }
  if (data.loading) return <p role="status">{t.loading}</p>;
  if (data.code || !p)
    return <CatalogError code={data.code ?? "NOT_FOUND"} retry={data.reload} />;
  if (edit)
    return <ProductForm key={p.version} product={p} reload={data.reload} />;
  const effectiveAction =
    action === "DELETE" ? "DELETE" : p.isPublished ? "UNPUBLISH" : "PUBLISH";
  return (
    <div data-product-detail className="space-y-6">
      <div className={styles.actions}>
        <Link className={styles.secondary} href="/admin/products">
          {t.back}
        </Link>
        <Link className={styles.secondary} href={`/admin/products/${id}/edit`}>
          {t.edit}
        </Link>
        {p.contentProvider === ProductContentProvider.YOUTUBE ? <Link className={styles.primary} href={`/admin/products/${id}/curriculum`}>{course.manage}</Link> : <Link className={styles.primary} href={`/admin/media?productId=${id}`}>{t.upload}</Link>}
      </div>
      {code && <CatalogError code={code} />}
      {saved && <p role="status">{t.saved}</p>}
      <section className={styles.card}>
        <h2>{p.title}</h2>
        <p className="whitespace-pre-wrap">{p.description}</p>
        <p>
          {catalogLabel(t, p.type)} · {p.isPublished ? t.PUBLISHED : t.DRAFT}
        </p>
        <p>
          {p.currency}{" "}
          {new Intl.NumberFormat(auth.locale === "bn" ? "bn-BD" : "en-GB", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format((p.discountPriceCents ?? p.priceCents) / 100)}
        </p>
        <p>
          {p.contentProvider === ProductContentProvider.YOUTUBE ? course.source : t.asset}:{" "}
          {p.contentProvider === ProductContentProvider.YOUTUBE ? course.YOUTUBE : p.contentS3Key ? (
            <code className="break-all">{p.contentS3Key}</code>
          ) : (
            t.noAsset
          )}
        </p>
        <p>
          {t.updatedAt}:{" "}
          {new Intl.DateTimeFormat(auth.locale === "bn" ? "bn-BD" : "en-GB", {
            dateStyle: "medium",
            timeStyle: "short",
            timeZone: "Asia/Dhaka",
          }).format(new Date(p.updatedAt))}
        </p>
        {p.type === ProductType.VIDEO_COURSE && <p>{p.contentProvider === ProductContentProvider.YOUTUBE ? course.free : t.curriculum}</p>}
      </section>
      <form
        className={styles.card}
        data-product-action
        onSubmit={(e) => {
          e.preventDefault();
          const input = adminProductActionSchema.safeParse({
            action: effectiveAction,
            expectedVersion: p.version,
            reason,
          });
          setCode("");
          setSaved(false);
          if (input.success) setConfirmation(input.data);
          else setCode("VALIDATION_FAILED");
        }}
      >
        <fieldset
          disabled={pending}
          className={cn(styles.formFields, "space-y-5")}
        >
          <Field name="product-action" label={t.action}>
            <select
              id="product-action"
              value={effectiveAction}
              onChange={(e) =>
                setAction(e.target.value as AdminProductAction["action"])
              }
            >
              <option value={p.isPublished ? "UNPUBLISH" : "PUBLISH"}>
                {p.isPublished ? t.UNPUBLISH : t.PUBLISH}
              </option>
              <option value="DELETE">{t.DELETE}</option>
            </select>
          </Field>
          <Field name="product-reason" label={t.reason}>
            <textarea
              id="product-reason"
              value={reason}
              required
              minLength={10}
              maxLength={500}
              rows={3}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <button className={styles.primary} disabled={pending}>
            {t.action}
          </button>
        </fieldset>
      </form>
      <button className={styles.secondary} onClick={data.reload}>
        {t.refresh}
      </button>
      {confirmation && (
        <Confirmation
          title={t.confirm}
          t={common}
          pending={pending}
          cancel={() => setConfirmation(null)}
          confirm={() => void submit()}
        >
          <p>
            {p.title} · {catalogLabel(t, confirmation.action)}
          </p>
          <p>{confirmation.reason}</p>
        </Confirmation>
      )}
    </div>
  );
}
export function AdminProducts({
  view = "list",
  id,
}: {
  view?: "list" | "new" | "detail" | "edit";
  id?: string;
}) {
  const t = getCatalogMessages(useAuth().locale);
  return (
    <main id="main-content" className={styles.shell}>
      <h1 className={styles.heading}>
        {view === "new" ? t.newProduct : view === "edit" ? t.edit : t.products}
      </h1>
      <WorkspaceGate allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
        {view === "new" ? (
          <ProductForm />
        ) : view === "list" ? (
          <ProductList />
        ) : (
          <ProductDetail id={id!} edit={view === "edit"} />
        )}
      </WorkspaceGate>
    </main>
  );
}

export function AdminCourses() {
  const t = getAdminCourseMessages(useAuth().locale);
  return (
    <main id="main-content" data-admin-courses className={styles.shell}>
      <h1 className={styles.heading}>{t.courses}</h1>
      <p className={styles.intro}>{t.intro}</p>
      <WorkspaceGate allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
        <div className="space-y-10">
          <section aria-labelledby="create-course-heading">
            <h2 id="create-course-heading" className="text-xl font-semibold">{t.createHeading}</h2>
            <ProductForm coursesOnly />
          </section>
          <section aria-labelledby="manage-courses-heading">
            <h2 id="manage-courses-heading" className="text-xl font-semibold">{t.listHeading}</h2>
            <ProductList coursesOnly />
          </section>
        </div>
      </WorkspaceGate>
    </main>
  );
}
