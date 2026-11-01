import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import {
  platformId as id,
  platformDate,
  platformSettingsFixture as settings,
  platformSystemFixture as system,
  platformReportFixture,
  platformAuditFixture,
} from "./admin-platform-fixtures.mjs";
const require = createRequire(import.meta.url),
  { NextRequest } = require("next/server"),
  shared = require("@vetralink/shared-types");
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
  const mod = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (n) => overrides[n] ?? require(n),
    mod,
    mod.exports,
  );
  return mod.exports;
}
const server = compile("../src/lib/workspace/server.ts", {
  "./contracts": compile("../src/lib/workspace/contracts.ts"),
  "./farm-contracts": compile("../src/lib/workspace/farm-contracts.ts"),
  "../api-diagnostics": compile("../src/lib/api-diagnostics.ts"),
});
const nav = compile("../src/lib/workspace/navigation.ts", {
  "../i18n/workspace-shell": compile("../src/lib/i18n/workspace-shell.ts"),
});
test("report currency preserves exact major units and localized fractional digits", () => {
  const { formatReportAmount } = compile("../src/lib/i18n/report-amount.ts");
  const examples = [
    ["1234567", "12,345.67", "১২,৩৪৫.৬৭"],
    ["1", "0.01", "০.০১"],
    ["0", "0.00", "০.০০"],
    ["10", "0.10", "০.১০"],
    ["100", "1.00", "১.০০"],
    ["000001", "0.01", "০.০১"],
    ["9007199254740993", "90,071,992,547,409.93", "৯,০০,৭১,৯৯,২৫,৪৭,৪০৯.৯৩"],
    [
      "999999999999999999999999999999",
      "9,999,999,999,999,999,999,999,999,999.99",
      "৯,৯৯,৯৯,৯৯,৯৯,৯৯,৯৯,৯৯,৯৯,৯৯,৯৯,৯৯,৯৯,৯৯৯.৯৯",
    ],
  ];
  for (const currency of ["USD", "BDT"])
    for (const [minor, en, bn] of examples) {
      assert.equal(
        formatReportAmount(minor, currency, "en"),
        `${currency} ${en}`,
      );
      assert.equal(
        formatReportAmount(minor, currency, "bn"),
        `${currency} ${bn}`,
      );
    }
});
test("report currency keeps unspecified denominations labelled in raw units and rejects malformed inputs", () => {
  const { formatReportAmount } = compile("../src/lib/i18n/report-amount.ts");
  for (const currency of ["JPY", "KWD", "ZZZ"]) {
    assert.equal(
      formatReportAmount("1234567", currency, "en"),
      `${currency} 1,234,567 (minor units)`,
    );
    assert.equal(
      formatReportAmount("1234567", currency, "bn"),
      `${currency} ১২,৩৪,৫৬৭ (ক্ষুদ্র এককে)`,
    );
  }
  for (const minor of ["", "-1", "1.1", "1e3", " 1", "১", "9".repeat(31)]) {
    assert.throws(() => formatReportAmount(minor, "USD", "en"), RangeError);
  }
  assert.throws(() => formatReportAmount("1", "usd", "en"), RangeError);
});
const query = { from: "2026-10-01", to: "2026-10-02", timezone: "Asia/Dhaka" };
test("report dates distinguish field errors, ordering and the exact 366-day limit", () => {
  const { validateReportRange } = compile(
    "../src/lib/workspace/report-range.ts",
  );
  const now = new Date("2026-10-22T12:00:00Z");
  for (const to of ["2026-10-01", "2026-09-30"]) {
    assert.deepEqual(validateReportRange({ ...query, to }, now), {
      success: false,
      issues: { to: "order" },
    });
  }
  assert.deepEqual(validateReportRange({ ...query, from: "", to: "" }, now), {
    success: false,
    issues: { from: "required", to: "required" },
  });
  assert.deepEqual(validateReportRange({ ...query, from: "2026-02-30" }, now), {
    success: false,
    issues: { from: "calendar" },
  });
  assert.deepEqual(
    validateReportRange(
      {
        ...query,
        from: "1999-12-31",
        to: "not-a-date",
        timezone: "Europe/London",
      },
      now,
    ),
    {
      success: false,
      issues: { from: "calendar", to: "calendar", timezone: "timezone" },
    },
  );
  assert.deepEqual(
    validateReportRange(
      { ...query, from: "2024-01-01", to: "2025-01-02" },
      now,
    ),
    { success: false, issues: { to: "length" } },
  );
  for (const timezone of ["UTC", "Asia/Dhaka"]) {
    const input = { from: "2024-01-01", to: "2025-01-01", timezone };
    assert.deepEqual(validateReportRange(input, now), {
      success: true,
      data: input,
    });
  }
});
test("report dates use tomorrow in the selected timezone across local midnight", () => {
  const { validateReportRange } = compile(
    "../src/lib/workspace/report-range.ts",
  );
  const input = {
    from: "2026-10-22",
    to: "2026-10-24",
    timezone: "Asia/Dhaka",
  };
  assert.deepEqual(
    validateReportRange(input, new Date("2026-10-22T17:59:59Z")),
    { success: false, issues: { to: "future" } },
  );
  assert.deepEqual(
    validateReportRange(input, new Date("2026-10-22T18:00:00Z")),
    { success: true, data: input },
  );
  assert.deepEqual(
    validateReportRange(
      { ...input, timezone: "UTC" },
      new Date("2026-10-22T18:00:00Z"),
    ),
    { success: false, issues: { to: "future" } },
  );
  assert.deepEqual(
    validateReportRange(
      { ...input, timezone: "UTC", to: "2026-10-23" },
      new Date("2026-10-22T18:00:00Z"),
    ).success,
    true,
  );
});
const confirmation = {
  actorPassword: "synthetic",
  reason: "Reviewed synthetic operation",
  confirmed: true,
};
const identity = {
  id,
  name: "Synthetic operator",
  email: "operator@example.test",
  role: "SUPER_ADMIN",
  roleVersion: 0,
  status: "ACTIVE",
  avatarUrl: null,
  maskedPhone: null,
  isEmailVerified: false,
  createdAt: platformDate,
};
function request(path, body, role = "SUPER_ADMIN", headers = {}) {
  return new NextRequest(`http://localhost:3100/api/workspace/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      cookie: "vetralink_access=synthetic",
      origin: "http://localhost:3100",
      "content-type": "application/json",
      "X-Workspace-Actor": `${id}:${role}:0`,
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
function upstream(t, data, role = "SUPER_ADMIN") {
  const original = globalThis.fetch,
    calls = [];
  t.after(() => {
    globalThis.fetch = original;
  });
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({
      success: true,
      data: String(url).endsWith("auth/me") ? { ...identity, role } : data,
    });
  };
  return calls;
}
const handle = (path, body, role, headers) =>
  server.handleWorkspace(
    request(path, body, role, headers),
    path.split("?")[0].split("/"),
  );
test("ADM8 fixed mappings reject arbitrary provider tests and job replay", () => {
  for (const name of ["toString", "constructor", "__proto__"])
    assert.equal(
      server.resolveEndpoint(["admin", "platform", name], "GET"),
      null,
    );
  for (const path of [
    "admin/platform/env",
    "admin/platform/system/retry",
    "admin/platform/integrations/test",
    "admin/platform/reports/export/x",
  ])
    assert.equal(server.resolveEndpoint(path.split("/"), "POST"), null);
  assert.equal(
    server.resolveEndpoint(["admin", "platform", "settings"], "PATCH"),
    null,
  );
});
test("Super-only BFF rejects ADMIN and ordinary roles before configuration/diagnostics upstream", async (t) => {
  for (const role of ["ADMIN", "LEARNER", "FARMER", "BUYER", "VET"]) {
    const calls = upstream(t, settings, role);
    assert.equal(
      (await handle("admin/platform/settings", undefined, role)).status,
      403,
    );
    assert.equal(
      (
        await handle(
          "admin/platform/diagnostics",
          { ...confirmation, requestId: id, action: "RUN_DIAGNOSTICS" },
          role,
        )
      ).status,
      403,
    );
    assert.ok(calls.every((c) => c.url.endsWith("auth/me")));
  }
});
test("both administrative roles receive exact bounded report projections with no-store", async (t) => {
  for (const role of ["ADMIN", "SUPER_ADMIN"]) {
    upstream(t, platformReportFixture(query), role);
    const response = await handle(
      "admin/platform/reports?" + new URLSearchParams(query),
      undefined,
      role,
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "private, no-store");
    assert.equal(
      (await response.json()).data.orders[1].totalMinor,
      "9007199254740993",
    );
  }
});
test("actor-bound writes and same-origin JSON are required", async (t) => {
  const calls = upstream(t, settings);
  const body = { ...confirmation, ...settings, expectedVersion: 1 };
  delete body.version;
  delete body.updatedAt;
  assert.equal(
    (
      await handle("admin/platform/settings", body, "SUPER_ADMIN", {
        "X-Workspace-Actor": "",
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await handle("admin/platform/settings", body, "SUPER_ADMIN", {
        origin: "https://foreign.invalid",
      })
    ).status,
    403,
  );
  assert.ok(calls.every((c) => c.url.endsWith("auth/me")));
});
test("invalid date ranges, duplicate parameters, hidden fields and over-limit exports fail closed", async (t) => {
  const calls = upstream(t, settings);
  for (const path of [
    "admin/platform/reports?" +
      new URLSearchParams({ ...query, from: "2026-02-30" }),
    "admin/platform/reports?" + new URLSearchParams(query) + "&timezone=UTC",
  ])
    assert.equal((await handle(path)).status, 422);
  assert.equal(
    (
      await handle("admin/platform/audit-export", {
        ...confirmation,
        query: { ...query, limit: 501 },
      })
    ).status,
    422,
  );
  assert.equal(
    (
      await handle("admin/platform/diagnostics", {
        ...confirmation,
        requestId: id,
        action: "SEND_EMAIL",
      })
    ).status,
    422,
  );
  assert.equal(calls.length, 0);
});
test("settings acknowledgements require exact values/version and redact raw provider errors", async (t) => {
  const body = {
    ...confirmation,
    organizationBn: settings.organizationBn,
    organizationEn: "Changed",
    supportEmail: settings.supportEmail,
    reportTimezone: "UTC",
    expectedVersion: 1,
  };
  upstream(t, settings);
  assert.equal((await handle("admin/platform/settings", body)).status, 502);
  upstream(t, { ...settings, ...body, version: 2 });
  assert.equal((await handle("admin/platform/settings", body)).status, 502); // Unknown confirmation/password fields are forbidden in responses.
  const { actorPassword, reason, confirmed, expectedVersion, ...safe } = body;
  upstream(t, { ...safe, version: 2, updatedAt: platformDate });
  assert.equal((await handle("admin/platform/settings", body)).status, 200);
  upstream(t, { ...system, redisUrl: "SYNTHETIC_PRIVATE" });
  const bad = await handle("admin/platform/system");
  assert.equal(bad.status, 502);
  assert.ok(!(await bad.text()).includes("SYNTHETIC_PRIVATE"));
});
test("reports and diagnostic acknowledgements cannot cross requested dates or request IDs", async (t) => {
  upstream(t, platformReportFixture({ ...query, timezone: "UTC" }));
  assert.equal(
    (await handle("admin/platform/reports?" + new URLSearchParams(query)))
      .status,
    502,
  );
  upstream(t, {
    requestId: "d8000000-0000-4000-8000-000000000202",
    result: system,
  });
  assert.equal(
    (
      await handle("admin/platform/diagnostics", {
        ...confirmation,
        requestId: id,
        action: "RUN_DIAGNOSTICS",
      })
    ).status,
    502,
  );
  const mismatched = platformReportFixture(query);
  mismatched.range.startInstant = "2026-10-01T00:00:00Z";
  upstream(t, { exportId: id, report: mismatched });
  assert.equal(
    (await handle("admin/platform/reports/export", { ...confirmation, query }))
      .status,
    502,
  );
});
test("audit export binds filters/row bounds and rejects private snapshots and mismatched events", async (t) => {
  const q = { ...query, limit: 2, action: "USER_SUSPENDED" },
    data = platformAuditFixture(q);
  upstream(t, data, "ADMIN");
  assert.equal(
    (
      await handle(
        "admin/platform/audit-export",
        { ...confirmation, query: q },
        "ADMIN",
      )
    ).status,
    200,
  );
  upstream(
    t,
    {
      ...data,
      items: [{ ...data.items[0], newValues: { privateNote: "secret" } }],
    },
    "ADMIN",
  );
  assert.equal(
    (
      await handle(
        "admin/platform/audit-export",
        { ...confirmation, query: q },
        "ADMIN",
      )
    ).status,
    502,
  );
  upstream(
    t,
    {
      ...data,
      items: [{ ...data.items[0], action: "ADMIN_PRIVILEGE_GRANTED" }],
    },
    "ADMIN",
  );
  assert.equal(
    (
      await handle(
        "admin/platform/audit-export",
        { ...confirmation, query: q },
        "ADMIN",
      )
    ).status,
    502,
  );
});
test("middleware/return policy and navigation keep Super controls exclusive", () => {
  for (const path of [
    "/admin/settings",
    "/admin/settings/integrations",
    "/admin/system",
  ]) {
    assert.equal(nav.canAccessAdminPath("ADMIN", path), false);
    assert.equal(nav.canAccessAdminPath("SUPER_ADMIN", path), true);
    assert.equal(nav.validateWorkspaceReturnTo(path), path);
  }
  for (const path of ["/admin/metrics", "/admin/reports"]) {
    assert.equal(nav.canAccessAdminPath("ADMIN", path), true);
    assert.equal(nav.canAccessAdminPath("LEARNER", path), false);
    assert.equal(nav.validateWorkspaceReturnTo(path), path);
  }
  const admin = nav.getWorkspaceNav({ ...identity, role: "ADMIN" }, "bn"),
    superNav = nav.getWorkspaceNav(identity, "en");
  assert.ok(!admin.some((n) => /settings|system/.test(n.href)));
  assert.ok(superNav.some((n) => n.href === "/admin/settings"));
  assert.equal(
    nav.getPostLoginDestination(
      { ...identity, role: "ADMIN" },
      "/admin/settings",
    ),
    "/admin/dashboard",
  );
});
