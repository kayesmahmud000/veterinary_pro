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
const row = {
  id,
  status: "SUBMITTED",
  type: "ASYNC_TICKET",
  chiefComplaint: "Synthetic request",
  farmer: { id, name: "Farmer" },
  vet: null,
  farm: null,
  animal: null,
  feeCents: 1200,
  currency: "BDT",
  paymentStatus: "UNPAID",
  scheduledAt: null,
  assignedAt: null,
  createdAt: date,
  updatedAt: date,
};
const detail = {
  ...row,
  revision: "a".repeat(64),
  allowedActions: ["ASSIGN", "AUTO_ASSIGN", "CANCEL"],
  history: [],
  historyTruncated: false,
  notifications: [],
  notificationsTruncated: false,
};
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
const input = {
  action: "ASSIGN",
  vetId: other,
  expectedRevision: detail.revision,
  reason: "Operational review",
  actorPassword: "synthetic",
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
    data = { items: [row], nextCursor: null },
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
            ? { errorDetails: { title: code }, email: "secret" }
            : { success: true, data },
          { status },
        );
  };
  t.after(() => {
    globalThis.fetch = original;
  });
  return calls;
}
test("fixed administrative consultation methods and UUID routes exist", () => {
  for (const path of [
    ["admin", "consultations"],
    ["admin", "consultations", id],
    ["admin", "consultations", id, "candidates"],
  ])
    assert.ok(resolveEndpoint(path, "GET"), `missing GET ${path.join("/")}`);
  assert.ok(resolveEndpoint(["admin", "consultations", id, "actions"], "POST"));
  for (const [path, method] of [
    [["admin", "consultations"], "POST"],
    [["admin", "consultations", id], "PATCH"],
    [["admin", "consultations", id, "candidates"], "POST"],
    [["admin", "consultations", "bad"], "GET"],
    [["admin", "consultations", id, "unknown"], "GET"],
  ])
    assert.equal(resolveEndpoint(path, method), null);
});
for (const role of ["ADMIN", "SUPER_ADMIN"])
  test(`${role} reads bounded redacted list`, async (t) => {
    const calls = fixture(t, {
      role,
      data: {
        items: [
          {
            ...row,
            passwordHash: "secret",
            farmer: { ...row.farmer, email: "secret" },
          },
        ],
        nextCursor: null,
      },
    });
    const res = await handleWorkspace(
      request(
        "admin/consultations?status=SUBMITTED&type=ASYNC_TICKET&search=Test&limit=20",
      ),
      ["admin", "consultations"],
    );
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      data: { items: [row], nextCursor: null },
    });
    assert.equal(calls[1].url.pathname, "/api/v1/admin/consultations");
    assert.equal(calls[1].url.searchParams.get("search"), "Test");
  });
for (const role of ["LEARNER", "FARMER", "BUYER", "VET"])
  test(`${role} denied before consultation upstream`, async (t) => {
    const calls = fixture(t, { role });
    assert.equal(
      (
        await handleWorkspace(request("admin/consultations"), [
          "admin",
          "consultations",
        ])
      ).status,
      403,
    );
    assert.equal(calls.length, 1);
  });
test("strict query/body and same-origin bounds reject before upstream", async (t) => {
  const calls = fixture(t);
  for (const query of [
    "limit=101",
    "limit=0",
    "limit=20&limit=30",
    "cursor=bad",
    "status=INVALID",
    "type=INVALID",
    "email=secret",
    "search=" + "a".repeat(101),
  ])
    assert.equal(
      (
        await handleWorkspace(request(`admin/consultations?${query}`), [
          "admin",
          "consultations",
        ])
      ).status,
      422,
    );
  for (const body of [
    { ...input, extra: true },
    { ...input, vetId: "bad" },
    { ...input, expectedRevision: "bad" },
    { ...input, reason: "tiny" },
    { ...input, actorPassword: "" },
    { ...input, actorPassword: "x".repeat(129) },
    { ...input, action: "AUTO_ASSIGN" },
    { ...input, action: "CANCEL" },
  ])
    assert.equal(
      (
        await handleWorkspace(
          request(`admin/consultations/${id}/actions`, "POST", body),
          ["admin", "consultations", id, "actions"],
        )
      ).status,
      422,
    );
  assert.equal(
    (
      await handleWorkspace(
        request(`admin/consultations/${id}/actions`, "POST", input, {
          "content-length": "17000",
        }),
        ["admin", "consultations", id, "actions"],
      )
    ).status,
    413,
  );
  assert.equal(
    (
      await handleWorkspace(
        request(`admin/consultations/${id}/actions`, "POST", input, {
          Origin: "https://foreign.test",
        }),
        ["admin", "consultations", id, "actions"],
      )
    ).status,
    403,
  );
  assert.equal(calls.length, 0);
});
for (const suffix of ["", "/actions"])
  test(`detail ID correlation ${suffix || "read"}`, async (t) => {
    fixture(t, { data: { ...detail, id: other } });
    assert.equal(
      (
        await handleWorkspace(
          request(
            `admin/consultations/${id}${suffix}`,
            suffix ? "POST" : "GET",
            suffix ? input : undefined,
          ),
          ["admin", "consultations", id, ...(suffix ? ["actions"] : [])],
        )
      ).status,
      502,
    );
  });
