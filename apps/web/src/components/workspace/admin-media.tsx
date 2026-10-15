"use client";
import { cn } from "@/lib/ui/cn";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  UserRole,
  adminUploadSchema,
  adminUploadListSchema,
  adminProductListSchema,
  adminProductSchema,
  adminUploadCreateSchema,
  type AdminUpload,
} from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import { getCatalogMessages, catalogLabel } from "@/lib/i18n/admin-catalog";
import { workspaceBn, workspaceEn } from "@/lib/i18n/workspace";
import { workspaceRequest } from "@/lib/workspace/client";
import {
  transferAdminFile,
  uploadContentType,
} from "@/lib/workspace/admin-upload";
import { WorkspaceGate } from "./workspace-gate";
import { useRemote, Field, Confirmation } from "./workspace-ui";
import { CatalogError } from "./admin-products";
import styles from "./workspace.styles";
function useTransfer() {
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [code, setCode] = useState(""),
    running = useRef(false),
    controller = useRef<AbortController>();
  useEffect(() => () => controller.current?.abort(), []);
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy]);
  async function run(session: AdminUpload, file: File) {
    if (running.current) return;
    running.current = true;
    controller.current = new AbortController();
    setBusy(true);
    setCode("");
    setProgress(0);
    try {
      return await transferAdminFile(
        session,
        file,
        setProgress,
        controller.current.signal,
      );
    } catch (e) {
      if (!controller.current.signal.aborted)
        setCode(
          e instanceof Error &&
            [
              "INVALID_UPLOAD",
              "ASSET_NOT_READY",
              "UPLOAD_STATE_CONFLICT",
              "UNAUTHORIZED",
              "FORBIDDEN",
            ].includes(e.message)
            ? e.message
            : "FILE_UPLOAD_FAILED",
        );
      return undefined;
    } finally {
      running.current = false;
      setBusy(false);
    }
  }
  return {
    run,
    busy,
    progress,
    code,
    cancel: () => controller.current?.abort(),
  };
}
function TransferProgress({
  busy,
  progress,
}: {
  busy: boolean;
  progress: number;
}) {
  const auth = useAuth(),
    t = getCatalogMessages(auth.locale);
  return busy ? (
    <div role="status">
      <p>{t.uploading}</p>
      <label>
        {t.progress}
        <progress className="block h-5 w-full" value={progress} max={100} />
      </label>
      <p>
        {new Intl.NumberFormat(auth.locale === "bn" ? "bn-BD" : "en-GB", {
          style: "percent",
        }).format(progress / 100)}
      </p>
    </div>
  ) : null;
}
function MediaInventory() {
  const auth = useAuth(),
    t = getCatalogMessages(auth.locale),
    router = useRouter(),
    search = useSearchParams(),
    initial = search.get("productId") ?? "",
    [productId, setProductId] = useState(initial),
    [draftSearch, setDraftSearch] = useState(""),
    [file, setFile] = useState<File | null>(null),
    [session, setSession] = useState<AdminUpload | null>(null),
    [pending, setPending] = useState(false),
    [code, setCode] = useState(""),
    [cursors, setCursors] = useState([""]);
  const requestId = useRef(""),
    transfer = useTransfer();
  const drafts = useRemote(
      `admin/products?publication=DRAFT&contentProvider=INTERNAL&limit=100${draftSearch ? `&search=${encodeURIComponent(draftSearch)}` : ""}`,
      adminProductListSchema,
    ),
    chosen = useRemote(
      initial ? `admin/products/${initial}` : null,
      adminProductSchema,
    ),
    cursor = cursors[cursors.length - 1],
    list = useRemote(
      `admin/media?limit=20${cursor ? `&cursor=${cursor}` : ""}`,
      adminUploadListSchema,
    );
  async function start(e: FormEvent) {
    e.preventDefault();
    if (!file || pending || transfer.busy) return;
    requestId.current ||= crypto.randomUUID();
    const parsed = adminUploadCreateSchema.safeParse({
      requestId: requestId.current,
      productId,
      filename: file.name,
      contentType: uploadContentType(file),
      fileSizeBytes: file.size,
    });
    if (!parsed.success) {
      setCode("VALIDATION_FAILED");
      return;
    }
    setCode("");
    setPending(true);
    const result = await workspaceRequest(
      "admin/media/uploads",
      adminUploadSchema,
      "POST",
      parsed.data,
    );
    setPending(false);
    if (!result.data) {
      setCode(result.code ?? "DEFAULT");
      list.reload();
      return;
    }
    setSession(result.data);
    const completed = await transfer.run(result.data, file);
    if (completed) router.push(`/admin/media/uploads/${completed.id}`);
    list.reload();
  }
  async function abort() {
    if (!session) return;
    transfer.cancel();
    setPending(true);
    const result = await workspaceRequest(
      `admin/media/uploads/${session.id}/abort`,
      adminUploadSchema,
      "POST",
      {},
    );
    setPending(false);
    if (result.data) router.push(`/admin/media/uploads/${session.id}`);
    else setCode(result.code ?? "DEFAULT");
  }
  const options = drafts.data?.items ?? [],
    extra =
      chosen.data && !options.some((p) => p.id === chosen.data!.id)
        ? [chosen.data]
        : [];
  return (
    <div data-admin-media className="space-y-6">
      <p>{t.inventoryHint}</p>
      <form className={styles.card} data-upload-form onSubmit={start}>
        <h2>{t.upload}</h2>
        <p>{t.uploadHint}</p>
        {(code || transfer.code) && (
          <CatalogError code={code || transfer.code} />
        )}
        <fieldset
          className={cn(styles.formFields, "space-y-5")}
          disabled={pending || transfer.busy}
        >
          <Field name="draft-search" label={t.productSearch}>
            <input
              id="draft-search"
              value={draftSearch}
              maxLength={100}
              onChange={(e) => setDraftSearch(e.target.value)}
            />
          </Field>
          {drafts.code && (
            <CatalogError code={drafts.code} retry={drafts.reload} />
          )}
          <Field name="upload-product" label={t.selectProduct}>
            <select
              id="upload-product"
              required
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                requestId.current = "";
                setSession(null);
              }}
            >
              <option value="">
                {drafts.loading ? t.loading : t.selectProduct}
              </option>
              {[...extra, ...options]
                .filter((p) => !p.isPublished && p.contentProvider !== "YOUTUBE")
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title} · {catalogLabel(t, p.type)}
                  </option>
                ))}
            </select>
          </Field>
          <Field name="upload-file" label={t.file}>
            <input
              id="upload-file"
              type="file"
              required
              accept=".mp4,.webm,.mov,.mkv,.pdf,.epub,.xlsx,.xls"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                requestId.current = "";
                setSession(null);
              }}
            />
          </Field>
          <button
            className={styles.primary}
            disabled={pending || transfer.busy}
          >
            {pending ? t.saving : t.start}
          </button>
        </fieldset>
        <TransferProgress busy={transfer.busy} progress={transfer.progress} />
        {session && (
          <div className={styles.actions}>
            <Link href={`/admin/media/uploads/${session.id}`}>{t.details}</Link>
            {session.state !== "UPLOADED" && (
              <button
                className={styles.secondary}
                type="button"
                disabled={pending}
                onClick={() => void abort()}
              >
                {t.abort}
              </button>
            )}
          </div>
        )}
        <p>{t.recover}</p>
      </form>
      <section className={styles.card}>
        <h2>{t.inventory}</h2>
        {list.loading ? (
          <p role="status">{t.loading}</p>
        ) : list.code ? (
          <CatalogError code={list.code} retry={list.reload} />
        ) : !list.data?.items.length ? (
          <p>{t.empty}</p>
        ) : (
          <ul className={styles.list}>
            {list.data.items.map((row) => (
              <li key={row.id} data-upload-row>
                <div>
                  <strong>{row.filename}</strong>
                  <small>
                    {row.product.title} · {catalogLabel(t, row.state)}
                  </small>
                  <small>
                    {row.product.type === "VIDEO_COURSE"
                      ? catalogLabel(t, row.processingState)
                      : ""}
                  </small>
                </div>
                <Link
                  className={styles.secondary}
                  href={`/admin/media/uploads/${row.id}`}
                >
                  {t.details}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div className={styles.actions}>
        <button className={styles.secondary} onClick={list.reload}>
          {t.refresh}
        </button>
        {cursors.length > 1 && (
          <button
            className={styles.secondary}
            onClick={() => setCursors((c) => c.slice(0, -1))}
          >
            {t.previous}
          </button>
        )}
        {list.data?.nextCursor && (
          <button
            className={styles.secondary}
            onClick={() => setCursors((c) => [...c, list.data!.nextCursor!])}
          >
            {t.next}
          </button>
        )}
      </div>
    </div>
  );
}
function MediaDetail({ id }: { id: string }) {
  const auth = useAuth(),
    t = getCatalogMessages(auth.locale),
    common = auth.locale === "bn" ? workspaceBn : workspaceEn,
    data = useRemote(`admin/media/uploads/${id}`, adminUploadSchema),
    [file, setFile] = useState<File | null>(null),
    [code, setCode] = useState(""),
    [saved, setSaved] = useState(false),
    [pending, setPending] = useState(false),
    [confirmation, setConfirmation] = useState<"abort" | "attach" | null>(null),
    transfer = useTransfer(),
    row = data.data;
  async function action(kind: "abort" | "process" | "attach") {
    if (!row || pending) return;
    setPending(true);
    setCode("");
    setSaved(false);
    if (kind === "abort") transfer.cancel();
    const path =
      kind === "attach"
        ? `admin/products/${row.productId}/asset`
        : `admin/media/uploads/${id}/${kind}`;
    const result =
      kind === "attach"
        ? await workspaceRequest(path, adminProductSchema, "POST", {
            uploadId: id,
            expectedVersion: row.product.version,
          })
        : await workspaceRequest(path, adminUploadSchema, "POST", {});
    setPending(false);
    setConfirmation(null);
    if (result.data) setSaved(true);
    else setCode(result.code ?? "DEFAULT");
    data.reload();
  }
  async function resume() {
    if (!row || !file || transfer.busy) return;
    setCode("");
    const result = await transfer.run(row, file);
    if (result) {
      setSaved(true);
      data.reload();
    }
  }
  if (data.loading) return <p role="status">{t.loading}</p>;
  if (data.code || !row)
    return <CatalogError code={data.code ?? "NOT_FOUND"} retry={data.reload} />;
  const mayChange =
      auth.user?.id === row.ownerId || auth.user?.role === UserRole.SUPER_ADMIN,
    video = row.product.type === "VIDEO_COURSE",
    attachable =
      row.state === "UPLOADED" &&
      (!video || row.processingState === "completed");
  return (
    <div data-upload-detail className="space-y-6">
      <Link className={styles.secondary} href="/admin/media">
        {t.backMedia}
      </Link>
      {(code || transfer.code) && <CatalogError code={code || transfer.code} />}
      {saved && <p role="status">{t.saved}</p>}
      <section className={styles.card}>
        <h2>{row.filename}</h2>
        <p>
          <Link href={`/admin/products/${row.productId}`}>
            {row.product.title}
          </Link>
        </p>
        <dl className={styles.details}>
          <div>
            <dt>{t.state}</dt>
            <dd>{catalogLabel(t, row.state)}</dd>
          </div>
          <div>
            <dt>{t.size}</dt>
            <dd>
              {new Intl.NumberFormat(
                auth.locale === "bn" ? "bn-BD" : "en-GB",
              ).format(row.fileSizeBytes)}
            </dd>
          </div>
          <div>
            <dt>{t.createdAt}</dt>
            <dd>
              {new Intl.DateTimeFormat(
                auth.locale === "bn" ? "bn-BD" : "en-GB",
                {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Asia/Dhaka",
                },
              ).format(new Date(row.createdAt))}
            </dd>
          </div>
          {video && (
            <div>
              <dt>{t.processing}</dt>
              <dd>
                {catalogLabel(t, row.processingState)} ·{" "}
                {new Intl.NumberFormat(
                  auth.locale === "bn" ? "bn-BD" : "en-GB",
                  { style: "percent" },
                ).format(row.progress / 100)}
              </dd>
            </div>
          )}
        </dl>
      </section>
      {!mayChange ? (
        <p>{t.owned}</p>
      ) : (
        <section className={styles.card}>
          <fieldset
            className={cn(styles.formFields, "space-y-5")}
            disabled={pending || transfer.busy}
          >
            {row.state === "UPLOADING" && (
              <>
                <p>{t.recover}</p>
                <Field name="resume-file" label={t.resume}>
                  <input
                    id="resume-file"
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                </Field>
                <button
                  className={styles.primary}
                  disabled={!file || transfer.busy}
                  onClick={() => void resume()}
                >
                  {t.retryUpload}
                </button>
              </>
            )}
            {video && row.state === "UPLOADED" && (
              <button
                data-process-upload
                className={styles.secondary}
                disabled={["active", "waiting", "delayed"].includes(
                  row.processingState,
                )}
                onClick={() => void action("process")}
              >
                {t.process}
              </button>
            )}
            {attachable && (
              <button
                data-attach-upload
                className={styles.primary}
                disabled={row.product.isPublished}
                onClick={() => setConfirmation("attach")}
              >
                {t.attach}
              </button>
            )}
            {!["UPLOADED", "ABORTED"].includes(row.state) && (
              <button
                className={styles.secondary}
                onClick={() => setConfirmation("abort")}
              >
                {t.abort}
              </button>
            )}
          </fieldset>
          <TransferProgress busy={transfer.busy} progress={transfer.progress} />
          {transfer.busy && (
            <button
              className={styles.secondary}
              disabled={pending}
              onClick={() => setConfirmation("abort")}
            >
              {t.abort}
            </button>
          )}
        </section>
      )}
      <button
        className={styles.secondary}
        disabled={pending || transfer.busy}
        onClick={data.reload}
      >
        {t.refresh}
      </button>
      {confirmation && (
        <Confirmation
          title={confirmation === "abort" ? t.abortConfirm : t.attachConfirm}
          t={common}
          pending={pending}
          cancel={() => setConfirmation(null)}
          confirm={() => void action(confirmation)}
        >
          <p>
            {row.filename} · {row.product.title}
          </p>
        </Confirmation>
      )}
    </div>
  );
}
export function AdminMedia({ id }: { id?: string }) {
  const t = getCatalogMessages(useAuth().locale);
  return (
    <main id="main-content" className={styles.shell}>
      <h1 className={styles.heading}>{t.media}</h1>
      <WorkspaceGate allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
        {id ? <MediaDetail key={id} id={id} /> : <MediaInventory />}
      </WorkspaceGate>
    </main>
  );
}
