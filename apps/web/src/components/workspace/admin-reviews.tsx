"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  UserRole,
  adminReviewQuerySchema,
  adminReviewListSchema,
  adminReviewDetailSchema,
  adminReviewModerateSchema,
  type AdminReviewDetail,
} from "@vetralink/shared-types";
import { WorkspaceGate } from "./workspace-gate";
import { Field, useRemote } from "./workspace-ui";
import {
  Facts,
  FinanceAction,
  FinanceError,
  History,
  useFinance,
} from "./admin-finance-ui";
import styles from "./workspace.styles";
function ReviewList() {
  const f = useFinance(),
    t = f.t,
    params = useSearchParams(),
    raw = params.toString(),
    router = useRouter(),
    pathname = usePathname();
  const [search, setSearch] = useState(params.get("search") ?? ""),
    [status, setStatus] = useState(params.get("status") ?? ""),
    [rating, setRating] = useState(params.get("rating") ?? ""),
    [vet, setVet] = useState(params.get("vetId") ?? ""),
    [cursors, setCursors] = useState<string[]>([]);
  const expected = useRef<string | null>(null);
  useEffect(() => {
    setSearch(params.get("search") ?? "");
    setStatus(params.get("status") ?? "");
    setRating(params.get("rating") ?? "");
    setVet(params.get("vetId") ?? "");
    if (expected.current !== raw) setCursors([]);
    expected.current = null;
  }, [raw, params]);
  const query = new URLSearchParams(raw);
  if (!query.has("limit")) query.set("limit", "20");
  const valid = adminReviewQuerySchema.safeParse(
      Object.fromEntries(query),
    ).success,
    remote = useRemote(
      valid ? `admin/reviews?${query}` : null,
      adminReviewListSchema,
    );
  function navigate(next: URLSearchParams) {
    expected.current = next.toString();
    router.replace(`${pathname}?${next}`);
  }
  return (
    <div data-review-list className="space-y-6">
      <form
        className={styles.card}
        onSubmit={(e) => {
          e.preventDefault();
          const next = new URLSearchParams();
          if (search.trim()) next.set("search", search.trim());
          if (status) next.set("status", status);
          if (rating) next.set("rating", rating);
          if (vet) next.set("vetId", vet);
          setCursors([]);
          navigate(next);
        }}
      >
        <div className={styles.grid}>
          <Field name="review-search" label={t.search}>
            <input
              id="review-search"
              maxLength={100}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
          <Field name="review-status" label={t.status}>
            <select
              id="review-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">{t.all}</option>
              {["PENDING", "APPROVED", "FLAGGED", "REJECTED"].map((v) => (
                <option key={v} value={v}>
                  {f.label(v)}
                </option>
              ))}
            </select>
          </Field>
          <Field name="review-rating" label={t.rating}>
            <select
              id="review-rating"
              value={rating}
              onChange={(e) => setRating(e.target.value)}
            >
              <option value="">{t.all}</option>
              {[1, 2, 3, 4, 5].map((v) => (
                <option key={v} value={v}>
                  {f.number(v)}
                </option>
              ))}
            </select>
          </Field>
          <Field name="review-vet" label={t.vet}>
            <input
              id="review-vet"
              value={vet}
              onChange={(e) => setVet(e.target.value)}
            />
          </Field>
        </div>
        <div className={styles.actions}>
          <button className={styles.primary}>{t.apply}</button>
          <button
            data-finance-reload
            type="button"
            className={styles.secondary}
            onClick={remote.reload}
            disabled={remote.loading}
          >
            {t.refresh}
          </button>
        </div>
      </form>
      {!valid ? (
        <FinanceError code="VALIDATION_FAILED" />
      ) : remote.loading ? (
        <p role="status">{t.loading}</p>
      ) : remote.code ? (
        <FinanceError code={remote.code} retry={remote.reload} />
      ) : !remote.data?.items.length ? (
        <p className={styles.card}>{t.empty}</p>
      ) : (
        <ul className={`${styles.list} ${styles.card}`}>
          {remote.data.items.map((row) => (
            <li data-review-row={row.id} key={row.id}>
              <div className="min-w-0 [overflow-wrap:anywhere]">
                <strong>
                  {f.label(row.moderationStatus)} · {t.rating}:{" "}
                  {f.number(row.rating)}/{f.number(5)} ·{" "}
                  {row.isPublic ? t.public : t.private}
                </strong>
                <p className="whitespace-pre-wrap">{row.feedback ?? t.none}</p>
                <small>
                  {f.identity(row.farmer)} · {f.identity(row.vet)}
                </small>
                <small>{row.id}</small>
              </div>
              <Link
                className={styles.secondary}
                href={`/admin/reviews/${row.id}`}
              >
                {t.details}
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className={styles.actions}>
        {(cursors.length > 0 || params.has("cursor")) && (
          <button
            data-review-previous
            className={styles.secondary}
            disabled={remote.loading}
            onClick={() => {
              const next = new URLSearchParams(raw),
                previous = cursors.at(-1);
              if (previous) next.set("cursor", previous);
              else next.delete("cursor");
              setCursors((v) => v.slice(0, -1));
              navigate(next);
            }}
          >
            {t.previous}
          </button>
        )}
        {remote.data?.nextCursor && (
          <button
            data-review-next
            className={styles.secondary}
            disabled={remote.loading}
            onClick={() => {
              const next = new URLSearchParams(raw);
              setCursors((v) => [...v, params.get("cursor") ?? ""]);
              next.set("cursor", remote.data!.nextCursor!);
              navigate(next);
            }}
          >
            {t.next}
          </button>
        )}
      </div>
    </div>
  );
}
function ReviewRecord({ id }: { id: string }) {
  const f = useFinance(),
    t = f.t,
    remote = useRemote(`admin/reviews/${id}`, adminReviewDetailSchema),
    [snapshot, setSnapshot] = useState<AdminReviewDetail>(),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    if (remote.data) setSnapshot(remote.data);
  }, [remote.data]);
  const row = snapshot ?? remote.data;
  if (!row)
    return remote.loading ? (
      <p role="status">{t.loading}</p>
    ) : (
      <FinanceError code={remote.code} retry={remote.reload} />
    );
  return (
    <div data-review-detail className="space-y-6">
      <Link className={styles.secondary} href="/admin/reviews">
        {t.back}
      </Link>
      {saved && (
        <p data-finance-saved role="status">
          {t.saved}
        </p>
      )}
      {remote.loading && <p role="status">{t.loading}</p>}
      {remote.code && <FinanceError code={remote.code} retry={remote.reload} />}
      <Facts
        pairs={[
          ["ID", row.id],
          [t.status, f.label(row.moderationStatus)],
          [t.rating, `${f.number(row.rating)}/${f.number(5)}`],
          [t.feedback, row.feedback ?? t.none],
          [t.tags, row.tags.map(f.label).join(", ") || t.none],
          [t.public, row.isPublic ? t.public : t.private],
          [t.farmer, f.identity(row.farmer)],
          [t.vet, f.identity(row.vet)],
          [
            t.consultation,
            `${row.consultation.id} · ${f.label(row.consultation.status)} · ${f.label(row.consultation.type)}`,
          ],
          [t.farm, f.identity(row.consultation.farm)],
          [t.reason, row.moderationReason ?? t.none],
          [t.moderator, f.identity(row.moderator)],
          [t.moderated, f.date(row.moderatedAt)],
          [t.created, f.date(row.createdAt)],
          [t.updated, f.date(row.updatedAt)],
        ]}
      />
      <FinanceAction
        kind="review"
        path={`admin/reviews/${id}/moderate`}
        schema={adminReviewDetailSchema}
        actions={row.allowedStatuses}
        allowed={row.allowedStatuses.length > 0}
        refreshing={remote.loading || !!remote.code}
        readToken={remote.data}
        onReload={remote.reload}
        onSaved={(value) => {
          setSnapshot(value);
          setSaved(true);
          remote.reload();
        }}
        parse={(fields) =>
          adminReviewModerateSchema.safeParse({
            status: fields.status,
            expectedRevision: row.revision,
            reason: fields.reason,
            actorPassword: fields.actorPassword,
          })
        }
        rows={
          <>
            <p className="[overflow-wrap:anywhere]">
              {row.id} · {f.identity(row.vet)} · {t.rating}:{" "}
              {f.number(row.rating)}/{f.number(5)}
            </p>
            <p>{row.isPublic ? t.public : t.private}</p>
          </>
        }
      />
      <History items={row.history} truncated={row.historyTruncated} />
      <button
        data-finance-reload
        className={styles.secondary}
        disabled={remote.loading}
        onClick={remote.reload}
      >
        {t.refresh}
      </button>
    </div>
  );
}
export function AdminReviews({ id }: { id?: string }) {
  const { t } = useFinance();
  return (
    <main id="main-content" className={styles.shell}>
      <h1 className={styles.heading}>{t.reviews}</h1>
      <WorkspaceGate allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
        <p className={styles.intro}>{t.privacy}</p>
        {id ? <ReviewRecord key={id} id={id} /> : <ReviewList />}
      </WorkspaceGate>
    </main>
  );
}
