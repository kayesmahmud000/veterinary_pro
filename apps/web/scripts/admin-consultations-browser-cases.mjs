// Controlled upstream fixtures exercise the actual production Next UI/BFF.
// Database concurrency and provider acceptance are verified separately.
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const date = "2026-10-16T00:00:00Z";
const id = (n) => `990e8400-e29b-41d4-a716-${String(n).padStart(12, "0")}`;
const ids = { manual: id(1), auto: id(2), cancel: id(3), provider: id(4), terminal: id(5), vet: id(10), unavailable: id(11) };
const owner = { id: id(20), name: "Synthetic consultation owner" };
export const consultationState = { failure: null, unavailable: false, noCandidates: false, version: 0 };
const rows = new Map();
function reset() {
  consultationState.failure = null;
  consultationState.unavailable = false;
  consultationState.noCandidates = false;
  rows.clear();
  for (const [key, caseId] of Object.entries(ids).slice(0, 5)) {
    rows.set(caseId, {
      id: caseId, status: key === "terminal" ? "COMPLETED" : key === "cancel" ? "ASSIGNED" : "SUBMITTED",
      type: key === "auto" ? "LIVE_VIDEO" : "ASYNC_TICKET",
      chiefComplaint: `Synthetic ${key} request: animal appetite needs assessment.`,
      farmer: owner, vet: key === "cancel" ? { id: ids.vet, name: "Synthetic available vet" } : null,
      farm: { id: id(30), name: "Synthetic consultation farm" },
      animal: { id: id(31), name: "Synthetic cow", tagNumber: "ADM5-TEST", species: "COW" },
      feeCents: 1500, currency: "USD", paymentStatus: key === "provider" ? "AUTHORIZED" : "UNPAID",
      scheduledAt: null, assignedAt: key === "cancel" ? date : null, createdAt: date, updatedAt: date,
      revision: String(++consultationState.version).padStart(64, "0"),
      allowedActions: key === "terminal" ? [] : key === "provider" ? ["ASSIGN", "AUTO_ASSIGN"] : ["ASSIGN", "AUTO_ASSIGN", "CANCEL"],
      history: [{ id: id(40), action: "CONSULTATION_REQUEST_SUBMITTED", actor: owner, reason: null, createdAt: date }],
      historyTruncated: false, notifications: [], notificationsTruncated: false,
    });
  }
}
reset();
function candidates() {
  if (consultationState.noCandidates) return [];
  return [
    { vetId: ids.vet, name: "Synthetic available vet", specialties: ["COW"], isAvailable: true, currentActiveCases: 1, maxActiveCases: 5, totalScore: 84, isEligible: true, ineligibilityReason: null },
    { vetId: ids.unavailable, name: "Synthetic off-duty vet", specialties: [], isAvailable: false, currentActiveCases: 0, maxActiveCases: 5, totalScore: 0, isEligible: false, ineligibilityReason: "UNAVAILABLE" },
  ];
}
export function handleConsultationsFixture(req, res, data, route, role) {
  if (route !== "admin/consultations" && !route.startsWith("admin/consultations/")) return false;
  const send = (status, value, code) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: status < 400, data: value, ...(code ? { errorDetails: { title: code } } : {}) }));
    return true;
  };
  if (!["ADMIN", "SUPER_ADMIN"].includes(role)) return send(403, null);
  if (consultationState.unavailable) return send(503, null);
  const [, , caseId, suffix] = route.split("/");
  const row = rows.get(caseId);
  if (req.method === "GET") {
    if (suffix === "candidates") return row ? send(200, { consultationId: caseId, items: candidates(), truncated: false }) : send(404, null);
    if (caseId) return row ? send(200, row) : send(404, null);
    const q = new URL(req.url, "http://fixture").searchParams;
    const items = [...rows.values()].filter((r) =>
      (!q.get("status") || r.status === q.get("status")) &&
      (!q.get("type") || r.type === q.get("type")) &&
      (!q.get("cursor") || r.id > q.get("cursor")) &&
      (!q.get("search") || `${r.id} ${r.chiefComplaint} ${r.farm.name}`.toLowerCase().includes(q.get("search").toLowerCase())),
    );
    const limit = Number(q.get("limit") ?? 20);
    return send(200, { items: items.slice(0, limit), nextCursor: items.length > limit ? items[limit - 1].id : null });
  }
  if (!row || req.method !== "POST" || suffix !== "actions") return send(404, null);
  if (consultationState.failure) return send(409, null, consultationState.failure);
  if (data.actorPassword !== "DemoPassword123!") return send(403, null, "PASSWORD_CONFIRMATION_FAILED");
  if (data.expectedRevision !== row.revision) return send(409, null, "CONSULTATION_VERSION_CONFLICT");
  if (!row.allowedActions.includes(data.action)) return send(409, null, "CONSULTATION_ACTION_UNAVAILABLE");
  if (data.action === "CANCEL") {
    row.status = "CANCELLED";
    row.allowedActions = [];
  } else {
    const selected = candidates().find((c) => c.isEligible && (data.action === "AUTO_ASSIGN" || c.vetId === data.vetId));
    if (!selected) return send(409, null, "CONSULTATION_ACTION_UNAVAILABLE");
    row.status = "ASSIGNED";
    row.vet = { id: selected.vetId, name: selected.name };
    row.assignedAt = date;
  }
  row.revision = String(++consultationState.version).padStart(64, "0");
  row.history.unshift({ id: id(50 + consultationState.version), action: data.action === "CANCEL" ? "CONSULTATION_ADMIN_CANCELLED" : data.action === "AUTO_ASSIGN" ? "CONSULTATION_ADMIN_AUTO_ASSIGNED" : "CONSULTATION_ADMIN_ASSIGNED", actor: { id: id(21), name: "Synthetic admin" }, reason: data.reason, createdAt: date });
  if (row.vet) row.notifications.unshift({ id: id(100 + consultationState.version), channel: "IN_APP", status: "SENT", dispatchedAt: date, readAt: null });
  return send(200, row);
}