test("candidate consultationId is correlated and private fields removed", async (t) => {
  const candidate = {
    vetId: other,
    name: "Vet",
    specialties: ["CATTLE"],
    isAvailable: true,
    currentActiveCases: 0,
    maxActiveCases: 5,
    totalScore: 100,
    isEligible: true,
    ineligibilityReason: null,
  };
  fixture(t, {
    data: {
      consultationId: id,
      items: [{ ...candidate, email: "secret", licenseNumber: "secret" }],
      truncated: false,
    },
  });
  const res = await handleWorkspace(
    request(`admin/consultations/${id}/candidates`),
    ["admin", "consultations", id, "candidates"],
  );
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), {
    data: { consultationId: id, items: [candidate], truncated: false },
  });
});
test("mismatched candidate consultationId fails closed", async (t) => {
  fixture(t, { data: { consultationId: other, items: [], truncated: false } });
  assert.equal(
    (
      await handleWorkspace(request(`admin/consultations/${id}/candidates`), [
        "admin",
        "consultations",
        id,
        "candidates",
      ])
    ).status,
    502,
  );
});
test("detail strips audit and notification delivery secrets", async (t) => {
  fixture(t, {
    data: {
      ...detail,
      history: [
        {
          id,
          action: "CONSULTATION_ADMIN_ASSIGNED",
          actor: { id, name: "Operator", email: "secret" },
          reason: "Reviewed request",
          createdAt: date,
          oldValues: { phone: "secret" },
        },
      ],
      notifications: [
        {
          id,
          channel: "IN_APP",
          status: "SENT",
          dispatchedAt: date,
          readAt: null,
          body: "secret",
          recipientAddress: "secret",
          errorMessage: "secret",
        },
      ],
    },
  });
  const res = await handleWorkspace(request(`admin/consultations/${id}`), [
    "admin",
    "consultations",
    id,
  ]);
  assert.equal(res.status, 200);
  assert.equal(JSON.stringify(await res.json()).includes("secret"), false);
});
for (const code of [
  "CONSULTATION_VERSION_CONFLICT",
  "CONSULTATION_ACTION_UNAVAILABLE",
  "PASSWORD_CONFIRMATION_FAILED",
  "RATE_LIMITED",
  "RATE_LIMIT_UNAVAILABLE",
])
  test(`preserves ${code} with strict action forwarding`, async (t) => {
    const status =
      code === "PASSWORD_CONFIRMATION_FAILED"
        ? 403
        : code === "RATE_LIMITED"
          ? 429
          : code === "RATE_LIMIT_UNAVAILABLE"
            ? 503
            : 409;
    const calls = fixture(t, { code, status });
    const res = await handleWorkspace(
      request(`admin/consultations/${id}/actions`, "POST", input),
      ["admin", "consultations", id, "actions"],
    );
    assert.equal(res.status, status);
    assert.deepEqual(await res.json(), { code });
    assert.deepEqual(JSON.parse(calls[1].init.body), input);
  });
