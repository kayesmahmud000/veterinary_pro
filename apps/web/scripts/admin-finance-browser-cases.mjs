// Production Next/BFF browser acceptance with synthetic loopback upstreams.
// Real PostgreSQL transaction and currency tests live in the API suites.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const date = "2026-10-16T00:00:00Z";
const uuid = (n) => `aa0e8400-e29b-41d4-a716-${String(n).padStart(12, "0")}`;
const ids = { single: uuid(1), bulkA: uuid(2), bulkB: uuid(3), held: uuid(4), euro: uuid(5), inconsistent: uuid(6), vet: uuid(100), farmer: uuid(101), review: uuid(300) };
const vet = { id: ids.vet, name: "Synthetic finance veterinarian" };
const farmer = { id: ids.farmer, name: "Synthetic review author" };
const ledgers = new Map(), reviews = new Map();
export const financeState = { failure: null, unavailable: false, revision: 0 };
const revision = () => (++financeState.revision).toString(16).padStart(64, "0");
function reset() {
  financeState.failure = null;
  financeState.unavailable = false;
  ledgers.clear(); reviews.clear();
  for (const [key, id] of Object.entries(ids).slice(0, 6)) {
    const currency = key === "euro" ? "EUR" : "USD";
    const totalFeeCents = 10000, platformFeeCents = 2000, vetPayoutCents = 8000;
    ledgers.set(id, {
      id, consultationId: uuid(200 + Number(id.slice(-2))), vet,
      status: key === "held" ? "HELD" : "PENDING",
      totalFeeCents, platformFeeRate: 0.2, platformFeeCents, vetPayoutCents, currency,
      processedAt: null, createdAt: date, updatedAt: date, revision: revision(),
      canReconcile: !["held", "inconsistent"].includes(key),
      payoutReference: null, payoutBatchId: null,
      unavailableReason: key === "held" ? "STATUS" : key === "inconsistent" ? "SNAPSHOT_MISMATCH" : null,
      consultation: {
        id: uuid(200 + Number(id.slice(-2))), status: "COMPLETED", paymentStatus: "CAPTURED", type: "ASYNC_TICKET",
        farmer, farm: { id: uuid(110), name: "Synthetic settlement farm" }, feeCents: key === "inconsistent" ? 9999 : totalFeeCents, currency,
      }, history: [], historyTruncated: false,
    });
  }
  reviews.set(ids.review, {
    id: ids.review, consultationId: uuid(400), farmer, vet,
    rating: 4, feedback: "Synthetic feedback retained as text <strong>only</strong>.", tags: ["CLEAR_COMMUNICATION"],
    isPublic: false, moderationStatus: "FLAGGED", moderatedAt: null, createdAt: date, updatedAt: date,
    revision: revision(), moderationReason: null, moderator: null,
    allowedStatuses: ["APPROVED", "REJECTED"], consultation: { id: uuid(400), status: "COMPLETED", type: "ASYNC_TICKET", farm: { id: uuid(110), name: "Synthetic review farm" } },
    history: [], historyTruncated: false,
  });
}
reset();
function filteredLedgers(q) {
  return [...ledgers.values()].filter(row =>
    (!q.get("status") || row.status === q.get("status")) &&
    (!q.get("vetId") || row.vet?.id === q.get("vetId")) &&
    (!q.get("currency") || row.currency === q.get("currency")) &&
    (!q.get("search") || `${row.id} ${row.vet?.name ?? ""}`.toLowerCase().includes(q.get("search").toLowerCase())),
  );
}
function summary(rows) {
  const groups = new Map();
  for (const row of rows) {
    const group = groups.get(row.currency) ?? { currency: row.currency, count: 0, totalGrossCents: 0, platformFeeCents: 0, vetEarningsCents: 0, pendingPayoutCents: 0, paidPayoutCents: 0, heldPayoutCents: 0, reversedPayoutCents: 0 };
    group.count++; group.totalGrossCents += row.totalFeeCents; group.platformFeeCents += row.platformFeeCents; group.vetEarningsCents += row.vetPayoutCents;
    if (["PENDING", "PROCESSING"].includes(row.status)) group.pendingPayoutCents += row.vetPayoutCents;
    if (row.status === "PAID") group.paidPayoutCents += row.vetPayoutCents;
    if (row.status === "HELD") group.heldPayoutCents += row.vetPayoutCents;
    if (row.status === "REVERSED") group.reversedPayoutCents += row.vetPayoutCents;
    groups.set(row.currency, group);
  }
  return { items: [...groups.values()] };
}
function reconcile(row, data, bulk) {
  Object.assign(row, { status: "PAID", processedAt: date, payoutReference: data.payoutReference, payoutBatchId: data.payoutBatchId ?? null, canReconcile: false, unavailableReason: "STATUS", revision: revision() });
  row.history.unshift({ id: uuid(500 + financeState.revision), action: bulk ? "ADMIN_SETTLEMENT_BULK_RECONCILED" : "ADMIN_SETTLEMENT_RECONCILED", actor: { id: uuid(120), name: "Synthetic finance administrator" }, reason: data.reason, createdAt: date });
}
export function handleFinanceFixture(req, res, data, route, role) {
  if (!/^admin\/(settlements|reviews)(?:\/|$)/.test(route)) return false;
  const send = (status, value, code) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: status < 400, data: value, ...(code ? { errorDetails: { title: code } } : {}) }));
    return true;
  };
  if (!["ADMIN", "SUPER_ADMIN"].includes(role)) return send(403, null);
  if (financeState.unavailable) return send(503, null);
  const [, kind, id, suffix] = route.split("/");
  const q = new URL(req.url, "http://fixture").searchParams;
  if (kind === "settlements") {
    if (req.method === "GET") {
      if (id === "summary") return send(200, summary(filteredLedgers(q)));
      if (id) {
        const row = ledgers.get(id);
        if (!row) return send(404, null);
        if (suffix === "preview") return send(200, { id, totalFeeCents: row.totalFeeCents, platformFeeRate: row.platformFeeRate, platformFeeCents: row.platformFeeCents, vetPayoutCents: row.vetPayoutCents, currency: row.currency, matchesStoredSplit: row.unavailableReason !== "SNAPSHOT_MISMATCH" });
        return send(200, row);
      }
      let rows = filteredLedgers(q);
      if (q.get("cursor")) rows = rows.filter(row => row.id > q.get("cursor"));
      const limit = Number(q.get("limit") ?? 20);
      // List projection is deliberately identical to the API's safe contract.
      return send(200, { items: rows.slice(0, limit).map(({ payoutReference, payoutBatchId, unavailableReason, consultation, history, historyTruncated, ...row }) => row), nextCursor: rows.length > limit ? rows[limit - 1].id : null });
    }
    if (financeState.failure) return send(409, null, financeState.failure);
    if (data.actorPassword !== "DemoPassword123!") return send(403, null, "PASSWORD_CONFIRMATION_FAILED");
    if (id === "bulk-reconcile" && req.method === "POST") {
      const selected = data.items.map(item => ({ row: ledgers.get(item.id), expectedRevision: item.expectedRevision }));
      if (selected.some(({ row, expectedRevision }) => !row || row.revision !== expectedRevision)) return send(409, null, "SETTLEMENT_VERSION_CONFLICT");
      if (selected.some(({ row }) => !row.canReconcile || row.vet?.id !== data.vetId || row.currency !== data.currency)) return send(409, null, "SETTLEMENT_ACTION_UNAVAILABLE");
      for (const { row } of selected) reconcile(row, data, true);
      return send(200, { items: selected.map(({ row }) => row) });
    }
    const row = ledgers.get(id);
    if (!row || suffix !== "reconcile" || req.method !== "POST") return send(404, null);
    if (row.revision !== data.expectedRevision) return send(409, null, "SETTLEMENT_VERSION_CONFLICT");
    if (!row.canReconcile) return send(409, null, "SETTLEMENT_ACTION_UNAVAILABLE");
    reconcile(row, data, false);
    return send(200, row);
  }
  const row = reviews.get(id);
  if (req.method === "GET") {
    if (id) return send(row ? 200 : 404, row ?? null);
    let rows = [...reviews.values()].filter(r => (!q.get("status") || r.moderationStatus === q.get("status")) && (!q.get("rating") || r.rating === Number(q.get("rating"))) && (!q.get("vetId") || r.vet?.id === q.get("vetId")) && (!q.get("search") || (r.feedback ?? "").toLowerCase().includes(q.get("search").toLowerCase())));
    if (q.get("cursor")) rows = rows.filter(r => r.id > q.get("cursor"));
    const limit = Number(q.get("limit") ?? 20);
    return send(200, { items: rows.slice(0, limit), nextCursor: rows.length > limit ? rows[limit - 1].id : null });
  }
  if (!row || suffix !== "moderate" || req.method !== "POST") return send(404, null);
  if (financeState.failure) return send(409, null, financeState.failure);
  if (data.actorPassword !== "DemoPassword123!") return send(403, null, "PASSWORD_CONFIRMATION_FAILED");
  if (row.revision !== data.expectedRevision) return send(409, null, "REVIEW_VERSION_CONFLICT");
  if (!row.allowedStatuses.includes(data.status)) return send(409, null, "REVIEW_ACTION_UNAVAILABLE");
  Object.assign(row, { moderationStatus: data.status, moderationReason: data.reason, moderatedAt: date, moderator: { id: uuid(120), name: "Synthetic moderator" }, revision: revision(), allowedStatuses: ["APPROVED", "FLAGGED", "REJECTED"].filter(status => status !== data.status) });
  row.history.unshift({ id: uuid(800 + financeState.revision), action: "ADMIN_REVIEW_MODERATED", actor: row.moderator, reason: data.reason, createdAt: date });
  return send(200, row);
}

