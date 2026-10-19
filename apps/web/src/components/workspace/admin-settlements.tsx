"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  UserRole,
  adminSettlementQuerySchema,
  adminSettlementListSchema,
  adminSettlementSummarySchema,
  adminSettlementDetailSchema,
  adminSettlementPreviewSchema,
  adminSettlementReconcileSchema,
  adminSettlementBulkSchema,
  adminSettlementBulkResultSchema,
  type AdminSettlementDetail,
  type AdminSettlementRow,
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
import { refreshSelectedSettlements } from "./admin-finance-state";
function SettlementList({ vetId }: { vetId?: string }) {
  const f = useFinance(),
    t = f.t,
    params = useSearchParams(),
    raw = params.toString(),
    router = useRouter(),
    pathname = usePathname();
  const [search, setSearch] = useState(params.get("search") ?? ""),
    [status, setStatus] = useState(params.get("status") ?? ""),
    [currency, setCurrency] = useState(params.get("currency") ?? ""),
    [vet, setVet] = useState(vetId ?? params.get("vetId") ?? ""),
    [cursors, setCursors] = useState<string[]>([]),
    [selected, setSelected] = useState<AdminSettlementRow[]>([]),
    [saved, setSaved] = useState(false);
  const expected = useRef<string | null>(null);
  useEffect(() => {
    setSearch(params.get("search") ?? "");
    setStatus(params.get("status") ?? "");
    setCurrency(params.get("currency") ?? "");
    setVet(vetId ?? params.get("vetId") ?? "");
    setSelected([]);
    setSaved(false);
    if (expected.current !== raw) setCursors([]);
    expected.current = null;
  }, [raw, params, vetId]);
  const query = new URLSearchParams(raw),
    mismatch = !!vetId && query.has("vetId") && query.get("vetId") !== vetId;
  if (vetId) query.set("vetId", vetId);
  if (!query.has("limit")) query.set("limit", "20");
  const valid =
    !mismatch &&
    adminSettlementQuerySchema.safeParse(Object.fromEntries(query)).success;
  const list = useRemote(
    valid ? `admin/settlements?${query}` : null,
    adminSettlementListSchema,
  );
  const summaryQuery = new URLSearchParams(query);
  summaryQuery.delete("limit");
  summaryQuery.delete("cursor");
  const summary = useRemote(
    valid ? `admin/settlements/summary?${summaryQuery}` : null,
    adminSettlementSummarySchema,
  );
  useEffect(() => {
    if (list.data)
      setSelected((previous) =>
        refreshSelectedSettlements(previous, list.data!.items),
      );
  }, [list.data]);
  function navigate(next: URLSearchParams) {
    expected.current = next.toString();
    router.replace(`${pathname}?${next}`);
  }
  function reload() {
    list.reload();
    summary.reload();
  }
  const first = selected[0],
    eligible =
      selected.length > 0 &&
      selected.length <= 20 &&
      selected.every(
        (row) =>
          row.canReconcile &&
          row.vet &&
          row.vet.id === first?.vet?.id &&
          row.currency === first.currency,
      );
  return (
    <div data-settlement-list className="space-y-6">
      {vetId && (
        <p className="break-all">
          {t.vet}: {vetId}
        </p>
      )}
      <form
        className={styles.card}
        onSubmit={(e) => {
          e.preventDefault();
          const next = new URLSearchParams();
          if (search.trim()) next.set("search", search.trim());
          if (status) next.set("status", status);
          if (currency) next.set("currency", currency);
          if (vet) next.set("vetId", vet);
          setCursors([]);
          navigate(next);
        }}
      >
        <div className={styles.grid}>
          <Field name="settlement-search" label={t.search}>
            <input
              id="settlement-search"
              maxLength={100}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
          <Field name="settlement-status" label={t.status}>
            <select
              id="settlement-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">{t.all}</option>
              {["PENDING", "PROCESSING", "PAID", "HELD", "REVERSED"].map(
                (v) => (
                  <option key={v} value={v}>
                    {f.label(v)}
                  </option>
                ),
              )}
            </select>
          </Field>
          <Field name="settlement-currency" label={t.currency}>
            <input
              id="settlement-currency"
              maxLength={3}
              pattern="[A-Z]{3}"
              value={currency}
              onChange={(e) => setCurrency(e.target.value.toUpperCase())}
            />
          </Field>
          <Field name="settlement-vet" label={t.vet}>
            <input
              id="settlement-vet"
              disabled={!!vetId}
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
            disabled={list.loading || summary.loading}
            onClick={reload}
          >
            {t.refresh}
          </button>
        </div>
      </form>
      {!valid ? (
        <FinanceError code="VALIDATION_FAILED" />
      ) : (
        <>
          <section data-settlement-summary className={styles.card}>
            <h2>{t.summary}</h2>
            {summary.loading ? (
              <p role="status">{t.loading}</p>
            ) : summary.code ? (
              <FinanceError code={summary.code} retry={summary.reload} />
            ) : !summary.data?.items.length ? (
              <p>{t.empty}</p>
            ) : (
              summary.data.items.map((group) => (
                <section
                  key={group.currency}
                  data-settlement-currency={group.currency}
                >
                  <h3>
                    {group.currency} · {t.count}: {f.number(group.count)}
                  </h3>
                  <Facts
                    pairs={[
                      [t.gross, f.money(group.totalGrossCents, group.currency)],
                      [
                        t.platform,
                        f.money(group.platformFeeCents, group.currency),
                      ],
                      [
                        t.earnings,
                        f.money(group.vetEarningsCents, group.currency),
                      ],
                      [
                        t.pending,
                        f.money(group.pendingPayoutCents, group.currency),
                      ],
                      [t.paid, f.money(group.paidPayoutCents, group.currency)],
                      [t.held, f.money(group.heldPayoutCents, group.currency)],
                      [
                        t.reversed,
                        f.money(group.reversedPayoutCents, group.currency),
                      ],
                    ]}
                  />
                </section>
              ))
            )}
          </section>
          {saved && (
            <p data-finance-saved role="status">
              {t.saved}
            </p>
          )}
          {list.loading ? (
            <p role="status">{t.loading}</p>
          ) : list.code ? (
            <FinanceError code={list.code} retry={reload} />
          ) : !list.data?.items.length ? (
            <p className={styles.card}>{t.empty}</p>
          ) : (
            <ul className={`${styles.list} ${styles.card}`}>
              {list.data.items.map((row) => {
                const checked = selected.some((v) => v.id === row.id),
                  disabled =
                    !row.canReconcile ||
                    !row.vet ||
                    (!checked &&
                      (selected.length >= 20 ||
                        (!!first &&
                          (first.vet?.id !== row.vet?.id ||
                            first.currency !== row.currency))));
                return (
                  <li key={row.id} data-settlement-row={row.id}>
                    <div className="min-w-0 space-y-2 [overflow-wrap:anywhere]">
                      <label className={styles.checkbox}>
                        <input
                          type="checkbox"
                          data-settlement-select={row.id}
                          aria-label={`${t.select} ${row.id}`}
                          checked={checked}
                          disabled={disabled}
                          onChange={(e) =>
                            setSelected((v) =>
                              e.target.checked
                                ? [...v, row]
                                : v.filter((x) => x.id !== row.id),
                            )
                          }
                        />
                        {t.select}
                      </label>
                      <strong>
                        {f.label(row.status)} ·{" "}
                        {f.money(row.vetPayoutCents, row.currency)}
                      </strong>
                      <small>{f.identity(row.vet)}</small>
                      <small>{row.id}</small>
                      {row.vet && (
                        <Link href={`/admin/settlements/vets/${row.vet.id}`}>
                          {t.vet}
                        </Link>
                      )}
                    </div>
                    <Link
                      className={styles.secondary}
                      href={`/admin/settlements/${row.id}`}
                    >
                      {t.details}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
          <div data-settlement-bulk>
            <p>
              {t.invalidSelection} {t.selected}: {f.number(selected.length)}
            </p>
            {eligible && (
              <FinanceAction
                key={selected.map((r) => r.id).join()}
                kind="settlement"
                bulk
                path="admin/settlements/bulk-reconcile"
                schema={adminSettlementBulkResultSchema}
                refreshing={list.loading || !!list.code}
                readToken={list.data}
                onReload={reload}
                onSaved={() => {
                  setSaved(true);
                  setSelected([]);
                  reload();
                }}
                parse={(fields) =>
                  adminSettlementBulkSchema.safeParse({
                    reason: fields.reason,
                    actorPassword: fields.actorPassword,
                    payoutReference: fields.payoutReference,
                    ...(fields.payoutBatchId
                      ? { payoutBatchId: fields.payoutBatchId }
                      : {}),
                    items: selected.map((r) => ({
                      id: r.id,
                      expectedRevision: r.revision,
                    })),
                    vetId: first.vet!.id,
                    currency: first.currency,
                  })
                }
                rows={
                  <ul className="space-y-3 [overflow-wrap:anywhere]">
                    {selected.map((row) => (
                      <li key={row.id}>
                        {row.id} · {f.identity(row.vet)} ·{" "}
                        {f.money(row.vetPayoutCents, row.currency)}
                      </li>
                    ))}
                  </ul>
                }
              />
            )}
          </div>
          <div className={styles.actions}>
            {(cursors.length > 0 || params.has("cursor")) && (
              <button
                data-settlement-previous
                className={styles.secondary}
                disabled={list.loading}
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
            {list.data?.nextCursor && (
              <button
                data-settlement-next
                className={styles.secondary}
                disabled={list.loading}
                onClick={() => {
                  const next = new URLSearchParams(raw);
                  setCursors((v) => [...v, params.get("cursor") ?? ""]);
                  next.set("cursor", list.data!.nextCursor!);
                  navigate(next);
                }}
              >
                {t.next}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
function SettlementRecord({ id }: { id: string }) {
  const f = useFinance(),
    t = f.t,
    remote = useRemote(`admin/settlements/${id}`, adminSettlementDetailSchema),
    preview = useRemote(
      `admin/settlements/${id}/preview`,
      adminSettlementPreviewSchema,
    ),
    [snapshot, setSnapshot] = useState<AdminSettlementDetail>(),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    if (remote.data) setSnapshot(remote.data);
  }, [remote.data]);
  const row = snapshot ?? remote.data;
  function reload() {
    remote.reload();
    preview.reload();
  }
  if (!row)
    return remote.loading ? (
      <p role="status">{t.loading}</p>
    ) : (
      <FinanceError code={remote.code} retry={reload} />
    );
  return (
    <div data-settlement-detail className="space-y-6">
      <Link className={styles.secondary} href="/admin/settlements">
        {t.back}
      </Link>
      {saved && (
        <p data-finance-saved role="status">
          {t.saved}
        </p>
      )}
      {remote.loading && <p role="status">{t.loading}</p>}
      {remote.code && <FinanceError code={remote.code} retry={reload} />}
      <Facts
        pairs={[
          [t.status, f.label(row.status)],
          ["ID", row.id],
          [
            t.vet,
            row.vet ? (
              <Link href={`/admin/settlements/vets/${row.vet.id}`}>
                {f.identity(row.vet)}
              </Link>
            ) : (
              t.deleted
            ),
          ],
          [t.gross, f.money(row.totalFeeCents, row.currency)],
          [t.platform, f.money(row.platformFeeCents, row.currency)],
          [t.rate, f.percent(row.platformFeeRate)],
          [t.earnings, f.money(row.vetPayoutCents, row.currency)],
          [t.reference, row.payoutReference ?? t.none],
          [t.batch, row.payoutBatchId ?? t.none],
          [t.processed, f.date(row.processedAt)],
          [
            t.consultation,
            `${row.consultation.id} · ${f.label(row.consultation.status)} · ${f.label(row.consultation.paymentStatus)} · ${f.label(row.consultation.type)}`,
          ],
          [t.farmer, f.identity(row.consultation.farmer)],
          [t.farm, f.identity(row.consultation.farm)],
          [t.created, f.date(row.createdAt)],
          [t.updated, f.date(row.updatedAt)],
        ]}
      />
      <section data-settlement-preview className={styles.card}>
        <h2>{t.preview}</h2>
        {preview.loading ? (
          <p role="status">{t.loading}</p>
        ) : preview.code ? (
          <FinanceError code={preview.code} retry={preview.reload} />
        ) : (
          preview.data && (
            <>
              <p>{preview.data.matchesStoredSplit ? t.match : t.mismatch}</p>
              <p>
                {t.gross}:{" "}
                {f.money(preview.data.totalFeeCents, preview.data.currency)} ·{" "}
                {t.platform}:{" "}
                {f.money(preview.data.platformFeeCents, preview.data.currency)}{" "}
                · {t.earnings}:{" "}
                {f.money(preview.data.vetPayoutCents, preview.data.currency)} ·{" "}
                {t.rate}: {f.percent(preview.data.platformFeeRate)}
              </p>
            </>
          )
        )}
      </section>
      <FinanceAction
        kind="settlement"
        path={`admin/settlements/${id}/reconcile`}
        schema={adminSettlementDetailSchema}
        allowed={row.canReconcile}
        refreshing={
          remote.loading ||
          !!remote.code ||
          preview.loading ||
          !!preview.code ||
          !preview.data?.matchesStoredSplit
        }
        readToken={remote.data}
        onReload={reload}
        onSaved={(value) => {
          setSnapshot(value);
          setSaved(true);
          reload();
        }}
        parse={(fields) =>
          adminSettlementReconcileSchema.safeParse({
            expectedRevision: row.revision,
            reason: fields.reason,
            actorPassword: fields.actorPassword,
            payoutReference: fields.payoutReference,
            ...(fields.payoutBatchId
              ? { payoutBatchId: fields.payoutBatchId }
              : {}),
          })
        }
        rows={
          <p className="[overflow-wrap:anywhere]">
            {row.id} · {f.identity(row.vet)} ·{" "}
            {f.money(row.vetPayoutCents, row.currency)}
          </p>
        }
      >
        {row.unavailableReason && <p>{f.label(row.unavailableReason)}</p>}
      </FinanceAction>
      <History items={row.history} truncated={row.historyTruncated} />
      <button
        data-finance-reload
        className={styles.secondary}
        disabled={remote.loading}
        onClick={reload}
      >
        {t.refresh}
      </button>
    </div>
  );
}
export function AdminSettlements({
  id,
  vetId,
}: {
  id?: string;
  vetId?: string;
}) {
  const { t } = useFinance();
  return (
    <main id="main-content" className={styles.shell}>
      <h1 className={styles.heading}>{t.settlements}</h1>
      <WorkspaceGate allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
        <p className={styles.intro}>{t.local}</p>
        {id ? (
          <SettlementRecord key={id} id={id} />
        ) : (
          <SettlementList key={vetId ?? "all"} vetId={vetId} />
        )}
      </WorkspaceGate>
    </main>
  );
}
