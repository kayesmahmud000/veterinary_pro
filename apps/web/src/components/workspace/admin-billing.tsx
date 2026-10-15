"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import {
  BillingKind,
  BillingRow,
  BillingDetail,
  BillingPlanEdit,
  BillingSubscriptionAction,
  billingKinds,
  billingListSchema,
  billingDetailSchema,
  billingPlanEditSchema,
  billingSubscriptionActionSchema,
  OrderStatus,
  SubscriptionStatus,
  DunningStatus,
  UserRole,
} from "@vetralink/shared-types";
import { useAuth } from "@/components/auth/auth-provider";
import {
  getBillingMessages,
  billingLabel,
  type BillingMessages,
} from "@/lib/i18n/admin-billing";
import { workspaceBn, workspaceEn } from "@/lib/i18n/workspace";
import { workspaceRequest } from "@/lib/workspace/client";
import { WorkspaceGate } from "./workspace-gate";
import { useRemote, Field, Confirmation } from "./workspace-ui";
import styles from "./workspace.styles";
const statuses = {
  orders: Object.values(OrderStatus),
  subscriptions: Object.values(SubscriptionStatus),
  plans: ["ACTIVE", "INACTIVE"],
  dunning: Object.values(DunningStatus),
};
const ownerName = (row: BillingRow, t: BillingMessages) =>
  "owner" in row ? (row.owner?.name ?? t.deleted) : row.name;