export async function checkAdminFinance({ seed, go, call, evaluate, until, temp, requests }) {
  let checks = 0;
  const set = (id, value) => evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});if(!e)throw new Error('Missing field '+${JSON.stringify(id)});const proto=e.tagName==='SELECT'?HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
  const click = selector => evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const visible = selector => until(() => evaluate(`!!document.querySelector(${JSON.stringify(selector)})`), `Ready ${selector}`);
  const noOverflow = async () => { assert.equal(await evaluate("document.documentElement.scrollWidth>innerWidth"), false); checks++; };
  const confirm = async selector => {
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).requestSubmit()`);
    await visible("dialog[open]");
    await click("[data-finance-confirm]");
  };
  const saved = () => until(() => evaluate(`!document.querySelector('dialog[open]')&&!!document.querySelector('[data-finance-saved]')`), "Finance acknowledged save");
  const settlementDraft = async () => {
    await set("settlement-reference", "SYNTHETIC-EXTERNAL-REFERENCE");
    await set("settlement-reason", "Reviewed synthetic reconciliation evidence");
    await set("settlement-password", "DemoPassword123!");
  };
  const shot = async name => {
    const result = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    await writeFile(path.join(temp, name), Buffer.from(result.data, "base64"));
  };
  for (const role of ["ADMIN", "SUPER_ADMIN"]) for (const locale of ["bn", "en"]) for (const width of [320, 1440]) {
    reset(); await seed(role, locale);
    await call("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
    await go("/admin/settlements"); await visible("[data-settlement-row]"); await visible("[data-settlement-summary]");
    assert.equal(await evaluate(`document.querySelector('[data-settlement-summary]').textContent.includes('USD')&&document.querySelector('[data-settlement-summary]').textContent.includes('EUR')`), true); checks++;
    await noOverflow();
    await go(`/admin/settlements/vets/${ids.vet}`); await visible("[data-settlement-row]"); await noOverflow();
    await go(`/admin/settlements/${ids.single}`); await visible("[data-settlement-detail]"); await visible("[data-settlement-preview]"); await noOverflow();
    await settlementDraft();
    if (role === "ADMIN" && locale === "en" && width === 320) {
      financeState.failure = "SETTLEMENT_VERSION_CONFLICT";
      await confirm("[data-settlement-support] form");
      await visible("[data-settlement-support] [role=alert]");
      assert.equal(await evaluate(`document.getElementById('settlement-reference').value`), "SYNTHETIC-EXTERNAL-REFERENCE");
      assert.equal(await evaluate(`document.getElementById('settlement-password').value`), ""); checks += 2;
      financeState.failure = null; await click("[data-finance-reload]");
      await until(() => evaluate(`!!document.getElementById('settlement-password')&&!document.getElementById('settlement-password').disabled`), "Settlement reload before retry");
      await set("settlement-password", "DemoPassword123!");
    }
    await confirm("[data-settlement-support] form"); await saved();
    assert.equal(ledgers.get(ids.single).status, "PAID"); assert.equal(ledgers.get(ids.single).payoutReference, "SYNTHETIC-EXTERNAL-REFERENCE"); checks += 2;
    if (role === "ADMIN") await shot(`settlement-detail-${locale}-${width}.png`);
    await go(`/admin/settlements/${ids.held}`); await visible("[data-settlement-detail]");
    assert.equal(await evaluate(`!!document.querySelector('[data-settlement-support] form')`), false); checks++;
    await go(`/admin/settlements/${ids.inconsistent}`); await visible("[data-settlement-detail]");
    assert.equal(await evaluate(`!!document.querySelector('[data-settlement-support] form')`), false); checks++;
    await go("/admin/settlements"); await visible(`[data-settlement-select="${ids.bulkA}"]`);
    await click(`[data-settlement-select="${ids.bulkA}"]`); await click(`[data-settlement-select="${ids.bulkB}"]`);
    await visible("[data-settlement-bulk] form"); await settlementDraft();
    await confirm("[data-settlement-bulk] form"); await saved();
    assert.equal(ledgers.get(ids.bulkA).status, "PAID"); assert.equal(ledgers.get(ids.bulkB).status, "PAID"); checks += 2;
    await go("/admin/reviews"); await visible("[data-review-row]"); await noOverflow();
    await go(`/admin/reviews/${ids.review}`); await visible("[data-review-detail]"); await noOverflow();
    assert.equal(await evaluate(`document.querySelector('[data-review-detail]').textContent.includes('<strong>only</strong>')`), true); checks++;
    await set("review-action", "APPROVED"); await set("review-reason", "Reviewed synthetic private feedback"); await set("review-password", "DemoPassword123!");
    await confirm("[data-review-support] form"); await saved();
    assert.equal(reviews.get(ids.review).moderationStatus, "APPROVED"); assert.equal(reviews.get(ids.review).isPublic, false); assert.equal(await evaluate(`document.getElementById('review-password').value`), ""); checks += 3;
    if (role === "ADMIN") await shot(`review-detail-${locale}-${width}.png`);
  }
  reset(); await seed("ADMIN", "en");
  await go(`/admin/reviews/${ids.review}`); await visible("[data-review-detail]");
  await set("review-reason", "Preserved synthetic moderator draft"); await set("review-password", "deliberately-wrong-password");
  await confirm("[data-review-support] form"); await visible("[data-review-support] [role=alert]");
  assert.equal(reviews.get(ids.review).moderationStatus, "FLAGGED"); assert.equal(await evaluate(`document.getElementById('review-reason').value`), "Preserved synthetic moderator draft"); assert.equal(await evaluate(`document.getElementById('review-password').value`), ""); checks += 3;
  financeState.failure = "REVIEW_VERSION_CONFLICT";
  await set("review-password", "DemoPassword123!"); await confirm("[data-review-support] form"); await visible("[data-finance-reload]");
  assert.equal(await evaluate(`document.getElementById('review-password').value`), ""); checks++;
  financeState.failure = null; await click("[data-finance-reload]");
  await until(() => evaluate(`!!document.getElementById('review-password')&&!document.getElementById('review-password').disabled`), "Review refresh");
  await set("review-password", "DemoPassword123!");
  await evaluate(`document.querySelector('[data-review-support] form').requestSubmit()`); await visible("dialog[open]");
  const before = requests.filter(r => r.route === `admin/reviews/${ids.review}/moderate`).length;
  await evaluate(`(()=>{const b=document.querySelector('[data-finance-confirm]');b.click();b.click();})()`); await saved();
  assert.equal(requests.filter(r => r.route === `admin/reviews/${ids.review}/moderate`).length - before, 1); checks++;
  financeState.unavailable = true; await go("/admin/settlements"); await visible("main [role=alert]");
  financeState.unavailable = false; await click("[data-finance-retry]"); await visible("[data-settlement-row]"); checks++;
  for (const role of ["LEARNER", "FARMER", "VET", "BUYER"]) {
    await seed(role, "en");
    for (const route of ["/admin/settlements", `/admin/settlements/${ids.single}`, `/admin/settlements/vets/${ids.vet}`, "/admin/reviews", `/admin/reviews/${ids.review}`]) {
      await go(route, "/account/profile"); assert.equal(await evaluate(`!!document.querySelector('[data-settlement-list],[data-settlement-detail],[data-review-list],[data-review-detail]')`), false); checks++;
    }
    for (const endpoint of ["admin/settlements", "admin/reviews"]) {
      assert.equal(await evaluate(`fetch('/api/workspace/${endpoint}').then(r=>r.status)`), 403); checks++;
    }
  }
  assert(requests.some(r => r.route === "admin/settlements/bulk-reconcile" && r.method === "POST"));
  assert(requests.some(r => r.route.endsWith("/preview") && r.method === "GET"));
  assert.equal(requests.some(r => /(?:\/transfer|\/refund|\/capture-payment|\/notify-vet)/.test(r.route)), false); checks += 3;
  console.log(`Passed ${checks} settlement/moderation browser checks. Screenshots: ${temp}`);
  return checks;
}
