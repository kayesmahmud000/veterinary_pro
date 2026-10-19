import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url),
  { NextRequest } = require("next/server");
function compile(file, overrides = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(file, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  );
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name) => overrides[name] ?? require(name),
    module,
    module.exports,
  );
  return module.exports;
}
const { resolveEndpoint, handleWorkspace } = compile(
  "../src/lib/workspace/server.ts",
  {
    "./contracts": compile("../src/lib/workspace/contracts.ts"),
    "./farm-contracts": compile("../src/lib/workspace/farm-contracts.ts"),
    "../api-diagnostics": compile("../src/lib/api-diagnostics.ts"),
  },
);

const id = "550e8400-e29b-41d4-a716-446655440001",
  other = "550e8400-e29b-41d4-a716-446655440002",
  date = "2026-10-16T00:00:00Z";
const identity = {
  id,
  name: "Operator",
  email: "operator@example.test",
  role: "ADMIN",
  status: "ACTIVE",
  roleVersion: 0,
  createdAt: date,
  isEmailVerified: false,
  avatarUrl: null,
  maskedPhone: null,
};
function request(path, method = "GET", body, headers = {}) {
  return new NextRequest(`http://localhost:3100/api/workspace/${path}`, {
    method,
    headers: {
      Cookie: "vetralink_access=synthetic",
      Origin: "http://localhost:3100",
      "Content-Type": "application/json",
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
function fixture(
  t,
  {
    role = "ADMIN",
    data = { items: [], nextCursor: null },
    status = 200,
    code,
  } = {},
) {
  const original = globalThis.fetch,
    calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: new URL(url), init });
    return new URL(url).pathname.endsWith("/auth/me")
      ? Response.json({ success: true, data: { ...identity, role } })
      : Response.json(
          code
            ? { errorDetails: { title: code }, secret: "private" }
            : { success: true, data },
          { status },
        );
  };
  t.after(() => {
    globalThis.fetch = original;
  });
  return calls;
}
const single = {
  expectedRevision: "a".repeat(64),
  reason: "Reviewed externally",
  actorPassword: "synthetic",
  payoutReference: "BANK-123",
};
const moderate = {
  expectedRevision: single.expectedRevision,
  reason: single.reason,
  actorPassword: single.actorPassword,
  status: "APPROVED",
};
test("finance routes admit exact methods and UUIDs only", () => {
  for (const [path, method] of [
    ["admin/settlements", "GET"],
    ["admin/settlements/summary", "GET"],
    [`admin/settlements/${id}`, "GET"],
    [`admin/settlements/${id}/preview`, "GET"],
    [`admin/settlements/${id}/reconcile`, "POST"],
    ["admin/settlements/bulk-reconcile", "POST"],
    ["admin/reviews", "GET"],
    [`admin/reviews/${id}`, "GET"],
    [`admin/reviews/${id}/moderate`, "POST"],
  ])
    assert.ok(resolveEndpoint(path.split("/"), method), `${method} ${path}`);
  for (const [path, method] of [
    ["admin/settlements", "POST"],
    ["admin/settlements/bad", "GET"],
    [`admin/reviews/${id}/moderate`, "GET"],
    [`admin/settlements/${id}/reconcile`, "PATCH"],
  ])
    assert.equal(resolveEndpoint(path.split("/"), method), null);
});
for (const role of [
  "ADMIN",
  "SUPER_ADMIN",
  "LEARNER",
  "FARMER",
  "BUYER",
  "VET",
])
  test(`${role} finance list exact role gate`, async (t) => {
    const calls = fixture(t, { role });
    for (const kind of ["settlements", "reviews"]) {
      const res = await handleWorkspace(request(`admin/${kind}`), [
        "admin",
        kind,
      ]);
      assert.equal(
        res.status,
        ["ADMIN", "SUPER_ADMIN"].includes(role) ? 200 : 403,
      );
    }
    assert.equal(calls.length, ["ADMIN", "SUPER_ADMIN"].includes(role) ? 4 : 2);
  });
test("finance queries and action bodies reject invalid input before upstream", async (t) => {
  const calls = fixture(t);
  for (const [kind, queries] of [
    [
      "settlements",
      [
        "currency=bdt",
        "vetId=bad",
        "status=bad",
        "limit=101",
        "limit=20&limit=21",
        "email=secret",
      ],
    ],
    [
      "reviews",
      ["rating=6", "rating=1.5", "vetId=bad", "status=bad", "limit=0"],
    ],
  ])
    for (const q of queries)
      assert.equal(
        (await handleWorkspace(request(`admin/${kind}?${q}`), ["admin", kind]))
          .status,
        422,
      );
  for (const [kind, suffix, input] of [
    ["settlements", "reconcile", single],
    ["reviews", "moderate", moderate],
  ]) {
    for (const body of [
      { ...input, extra: true },
      { ...input, reason: "tiny" },
      { ...input, expectedRevision: "bad" },
      { ...input, actorPassword: "" },
    ])
      assert.equal(
        (
          await handleWorkspace(
            request(`admin/${kind}/${id}/${suffix}`, "POST", body),
            ["admin", kind, id, suffix],
          )
        ).status,
        422,
      );
    assert.equal(
      (
        await handleWorkspace(
          request(`admin/${kind}/${id}/${suffix}`, "POST", input, {
            "content-length": "17000",
          }),
          ["admin", kind, id, suffix],
        )
      ).status,
      413,
    );
  }
  assert.equal(calls.length, 0);
});
const navigation = compile("../src/lib/workspace/navigation.ts", {
  "../i18n/workspace-shell": compile("../src/lib/i18n/workspace-shell.ts"),
});
test("finance return paths retain bounded filters and deny vet mismatch", () => {
  for (const path of [
    `/admin/settlements`,
    `/admin/settlements/${id}`,
    `/admin/settlements/vets/${id}?vetId=${id}&status=PENDING&currency=BDT`,
    `/admin/reviews?rating=5&status=FLAGGED`,
    `/admin/reviews/${id}`,
  ])
    assert.equal(navigation.validateWorkspaceReturnTo(path), path);
  for (const path of [
    `/admin/settlements/vets/${id}?vetId=${other}`,
    `/admin/settlements?currency=bdt`,
    `/admin/reviews?rating=6`,
    `/admin/reviews/${id}?status=PENDING`,
  ])
    assert.equal(navigation.validateWorkspaceReturnTo(path), null);
});

const row = (overrides = {}) => ({
  id,
  consultationId: other,
  vet: { id: other, name: "Veterinarian" },
  status: "PENDING",
  totalFeeCents: 10000,
  platformFeeRate: 0.2,
  platformFeeCents: 2000,
  vetPayoutCents: 8000,
  currency: "BDT",
  processedAt: null,
  createdAt: date,
  updatedAt: date,
  revision: "a".repeat(64),
  canReconcile: true,
  ...overrides,
});
const detail = (overrides = {}) => ({
  ...row(),
  payoutReference: null,
  payoutBatchId: null,
  unavailableReason: null,
  consultation: {
    id: other,
    status: "COMPLETED",
    paymentStatus: "CAPTURED",
    type: "ASYNC_TICKET",
    farmer: null,
    farm: null,
    feeCents: 10000,
    currency: "BDT",
  },
  history: [],
  historyTruncated: false,
  ...overrides,
});
const paidDetail = (overrides = {}) =>
  detail({
    status: "PAID",
    canReconcile: false,
    unavailableReason: "STATUS",
    processedAt: date,
    payoutReference: single.payoutReference,
    ...overrides,
  });
const { expectedRevision: _revision, ...confirmationFields } = single;
const bulk = {
  ...confirmationFields,
  items: [{ id, expectedRevision: single.expectedRevision }],
  vetId: other,
  currency: "BDT",
};

test("finance reads reject mismatched entity, vet, currency and status responses", async (t) => {
  for (const [path, data] of [
    [`admin/settlements/${id}`, detail({ id: other })],
    [
      `admin/settlements/${id}/preview`,
      {
        id: other,
        totalFeeCents: 10000,
        platformFeeRate: 0.2,
        platformFeeCents: 2000,
        vetPayoutCents: 8000,
        currency: "BDT",
        matchesStoredSplit: true,
      },
    ],
    [`admin/settlements?vetId=${id}`, { items: [row()], nextCursor: null }],
    [`admin/settlements?currency=USD`, { items: [row()], nextCursor: null }],
    [`admin/settlements?status=PAID`, { items: [row()], nextCursor: null }],
    [
      `admin/settlements/summary?currency=USD`,
      {
        items: [
          {
            currency: "BDT",
            count: 1,
            totalGrossCents: 10000,
            platformFeeCents: 2000,
            vetEarningsCents: 8000,
            pendingPayoutCents: 8000,
            paidPayoutCents: 0,
            heldPayoutCents: 0,
            reversedPayoutCents: 0,
          },
        ],
      },
    ],
  ]) {
    fixture(t, { data });
    const res = await handleWorkspace(
      request(path),
      path.split("?")[0].split("/"),
    );
    assert.equal(res.status, 502, path);
    assert.deepEqual(await res.json(), { code: "INVALID_RESPONSE" });
  }
});

test("settlement detail must correlate its consultation to its ledger", async (t) => {
  fixture(t, {
    data: detail({ consultation: { ...detail().consultation, id } }),
  });
  const res = await handleWorkspace(request(`admin/settlements/${id}`), [
    "admin",
    "settlements",
    id,
  ]);
  assert.equal(res.status, 502);
});

test("successful reconciliation must acknowledge the submitted local reconciliation", async (t) => {
  for (const data of [detail(), paidDetail({ payoutReference: "OTHER" })]) {
    fixture(t, { data });
    const res = await handleWorkspace(
      request(`admin/settlements/${id}/reconcile`, "POST", single),
      ["admin", "settlements", id, "reconcile"],
    );
    assert.equal(res.status, 502);
  }
});

test("bulk reconciliation rejects missing, duplicate, unrelated and unacknowledged rows", async (t) => {
  for (const items of [
    [],
    [paidDetail(), paidDetail()],
    [paidDetail({ id: other })],
    [paidDetail({ vet: { id, name: "Wrong" } })],
    [paidDetail({ currency: "USD" })],
    [detail()],
  ]) {
    fixture(t, { data: { items } });
    const res = await handleWorkspace(
      request("admin/settlements/bulk-reconcile", "POST", bulk),
      ["admin", "settlements", "bulk-reconcile"],
    );
    assert.equal(res.status, 502);
  }
});

test("valid reads and confirmed reconciliation preserve safe data and private no-store headers", async (t) => {
  for (const [path, method, body, data] of [
    [
      "admin/settlements?status=PENDING&vetId=" + other,
      "GET",
      undefined,
      { items: [row()], nextCursor: null },
    ],
    [`admin/settlements/${id}/reconcile`, "POST", single, paidDetail()],
    [
      "admin/settlements/bulk-reconcile",
      "POST",
      bulk,
      { items: [paidDetail()] },
    ],
  ]) {
    const calls = fixture(t, { data });
    const res = await handleWorkspace(
      request(path, method, body),
      path.split("?")[0].split("/"),
    );
    assert.equal(res.status, 200, path);
    assert.equal(res.headers.get("cache-control"), "private, no-store");
    assert.equal(res.headers.get("vary"), "Cookie");
    assert.deepEqual(await res.json(), { data });
    assert.equal(calls.length, 2);
    assert.equal(calls[1].init.cache, "no-store");
    assert.equal(calls[1].init.redirect, "error");
    if (body) assert.deepEqual(JSON.parse(calls[1].init.body), body);
  }
});

test("finance errors expose only supported recovery codes", async (t) => {
  for (const [status, code, expected] of [
    [409, "SETTLEMENT_VERSION_CONFLICT", "SETTLEMENT_VERSION_CONFLICT"],
    [403, "PASSWORD_CONFIRMATION_FAILED", "PASSWORD_CONFIRMATION_FAILED"],
    [500, "DATABASE_SECRET", "UNAVAILABLE"],
    [429, "RATE_LIMITED", "RATE_LIMITED"],
  ]) {
    fixture(t, { status, code });
    const res = await handleWorkspace(
      request(`admin/settlements/${id}/reconcile`, "POST", single),
      ["admin", "settlements", id, "reconcile"],
    );
    assert.equal(res.status, status >= 500 ? 503 : status);
    assert.deepEqual(await res.json(), { code: expected });
  }
});

const financeCopy = compile("../src/lib/i18n/admin-finance.ts");
const financeUi = (locale) =>
  compile("../src/components/workspace/admin-finance-ui.tsx", {
    "@/components/auth/auth-provider": { useAuth: () => ({ locale }) },
    "@/lib/workspace/client": {},
    "@/lib/i18n/admin-finance": financeCopy,
    "@/lib/i18n/workspace": {},
    "./workspace-ui": {},
    "./workspace.styles": {},
  });
test("money retains exact minor units and localizes numbers in both languages", () => {
  for (const locale of ["en", "bn"]) {
    const f = financeUi(locale).useFinance();
    const expected = locale === "bn" ? "৯১" : "91";
    assert.ok(
      f.money(Number.MAX_SAFE_INTEGER, "BDT").includes(expected),
      f.money(Number.MAX_SAFE_INTEGER, "BDT"),
    );
    assert.ok(f.money(101, "JPY").includes(locale === "bn" ? "০১" : "01"));
    assert.ok(f.date(date).includes("Asia/Dhaka"));
  }
});

function actionHarness() {
  const slots = [],
    effects = [],
    pending = [];
  let index = 0,
    changed = false,
    response;
  const auth = { locale: "en", checking: false, error: null };
  const react = {
    useState(initial) {
      const position = index++;
      if (!(position in slots))
        slots[position] = typeof initial === "function" ? initial() : initial;
      return [
        slots[position],
        (value) => {
          const next =
            typeof value === "function" ? value(slots[position]) : value;
          if (next !== slots[position]) {
            slots[position] = next;
            changed = true;
          }
        },
      ];
    },
    useRef(initial) {
      const position = index++;
      return slots[position] ?? (slots[position] = { current: initial });
    },
    useEffect(effect, deps) {
      const position = index++,
        previous = effects[position];
      if (!previous || deps.some((value, i) => value !== previous.deps[i]))
        pending.push(() => {
          previous?.cleanup?.();
          effects[position] = { deps, cleanup: effect() };
        });
    },
  };
  const action = compile("../src/components/workspace/admin-finance-ui.tsx", {
    react,
    "@/components/auth/auth-provider": { useAuth: () => auth },
    "@/lib/workspace/client": {
      workspaceRequest: () =>
        new Promise((resolve) => {
          response = resolve;
        }),
    },
    "@/lib/i18n/admin-finance": financeCopy,
    "@/lib/i18n/workspace": {},
    "./workspace-ui": { Field: "Field", Confirmation: "Confirmation" },
    "./workspace.styles": { default: {} },
  }).FinanceAction;
  let tree;
  const props = {
    kind: "settlement",
    path: `admin/settlements/${id}/reconcile`,
    schema: {},
    rows: "Synthetic record",
    refreshing: false,
    readToken: {},
    onReload: () => {},
    onSaved: () => {},
    parse: (fields) => ({
      success:
        fields.reason.length >= 5 &&
        !!fields.actorPassword &&
        fields.payoutReference.length >= 3,
      data: fields,
    }),
  };
  function render() {
    let rounds = 0;
    do {
      changed = false;
      index = 0;
      tree = action(props);
      pending.splice(0).forEach((run) => run());
      assert.ok(++rounds < 10, "Hook state settles");
    } while (changed);
    return tree;
  }
  function find(predicate, node) {
    if (arguments.length === 1) node = tree;
    if (!node || typeof node !== "object") return null;
    if (Array.isArray(node))
      return node.map((child) => find(predicate, child)).find(Boolean) ?? null;
    if (predicate(node)) return node;
    return find(predicate, node.props?.children);
  }
  function input(name, value) {
    find((node) => node.props?.id === name).props.onChange({
      target: { value },
    });
    render();
  }
  render();
  return {
    auth,
    props,
    render,
    find,
    input,
    respond: (value) => response(value),
  };
}

test("record revalidation clears the password and confirmation while retaining nonsecret drafts", () => {
  const view = actionHarness();
  view.input("settlement-reference", "EXTERNAL-123");
  view.input("settlement-reason", "Reviewed externally");
  view.input("settlement-password", "synthetic");
  view
    .find((node) => node.type === "form")
    .props.onSubmit({ preventDefault() {} });
  view.render();
  assert.ok(view.find((node) => node.type === "Confirmation"));
  view.props.refreshing = true;
  view.render();
  assert.equal(
    view.find((node) => node.props?.id === "settlement-password").props.value,
    "",
  );
  assert.equal(
    view.find((node) => node.type === "Confirmation"),
    null,
  );
  assert.equal(
    view.find((node) => node.props?.id === "settlement-reason").props.value,
    "Reviewed externally",
  );
  assert.equal(
    view.find((node) => node.props?.id === "settlement-reference").props.value,
    "EXTERNAL-123",
  );
});

test("uncertain writes block resubmission until a successful fresh read and retain drafts", async () => {
  const view = actionHarness();
  view.input("settlement-reference", "EXTERNAL-123");
  view.input("settlement-reason", "Reviewed externally");
  view.input("settlement-password", "synthetic");
  view
    .find((node) => node.type === "form")
    .props.onSubmit({ preventDefault() {} });
  view.render();
  view.find((node) => node.type === "Confirmation").props.confirm();
  view.render();
  assert.equal(
    view.find((node) => node.props?.id === "settlement-password").props.value,
    "",
  );
  view.respond({ status: 503, code: "UNAVAILABLE" });
  await Promise.resolve();
  view.render();
  assert.ok(view.find((node) => node.props?.["data-finance-reload"]));
  assert.equal(
    view.find((node) => node.props?.id === "settlement-reason").props.value,
    "Reviewed externally",
  );
  view.props.refreshing = true;
  view.props.readToken = undefined;
  view.render();
  view.props.refreshing = false;
  view.render();
  assert.ok(view.find((node) => node.props?.["data-finance-reload"]));
  view.props.readToken = {};
  view.render();
  assert.equal(
    view.find((node) => node.props?.["data-finance-reload"]),
    null,
  );
});

test("refresh drops selected records missing from the current ledger and keeps current revisions", () => {
  const { refreshSelectedSettlements } = compile(
    "../src/components/workspace/admin-finance-state.ts",
  );
  const selected = [row(), row({ id: other })];
  const updated = row({ revision: "b".repeat(64), canReconcile: false });
  assert.deepEqual(refreshSelectedSettlements(selected, [updated]), [updated]);
});

test("filtered ledger reads retain rows with redacted deleted veterinarians", async (t) => {
  fixture(t, { data: { items: [row({ vet: null })], nextCursor: null } });
  const result = await handleWorkspace(
    request(`admin/settlements?vetId=${other}`),
    ["admin", "settlements"],
  );
  assert.equal(result.status, 200);
  assert.equal((await result.json()).data.items[0].vet, null);
});

test("reconciliation may retain an existing batch when omitted but must acknowledge a supplied batch", async (t) => {
  for (const [input, data, expected] of [
    [single, paidDetail({ payoutBatchId: "EXISTING-PROCESSING-BATCH" }), 200],
    [
      { ...single, payoutBatchId: "SUPPLIED" },
      paidDetail({ payoutBatchId: "OTHER" }),
      502,
    ],
    [
      { ...single, payoutBatchId: "SUPPLIED" },
      paidDetail({ payoutBatchId: "SUPPLIED" }),
      200,
    ],
  ]) {
    fixture(t, { data });
    const result = await handleWorkspace(
      request(`admin/settlements/${id}/reconcile`, "POST", input),
      ["admin", "settlements", id, "reconcile"],
    );
    assert.equal(result.status, expected);
  }
});

test("finance response correlation treats UUID case canonically", async (t) => {
  for (const [path, data] of [
    [`admin/settlements/${id.toUpperCase()}`, detail()],
    [
      `admin/settlements?vetId=${other.toUpperCase()}`,
      { items: [row()], nextCursor: null },
    ],
  ]) {
    fixture(t, { data });
    const result = await handleWorkspace(
      request(path),
      path.split("?")[0].split("/"),
    );
    assert.equal(result.status, 200);
  }
});

test("finance writes bind the displayed actor to current identity before mutation", async (t) => {
  for (const [actor, expected] of [
    [`${id}:ADMIN:0`, 200],
    [`${other}:ADMIN:0`, 403],
    [`${id}:ADMIN:1`, 403],
    [`${id}:SUPER_ADMIN:0`, 403],
  ]) {
    const calls = fixture(t, { data: paidDetail() });
    const result = await handleWorkspace(
      request(`admin/settlements/${id}/reconcile`, "POST", single, {
        "X-Workspace-Actor": actor,
      }),
      ["admin", "settlements", id, "reconcile"],
    );
    assert.equal(result.status, expected);
    assert.equal(calls.length, expected === 200 ? 2 : 1);
    if (expected !== 200)
      assert.deepEqual(await result.json(), { code: "AUTHORIZATION_CHANGED" });
  }
});

test("a queued finance write carries its original actor and cannot mutate after the account changes", async (t) => {
  let runQueued,
    currentId = id;
  const original = globalThis.fetch,
    calls = [];
  t.after(() => {
    globalThis.fetch = original;
  });
  globalThis.fetch = async (url, init) => {
    if (String(url).startsWith("/api/workspace/")) {
      calls.push({ url, init });
      return handleWorkspace(
        request(
          String(url).slice("/api/workspace/".length),
          "POST",
          JSON.parse(init.body),
          init.headers,
        ),
        ["admin", "settlements", id, "reconcile"],
      );
    }
    if (new URL(url).pathname.endsWith("/auth/me"))
      return Response.json({
        success: true,
        data: { ...identity, id: currentId },
      });
    calls.push({ url, init });
    return Response.json({ success: true, data: paidDetail() });
  };
  const client = compile("../src/lib/workspace/client.ts", {
    "../auth/client": {
      withSessionLock: (run) =>
        new Promise((resolve) => {
          runQueued = () => run().then(resolve);
        }),
      authRequest: () => {
        throw Error("No refresh expected");
      },
    },
    "./contracts": compile("../src/lib/workspace/contracts.ts"),
  });
  const schema = resolveEndpoint(["admin", "settlements", id], "GET").response;
  const result = client.workspaceRequest(
    `admin/settlements/${id}/reconcile`,
    schema,
    "POST",
    single,
    `${id}:ADMIN:0`,
  );
  assert.equal(calls.length, 0);
  currentId = other;
  await runQueued();
  const response = await result;
  assert.equal(calls[0].init.headers["X-Workspace-Actor"], `${id}:ADMIN:0`);
  assert.equal(response.code, "AUTHORIZATION_CHANGED");
  assert.equal(
    calls.length,
    1,
    "Only the BFF request occurs; no mutation is forwarded",
  );
});