function useFormatting() {
  const { locale } = useAuth();
  return {
    money: (value: number, currency: string) =>
      new Intl.NumberFormat(locale === "bn" ? "bn-BD" : "en-US", {
        style: "currency",
        currency,
        currencyDisplay: "code",
      }).format(value / 100),
    date: (value: string) =>
      new Intl.DateTimeFormat(locale === "bn" ? "bn-BD" : "en-GB", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Dhaka",
      }).format(new Date(value)),
  };
}
function ErrorNotice({ code, retry }: { code?: string; retry?: () => void }) {
  const t = getBillingMessages(useAuth().locale);
  return (
    <div className={styles.error}>
      <p role="alert">
        {code && code in t ? billingLabel(t, code) : t.unavailable}
      </p>
      {retry && (
        <button className={styles.secondary} onClick={retry}>
          {t.retry}
        </button>
      )}
    </div>
  );
}
function BillingList({ kind }: { kind: BillingKind }) {
  const t = getBillingMessages(useAuth().locale),
    format = useFormatting(),
    [search, setSearch] = useState(""),
    [status, setStatus] = useState(""),
    [query, setQuery] = useState(""),
    [cursors, setCursors] = useState([""]);
  const cursor = cursors.at(-1),
    data = useRemote(
      `admin/billing/${kind}?limit=20${query ? `&${query}` : ""}${cursor ? `&cursor=${cursor}` : ""}`,
      billingListSchema,
    );
  return (
    <div data-billing-list={kind} className="space-y-6">
      <form
        className={styles.card}
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(
            new URLSearchParams(
              Object.fromEntries(
                Object.entries({ search: search.trim(), status }).filter(
                  ([, value]) => value,
                ),
              ),
            ).toString(),
          );
          setCursors([""]);
        }}
      >
        <div className={styles.grid}>
          <Field name="billing-search" label={t.search}>
            <input
              id="billing-search"
              value={search}
              maxLength={100}
              onChange={(e) => setSearch(e.target.value)}
            />
          </Field>
          <Field name="billing-status" label={t.status}>
            <select
              id="billing-status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">{t.all}</option>
              {statuses[kind].map((value) => (
                <option key={value} value={value}>
                  {billingLabel(t, value)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className={styles.actions}>
          <button className={styles.primary}>{t.apply}</button>
        </div>
      </form>
      {kind === "dunning" && (
        <p className="text-sm text-muted">{t.reminderHint}</p>
      )}
      {data.loading ? (
        <p role="status">{t.loading}</p>
      ) : data.code ? (
        <ErrorNotice code={data.code} retry={data.reload} />
      ) : !data.data?.items.length ? (
        <p className={styles.card}>{t.empty}</p>
      ) : (
        <ul className={`${styles.list} ${styles.card}`}>
          {data.data.items
            .filter((row) => row.kind === kind)
            .map((row) => (
              <li key={row.id} data-billing-row>
                <div className="min-w-0 space-y-2 [overflow-wrap:anywhere]">
                  <strong>
                    {row.kind === "plans" ? row.name : ownerName(row, t)}
                  </strong>
                  <small>
                    {row.kind === "plans"
                      ? billingLabel(t, row.tier)
                      : billingLabel(t, row.status)}
                  </small>
                  <small>
                    {row.kind === "orders"
                      ? format.money(row.totalCents, row.currency)
                      : row.kind === "plans"
                        ? format.money(row.priceMonthlyCents, row.currency)
                        : row.kind === "subscriptions"
                          ? `${row.plan.name} · ${format.date(row.currentPeriodEnd)}`
                          : `${billingLabel(t, row.stage)} · ${format.date(row.dispatchedAt)}`}
                  </small>
                  <small>{row.id}</small>
                </div>
                <Link
                  className={styles.secondary}
                  href={`/admin/${kind}/${row.id}`}
                >
                  {t.details}
                </Link>
              </li>
            ))}
        </ul>
      )}
      <div className={styles.actions}>
        {cursors.length > 1 && (
          <button
            className={styles.secondary}
            disabled={data.loading}
            onClick={() => setCursors((v) => v.slice(0, -1))}
          >
            {t.previous}
          </button>
        )}
        {data.data?.nextCursor && (
          <button
            className={styles.secondary}
            disabled={data.loading}
            onClick={() => setCursors((v) => [...v, data.data!.nextCursor!])}
          >
            {t.next}
          </button>
        )}
      </div>
    </div>
  );
}
function Facts({ row }: { row: BillingDetail }) {
  const t = getBillingMessages(useAuth().locale),
    f = useFormatting(),
    pairs: Array<[string, ReactNode]> = [];
  if ("owner" in row) pairs.push([t.owner, ownerName(row, t)]);
  if ("status" in row) pairs.push([t.status, billingLabel(t, row.status)]);
  if (row.kind === "orders")
    pairs.push(
      [t.total, f.money(row.totalCents, row.currency)],
      [t.provider, row.paymentGateway],
      [t.reference, row.providerReferencePresent ? t.yes : t.no],
      [t.created, f.date(row.createdAt)],
      [t.updated, f.date(row.updatedAt)],
    );
  if (row.kind === "subscriptions")
    pairs.push(
      [t.farm, row.farm?.name ?? t.deleted],
      [t.plan, row.plan.name],
      [t.start, f.date(row.currentPeriodStart)],
      [t.end, f.date(row.currentPeriodEnd)],
      [t.cancellation, row.cancelAtPeriodEnd ? t.yes : t.no],
      [t.managed, row.providerManaged ? t.yes : t.no],
    );
  if (row.kind === "plans")
    pairs.push(
      [t.name, row.name],
      [t.plan, billingLabel(t, row.tier)],
      [t.monthlyPrice, f.money(row.priceMonthlyCents, row.currency)],
      [t.annualPrice, f.money(row.priceAnnualCents, row.currency)],
      [t.quota, row.maxAnimals === -1 ? t.unlimited : String(row.maxAnimals)],
      [t.active, row.isActive ? t.yes : t.no],
    );
  if (row.kind === "dunning")
    pairs.push(
      [t.stage, billingLabel(t, row.stage)],
      [t.channel, billingLabel(t, row.channel)],
      [t.attempts, row.attemptCount],
      [t.dispatched, f.date(row.dispatchedAt)],
      [
        t.subscription,
        <Link
          className={styles.secondary}
          href={`/admin/subscriptions/${row.subscriptionId}`}
        >
          {t.details}
        </Link>,
      ],
    );
  return (
    <dl className={`${styles.details} ${styles.card}`}>
      {pairs.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd className="[overflow-wrap:anywhere]">{value}</dd>
        </div>
      ))}
    </dl>
  );
}
function SupportForm({
  row,
  onSaved,
}: {
  row: Extract<BillingDetail, { kind: "subscriptions" | "plans" }>;
  onSaved: () => void;
}) {
  const auth = useAuth(),
    t = getBillingMessages(auth.locale),
    common = auth.locale === "bn" ? workspaceBn : workspaceEn;
  const [name, setName] = useState(row.kind === "plans" ? row.name : ""),
    [monthly, setMonthly] = useState(
      row.kind === "plans" ? String(row.priceMonthlyCents) : "",
    ),
    [annual, setAnnual] = useState(
      row.kind === "plans" ? String(row.priceAnnualCents) : "",
    ),
    [quota, setQuota] = useState(
      row.kind === "plans" ? String(row.maxAnimals) : "",
    ),
    [active, setActive] = useState(row.kind === "plans" ? row.isActive : false),
    [reason, setReason] = useState(""),
    [password, setPassword] = useState(""),
    [pending, setPending] = useState(false),
    [confirm, setConfirm] = useState(false),
    [code, setCode] = useState("");
  const action =
    row.kind === "subscriptions" ? row.allowedActions[0] : undefined;
  if (row.kind === "subscriptions" && !action)
    return (
      <p className={styles.card}>
        {row.providerManaged ? t.managedHint : t.unavailableAction}
      </p>
    );
  function input() {
    return row.kind === "plans"
      ? billingPlanEditSchema.safeParse({
          name,
          priceMonthlyCents: Number(monthly),
          priceAnnualCents: Number(annual),
          maxAnimals: Number(quota),
          isActive: active,
          expectedRevision: row.revision,
          reason,
          actorPassword: password,
        })
      : billingSubscriptionActionSchema.safeParse({
          action,
          expectedRevision: row.revision,
          reason,
          actorPassword: password,
        });
  }
  async function submit() {
    if (pending) return;
    const parsed = input();
    if (!parsed.success) {
      setConfirm(false);
      setCode("VALIDATION_FAILED");
      return;
    }
    setPending(true);
    setCode("");
    setPassword("");
    const result = await workspaceRequest(
      `admin/billing/${row.kind}/${row.id}${row.kind === "subscriptions" ? "/actions" : ""}`,
      billingDetailSchema,
      row.kind === "plans" ? "PATCH" : "POST",
      parsed.data as BillingPlanEdit | BillingSubscriptionAction,
    );
    setPending(false);
    setConfirm(false);
    if (result.data) onSaved();
    else setCode(result.code ?? "UNAVAILABLE");
  }
  return (
    <section className={`${styles.card} space-y-5`} data-billing-support>
      <h2 className="text-xl font-semibold">
        {row.kind === "plans" ? t.edit : billingLabel(t, action!)}
      </h2>
      <p className="text-sm text-muted">
        {row.kind === "plans" ? t.planHint : t.periodHint}
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          setCode("");
          if (input().success) setConfirm(true);
          else setCode("VALIDATION_FAILED");
        }}
      >
        <fieldset
          disabled={pending}
          className={`${styles.formFields} space-y-5`}
        >
          {row.kind === "plans" && (
            <>
              <Field name="billing-name" label={t.name}>
                <input
                  id="billing-name"
                  required
                  minLength={3}
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
              <div className={styles.grid}>
                {[
                  {
                    id: "monthly",
                    label: t.monthly,
                    value: monthly,
                    set: setMonthly,
                    min: 0,
                  },
                  {
                    id: "annual",
                    label: t.annual,
                    value: annual,
                    set: setAnnual,
                    min: 0,
                  },
                  {
                    id: "quota",
                    label: t.quota,
                    value: quota,
                    set: setQuota,
                    min: -1,
                  },
                ].map((field) => (
                  <Field
                    key={field.id}
                    name={`billing-${field.id}`}
                    label={field.label}
                  >
                    <input
                      id={`billing-${field.id}`}
                      type="number"
                      required
                      min={field.min}
                      max={2147483647}
                      step={1}
                      value={field.value}
                      onChange={(e) => field.set(e.target.value)}
                    />
                  </Field>
                ))}
              </div>
              <label className={styles.checkbox}>
                <input
                  id="billing-active"
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                />
                {t.active}
              </label>
            </>
          )}
          <Field name="billing-reason" label={t.reason}>
            <textarea
              id="billing-reason"
              rows={3}
              required
              minLength={10}
              maxLength={500}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </Field>
          <Field name="billing-password" label={t.password}>
            <input
              id="billing-password"
              type="password"
              autoComplete="current-password"
              required
              maxLength={1024}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          {code && <ErrorNotice code={code} />}
          <button className={styles.primary} disabled={pending}>
            {pending ? t.saving : t.submit}
          </button>
        </fieldset>
      </form>
      {confirm && (
        <Confirmation
          title={t.confirmation}
          t={common}
          pending={pending}
          cancel={() => {
            setConfirm(false);
            setPassword("");
          }}
          confirm={() => void submit()}
        >
          <p>{row.kind === "plans" ? name : billingLabel(t, action!)}</p>
          <p className="[overflow-wrap:anywhere]">{row.id}</p>
          <p>{row.kind === "plans" ? t.planHint : t.periodHint}</p>
          <p className="whitespace-pre-wrap">{reason}</p>
          {row.kind === "plans" && (
            <p>
              {t.monthly}: {monthly} · {t.annual}: {annual} · {t.quota}: {quota}{" "}
              · {t.active}: {active ? t.yes : t.no}
            </p>
          )}
        </Confirmation>
      )}
    </section>
  );
}
function BillingRecord({ kind, id }: { kind: BillingKind; id: string }) {
  const t = getBillingMessages(useAuth().locale),
    f = useFormatting(),
    data = useRemote(`admin/billing/${kind}/${id}`, billingDetailSchema),
    [saved, setSaved] = useState(false),
    row = data.data;
  if (data.loading) return <p role="status">{t.loading}</p>;
  if (data.code || !row || row.kind !== kind)
    return <ErrorNotice code={data.code} retry={data.reload} />;
  return (
    <div data-billing-detail={kind} className="space-y-6">
      <Link className={styles.secondary} href={`/admin/${kind}`}>
        {t.back}
      </Link>
      <p className="break-all text-sm text-muted">{id}</p>
      {saved && <p role="status">{t.saved}</p>}
      <Facts row={row} />
      {row.kind === "dunning" && <p>{t.reminderHint}</p>}
      {row.kind === "orders" && (
        <section className={`${styles.card} space-y-4`}>
          <h2>{t.items}</h2>
          <ul className={styles.list}>
            {row.items.map((item) => (
              <li key={item.id}>
                <div className="space-y-2">
                  <strong>{item.title ?? t.deleted}</strong>
                  <small>
                    {t.itemPrice}: {f.money(item.priceCents, row.currency)}
                  </small>
                  <small>
                    {t.downloads}: {item.downloadCount}
                  </small>
                  {item.lastDownloadedAt && (
                    <small>
                      {t.downloaded}: {f.date(item.lastDownloadedAt)}
                    </small>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {row.itemsTruncated && <p>{t.truncated}</p>}
        </section>
      )}
      {(row.kind === "subscriptions" || row.kind === "plans") && (
        <SupportForm
          key={row.revision}
          row={row}
          onSaved={() => {
            setSaved(true);
            data.reload();
          }}
        />
      )}
      {"history" in row && (
        <section className={`${styles.card} space-y-4`}>
          <h2>{t.history}</h2>
          {!row.history.length ? (
            <p>{t.noHistory}</p>
          ) : (
            <ol className="space-y-4 pl-5">
              {row.history.map((event, index) => (
                <li key={`${event.createdAt}-${index}`}>
                  <strong>{billingLabel(t, event.action)}</strong>
                  <p>{f.date(event.createdAt)}</p>
                  {event.reason && (
                    <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                      {event.reason}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          )}
          {row.historyTruncated && <p>{t.truncated}</p>}
        </section>
      )}
      <button
        className={styles.secondary}
        onClick={() => {
          setSaved(false);
          data.reload();
        }}
      >
        {t.refresh}
      </button>
    </div>
  );
}
export function AdminBilling({ kind, id }: { kind: BillingKind; id?: string }) {
  const t = getBillingMessages(useAuth().locale);
  return (
    <main id="main-content" className={styles.shell}>
      <h1 className={styles.heading}>{t[kind]}</h1>
      <WorkspaceGate allowedRoles={[UserRole.ADMIN, UserRole.SUPER_ADMIN]}>
        <p className="text-muted">{t.intro}</p>
        <nav aria-label={t.billing} className={`${styles.actions} mb-6`}>
          {billingKinds.map((value) => (
            <Link
              key={value}
              className={styles.secondary}
              aria-current={value === kind ? "page" : undefined}
              href={`/admin/${value}`}
            >
              {t[value]}
            </Link>
          ))}
        </nav>
        {id ? (
          <BillingRecord kind={kind} id={id} />
        ) : (
          <BillingList key={kind} kind={kind} />
        )}
      </WorkspaceGate>
    </main>
  );
}