export async function checkAdminConsultations({ seed, go, call, evaluate, until, temp, requests }) {
  let checks = 0;
  const set = (field, value) => evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(field)});if(!e)throw new Error('Missing field '+${JSON.stringify(field)});const proto=e.tagName==='SELECT'?HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`);
  const ready = () => until(() => evaluate(`!!document.querySelector('[data-consultation-detail]')`), "Consultation detail ready");
  const action = async (value) => {
    await set("consultation-action", value);
    if (value === "ASSIGN") {
      await until(() => evaluate(`!!document.querySelector('#consultation-vet option[value="${ids.vet}"]')`), "Eligible vet option loaded");
      await set("consultation-vet", ids.vet);
    }
    await set("consultation-reason", "Reviewed synthetic consultation request");
    await set("consultation-password", "DemoPassword123!");
  };
  const confirm = async () => {
    await until(() => evaluate(`!!document.querySelector('[data-consultation-support] form button:not([type="button"]):not(:disabled)')`), "Consultation action available");
    await evaluate(`document.querySelector('[data-consultation-support] form').requestSubmit()`);
    await until(() => evaluate(`!!document.querySelector('dialog[open]')`), "Consultation confirmation");
    await evaluate(`(document.querySelector('[data-consultation-confirm]')||document.querySelector('dialog[open] button')).click()`);
  };
  const saved = () => until(() => evaluate(`!document.querySelector('dialog[open]')&&!!document.querySelector('main [role="status"]')`), "Acknowledged consultation save");
  for (const role of ["ADMIN", "SUPER_ADMIN"]) for (const locale of ["bn", "en"]) for (const width of [320, 1440]) {
    reset();
    await seed(role, locale);
    await call("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
    await go("/admin/dashboard");
    await until(() => evaluate(`!!document.querySelector('[data-admin-consultations-shortcut] a')`), "Consultation dashboard entry");
    await evaluate(`document.querySelector('[data-admin-consultations-shortcut] a').click()`);
    await until(() => evaluate(`!!document.querySelector('[data-consultation-row]')`), "Dashboard to triage");
    checks++;
    for (const page of ["triage", "consultations"]) {
      await go(`/admin/${page}`);
      await until(() => evaluate(`!!document.querySelector('[data-consultation-row]')`), "Consultation list loaded");
      assert.equal(await evaluate("document.documentElement.scrollWidth>innerWidth"), false);
      assert.equal(await evaluate(`!!document.querySelector('main [role="alert"]')`), false);
      checks += 2;
    }
    await go(`/admin/triage/${ids.manual}`);
    await ready();
    await until(() => evaluate(`!!document.getElementById('consultation-vet')`), "Candidate selection ready");
    assert.equal(await evaluate(`document.body.innerText.includes('Synthetic consultation owner')`), true);
    assert.equal(await evaluate("document.documentElement.scrollWidth>innerWidth"), false);
    checks += 2;
    await action("ASSIGN");
    if (role === "ADMIN" && locale === "en" && width === 320) {
      consultationState.failure = "CONSULTATION_VERSION_CONFLICT";
      await confirm();
      await until(() => evaluate(`!!document.querySelector('[data-consultation-support] [role="alert"]')`), "Stale consultation feedback");
      assert.equal(await evaluate(`document.getElementById('consultation-reason').value`), "Reviewed synthetic consultation request");
      assert.equal(await evaluate(`document.getElementById('consultation-password').value`), "");
      checks += 2;
      consultationState.failure = null;
      await evaluate(`document.querySelector('[data-consultation-reload]').click()`);
      await until(() => evaluate(`!!document.getElementById('consultation-password')&&!document.getElementById('consultation-password').disabled`), "Reload before retry");
      await set("consultation-password", "DemoPassword123!");
    }
    await confirm();
    await saved();
    assert.equal(rows.get(ids.manual).vet?.id, ids.vet);
    assert.equal(await evaluate(`document.getElementById('consultation-password').value`), "");
    assert.equal(await evaluate("document.documentElement.scrollWidth>innerWidth"), false);
    checks += 3;
    if (role === "ADMIN") {
      const shot = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
      await writeFile(path.join(temp, `consultation-detail-${locale}-${width}.png`), Buffer.from(shot.data, "base64"));
    }
    await go(`/admin/consultations/${ids.auto}`);
    await ready();
    await action("AUTO_ASSIGN");
    await confirm();
    await saved();
    assert.equal(rows.get(ids.auto).status, "ASSIGNED");
    assert.equal(rows.get(ids.auto).notifications[0]?.channel, "IN_APP");
    checks += 2;
    await go(`/admin/consultations/${ids.cancel}`);
    await ready();
    await action("CANCEL");
    await confirm();
    await saved();
    assert.equal(rows.get(ids.cancel).status, "CANCELLED");
    assert.equal(rows.get(ids.cancel).paymentStatus, "UNPAID");
    checks += 2;
    await go(`/admin/consultations/${ids.provider}`);
    await ready();
    assert.equal(await evaluate(`!!document.querySelector('#consultation-action option[value="CANCEL"]')`), false);
    await go(`/admin/consultations/${ids.terminal}`);
    await ready();
    assert.equal(await evaluate(`!!document.querySelector('[data-consultation-support] form')`), false);
    checks += 2;
  }
  reset();
  await seed("ADMIN", "en");
  consultationState.noCandidates = true;
  await go(`/admin/triage/${ids.manual}`);
  await ready();
  await until(() => evaluate(`!!document.querySelector('[data-consultation-candidates]')`), "No candidate state");
  assert.equal(await evaluate(`document.querySelectorAll('#consultation-vet option:not([value=""])').length`), 0);
  checks++;
  consultationState.noCandidates = false;
  await go("/admin/consultations");
  await until(() => evaluate(`!!document.querySelector('[data-consultation-row]')`), "History search ready");
  await set("consultation-search", "nonexistent synthetic record");
  await evaluate(`document.getElementById('consultation-search').closest('form').requestSubmit()`);
  await until(() => evaluate(`!document.querySelector('[data-consultation-row]')&&!!document.querySelector('[data-consultation-list]')`), "Empty search");
  checks++;
  consultationState.unavailable = true;
  await go("/admin/triage");
  await until(() => evaluate(`!!document.querySelector('main [role="alert"]')`), "Unavailable consultation state");
  consultationState.unavailable = false;
  await evaluate(`document.querySelector('[data-consultation-retry]').click()`);
  await until(() => evaluate(`!!document.querySelector('[data-consultation-row]')`), "Consultation retry");
  checks++;
  // Wrong confirmation password keeps the reviewed nonsecret draft, and rapid
  // confirmation clicks must still produce exactly one acknowledged mutation.
  await go(`/admin/triage/${ids.manual}`);
  await ready();
  await action("ASSIGN");
  await set("consultation-password", "deliberately-wrong-password");
  await confirm();
  await until(() => evaluate(`!!document.querySelector('[data-consultation-support] [role="alert"]')`), "Password rejection");
  assert.equal(rows.get(ids.manual).status, "SUBMITTED");
  assert.equal(await evaluate(`document.getElementById('consultation-reason').value`), "Reviewed synthetic consultation request");
  assert.equal(await evaluate(`document.getElementById('consultation-password').value`), "");
  checks += 3;
  await set("consultation-password", "DemoPassword123!");
  await evaluate(`document.querySelector('[data-consultation-support] form').requestSubmit()`);
  await until(() => evaluate(`!!document.querySelector('dialog[open]')`), "Retry confirmation");
  const writesBefore = requests.filter(r => r.route === `admin/consultations/${ids.manual}/actions`).length;
  await evaluate(`(()=>{const b=document.querySelector('[data-consultation-confirm]');b.click();b.click();})()`);
  await saved();
  assert.equal(requests.filter(r => r.route === `admin/consultations/${ids.manual}/actions`).length - writesBefore, 1);
  assert.equal(rows.get(ids.manual).status, "ASSIGNED");
  checks += 2;
  await action("ASSIGN");
  await evaluate(`window.dispatchEvent(new Event('vetralink-session-updated'))`);
  await until(() => evaluate(`!!document.getElementById('consultation-password')&&!document.getElementById('consultation-password').value&&!!document.querySelector('[data-consultation-support] form')?.getClientRects().length`), "Same-identity revalidation");
  assert.equal(await evaluate(`document.getElementById('consultation-reason').value`), "Reviewed synthetic consultation request");
  checks++;
  await set("consultation-password", "DemoPassword123!");
  await seed("SUPER_ADMIN", "en");
  await evaluate(`window.dispatchEvent(new Event('vetralink-session-updated'))`);
  await until(() => evaluate(`!!document.getElementById('consultation-reason')&&!document.getElementById('consultation-reason').value`), "Changed-identity draft isolation");
  assert.equal(await evaluate(`document.getElementById('consultation-password').value`), "");
  checks++;
  await go("/admin/consultations?limit=1");
  await until(() => evaluate(`!!document.querySelector('[data-consultation-next]')`), "First cursor page");
  await evaluate(`document.querySelector('[data-consultation-next]').click()`);
  await until(() => evaluate(`new URLSearchParams(location.search).get('cursor')==='${ids.manual}'&&!!document.querySelector('[data-consultation-row]')`), "Second cursor page");
  await evaluate(`document.querySelector('[data-consultation-next]').click()`);
  await until(() => evaluate(`new URLSearchParams(location.search).get('cursor')==='${ids.auto}'&&!!document.querySelector('[data-consultation-row]')`), "Third cursor page");
  await evaluate(`document.querySelector('[data-consultation-previous]').click()`);
  await until(() => evaluate(`new URLSearchParams(location.search).get('cursor')==='${ids.manual}'&&!!document.querySelector('[data-consultation-row]')`), "Previous cursor page");
  assert.equal(await evaluate(`document.querySelector('[data-consultation-row]').textContent.includes('Synthetic auto request')`), true);
  checks++;
  await evaluate(`document.querySelector('main nav a[href="/admin/consultations"]').click()`);
  await until(() => evaluate(`!location.search&&!!document.querySelector('[data-consultation-row]')`), "External filter reset");
  assert.equal(await evaluate(`!!document.querySelector('[data-consultation-previous]')`), false);
  checks++;
  for (const role of ["LEARNER", "FARMER", "VET", "BUYER"]) {
    await seed(role, "en");
    for (const route of ["/admin/triage", `/admin/triage/${ids.manual}`, "/admin/consultations", `/admin/consultations/${ids.manual}`]) {
      await go(route, "/account/profile");
      assert.equal(await evaluate(`!!document.querySelector('[data-consultation-list],[data-consultation-detail]')`), false);
      checks++;
    }
    assert.equal(await evaluate(`fetch('/api/workspace/admin/consultations').then(r=>r.status)`), 403);
    checks++;
  }
  assert(requests.some((r) => r.route === `admin/consultations/${ids.manual}/actions` && r.method === "POST"));
  assert.equal(requests.some((r) => /(?:settlement|notify-vet|release-hold|capture-payment)/.test(r.route)), false);
  checks += 2;
  console.log(`Passed ${checks} consultation browser checks. Screenshots: ${temp}`);
  return checks;
}