const navigation = compile("../src/lib/workspace/navigation.ts", {
  "../i18n/workspace-shell": compile("../src/lib/i18n/workspace-shell.ts"),
});
test("released consultation returns admit bounded list filters and exact details only", () => {
  for (const section of ["triage", "consultations"]) {
    for (const path of [
      `/admin/${section}`,
      `/admin/${section}/${id}`,
      `/admin/${section}?status=ASSIGNED&type=LIVE_VIDEO&search=Test&limit=20&cursor=${id}`,
    ])
      assert.equal(navigation.validateWorkspaceReturnTo(path), path);
    for (const path of [
      `/admin/${section}/bad`,
      `/admin/${section}/${id}?status=ASSIGNED`,
      `/admin/${section}?email=secret`,
      `/admin/${section}?status=bad`,
      `/admin/${section}?limit=101`,
      `/admin/${section}?status=SUBMITTED&status=ASSIGNED`,
    ])
      assert.equal(navigation.validateWorkspaceReturnTo(path), null);
  }
});
test("only both administrative roles receive bilingual triage/history navigation", () => {
  for (const role of [
    "ADMIN",
    "SUPER_ADMIN",
    "FARMER",
    "LEARNER",
    "BUYER",
    "VET",
  ])
    for (const locale of ["bn", "en"]) {
      const items = navigation.getWorkspaceNav(
        { ...identity, role, createdAt: date },
        locale,
      );
      for (const path of ["/admin/triage", "/admin/consultations"])
        assert.equal(
          items.some((x) => x.href === path),
          ["ADMIN", "SUPER_ADMIN"].includes(role),
        );
    }
});
test("administrative workspace renders bounded filters and role gate in both languages", () => {
  const React = require("react"),
    { renderToStaticMarkup } = require("react-dom/server");
  for (const locale of ["bn", "en"]) {
    const copy = compile("../src/lib/i18n/admin-consultations.ts");
    const { AdminConsultations } = compile(
      "../src/components/workspace/admin-consultations.tsx",
      {
        "next/link": {
          default: ({ children, ...props }) =>
            React.createElement("a", props, children),
        },
        "next/navigation": {
          useSearchParams: () => new URLSearchParams(),
          useRouter: () => ({ replace() {} }),
          usePathname: () => "/admin/triage",
        },
        "@/components/auth/auth-provider": {
          useAuth: () => ({ locale, user: identity }),
        },
        "@/lib/i18n/admin-consultations": copy,
        "@/lib/i18n/workspace": {},
        "@/lib/workspace/client": {},
        "./workspace.styles": { default: {} },
        "./workspace-gate": {
          WorkspaceGate: ({ allowedRoles, children }) => {
            assert.deepEqual(allowedRoles, ["ADMIN", "SUPER_ADMIN"]);
            return children;
          },
        },
        "./workspace-ui": {
          useRemote: () => ({
            loading: false,
            data: { items: [], nextCursor: null },
            reload() {},
          }),
          Field: ({ name, label, children }) =>
            React.createElement("label", { htmlFor: name }, label, children),
        },
      },
    );
    const markup = renderToStaticMarkup(
      React.createElement(AdminConsultations, { section: "triage" }),
    );
    assert.match(markup, /data-consultation-list/);
    assert.match(markup, /id="consultation-search"/);
    assert.match(markup, /maxLength="100"/);
    assert.match(markup, /<option value="SUBMITTED" selected=""/);
    assert.match(markup, /id="consultation-type"/);
    assert.ok(markup.includes(copy.getConsultationMessages(locale).empty));
  }
});
test("all stored operational actions have bilingual display labels", () => {
  const {
    adminConsultationHistoryActions,
  } = require("@vetralink/shared-types");
  const copy = compile("../src/lib/i18n/admin-consultations.ts");
  for (const locale of ["bn", "en"])
    for (const action of adminConsultationHistoryActions) {
      const label = copy.consultationLabel(
        copy.getConsultationMessages(locale),
        action,
      );
      assert.notEqual(label, action, `${locale}: ${action}`);
    }
});
test("consultation detail shows safe history and preserves server action restrictions", () => {
  const React = require("react"),
    { renderToStaticMarkup } = require("react-dom/server");
  for (const allowedActions of [[], ["ASSIGN", "AUTO_ASSIGN"]]) {
    const copy = compile("../src/lib/i18n/admin-consultations.ts");
    const { AdminConsultations } = compile(
      "../src/components/workspace/admin-consultations.tsx",
      {
        "next/link": {
          default: ({ children, ...props }) =>
            React.createElement("a", props, children),
        },
        "next/navigation": {},
        "@/components/auth/auth-provider": {
          useAuth: () => ({ locale: "en", user: identity }),
        },
        "@/lib/i18n/admin-consultations": copy,
        "@/lib/i18n/workspace": {},
        "@/lib/workspace/client": {},
        "./workspace.styles": { default: {} },
        "./workspace-gate": { WorkspaceGate: ({ children }) => children },
        "./workspace-ui": {
          useRemote: (path) => ({
            loading: false,
            data: !path
              ? undefined
              : path.endsWith("/candidates")
                ? {
                    consultationId: id,
                    items: [
                      {
                        vetId: other,
                        name: "Same name",
                        specialties: [],
                        isAvailable: false,
                        currentActiveCases: 0,
                        maxActiveCases: 5,
                        totalScore: 0,
                        isEligible: false,
                        ineligibilityReason: "UNAVAILABLE",
                      },
                    ],
                    truncated: false,
                  }
                : { ...detail, allowedActions },
            reload() {},
          }),
          Field: ({ name, label, children }) =>
            React.createElement("label", { htmlFor: name }, label, children),
        },
      },
    );
    const markup = renderToStaticMarkup(
      React.createElement(AdminConsultations, { section: "consultations", id }),
    );
    assert.match(markup, /data-consultation-detail/);
    assert.match(markup, /Asia\/Dhaka/);
    assert.match(markup, /BDT/);
    assert.match(markup, /Stored notification outcomes/);
    assert.doesNotMatch(markup, /<option value="CANCEL"/);
    if (allowedActions.length) {
      assert.match(markup, /No eligible veterinarian/);
      assert.match(markup, /Same name · 55440002/);
      assert.ok(markup.includes(other));
      assert.match(markup, /maxLength="128"/);
      assert.match(markup, /minLength="5"/);
      assert.match(markup, /disabled=""[^>]*>Review change/);
    } else assert.doesNotMatch(markup, /id="consultation-password"/);
  }
});
test("consultation navigation keeps existing Platform entries contiguous", () => {
  const items = navigation.getWorkspaceNav(identity, "en");
  const platform = items
    .map((item, index) => (item.section === "Platform" ? index : -1))
    .filter((index) => index >= 0);
  // SUPER_ADMIN access is intentionally separate at the bottom, so inspect ADMIN.
  assert.equal(platform.at(-1) - platform[0] + 1, platform.length);
});
