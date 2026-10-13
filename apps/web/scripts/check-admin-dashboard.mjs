import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url),
  { NextRequest } = require("next/server");
function compile(file, overrides = {}) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name) => overrides[name] ?? require(name),
    module,
    module.exports,
  );
  return module.exports;
}
const farmContracts = compile("../src/lib/workspace/farm-contracts.ts");
const contracts = compile("../src/lib/workspace/contracts.ts"),
  { handleWorkspace, resolveEndpoint } = compile(
    "../src/lib/workspace/server.ts",
    {
      "./contracts": contracts,
      "./farm-contracts": farmContracts,
      "../api-diagnostics": compile("../src/lib/api-diagnostics.ts"),
    },
  );

const user = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  name: "Synthetic Admin",
  email: "admin@example.test",
  role: "ADMIN",
  status: "ACTIVE",
  isEmailVerified: true,
  maskedPhone: null,
  avatarUrl: null,
  createdAt: "2026-10-13T00:00:00Z",
  roleVersion: 1,
};
const counts = {
  asOfDate: "2026-10-13T00:00:00.000Z",
  totalSubscriptionsCount: 20,
  activeSubscriptionsCount: 12,
  activePayingSubscriptionsCount: 10,
  trialingSubscriptionsCount: 3,
  pastDueSubscriptionsCount: 2,
  canceledSubscriptionsCount: 2,
  expiredSubscriptionsCount: 1,
};
const request = (path = "admin/overview", headers = {}) =>
  new NextRequest(`http://localhost:3100/api/workspace/${path}`, {
    headers: { Cookie: "vetralink_access=synthetic-token", ...headers },
  });
const ok = (data) => Response.json({ success: true, data });
function fixture(t, identity = user, data = counts) {
  const original = globalThis.fetch,
    debug = process.env.API_DEBUG;
  process.env.API_DEBUG = "0";
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ path: new URL(url).pathname, init });
    return new URL(url).pathname.endsWith("/auth/me") ? ok(identity) : ok(data);
  };
  t.after(() => {
    globalThis.fetch = original;
    if (debug === undefined) delete process.env.API_DEBUG;
    else process.env.API_DEBUG = debug;
  });
  return calls;
}
test("overview forwards cookie credentials only and projects real counts without money or private data", async (t) => {
  const calls = fixture(t, user, {
    ...counts,
    mrrCents: 990000,
    currency: "USD",
    providerSecret: "private",
  });
  const response = await handleWorkspace(
    request(undefined, {
      Authorization: "Bearer forged",
      "x-farm-id": user.id,
    }),
    ["admin", "overview"],
  );
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { data: counts });
  assert.match(response.headers.get("cache-control"), /private, no-store/);
  assert.deepEqual(
    calls.map((c) => c.path),
    ["/api/v1/auth/me", "/api/v1/subscriptions/metrics/summary"],
  );
  for (const { init } of calls) {
    assert.equal(init.headers.Authorization, "Bearer synthetic-token");
    assert.equal(init.headers["x-farm-id"], undefined);
    assert.equal(init.redirect, "error");
  }
});
test("every admin mapping denies wrong or inactive identity before reading privileged data", async (t) => {
  for (const role of ["LEARNER", "FARMER", "BUYER", "VET"]) {
    await t.test(role, async (t) => {
      const calls = fixture(t, { ...user, role });
      for (const path of [
        ["admin", "overview"],
        ["admin", "role-requests"],
        ["admin", "users"],
      ]) {
        const res = await handleWorkspace(
          request(path.join("/"), { "x-user-role": "SUPER_ADMIN" }),
          path,
        );
        assert.equal(res.status, 403);
      }
      assert.ok(calls.every((c) => c.path.endsWith("/auth/me")));
    });
  }
  await t.test("inactive admin", async (t) => {
    const calls = fixture(t, { ...user, status: "SUSPENDED" });
    assert.equal(
      (await handleWorkspace(request(), ["admin", "overview"])).status,
      403,
    );
    assert.equal(calls.length, 1);
  });
});
test("administrative user tools remain Super-only while both admin roles can read overview", async (t) => {
  for (const role of ["ADMIN", "SUPER_ADMIN"]) {
    await t.test(role, async (t) => {
      fixture(t, { ...user, role });
      assert.equal(
        (await handleWorkspace(request(), ["admin", "overview"])).status,
        200,
      );
    });
  }
  await t.test("admin cannot invoke Super-only lookup", async (t) => {
    const calls = fixture(t);
    const response = await handleWorkspace(
      request("admin/users/lookup?email=target%40example.test"),
      ["admin", "users", "lookup"],
    );
    assert.equal(response.status, 403);
    assert.equal(calls.length, 1);
  });
});
test("overview rejects malformed counts, preserves valid zero and strips unsupported queries", async (t) => {
  for (const bad of [
    null,
    { ...counts, asOfDate: "yesterday" },
    { ...counts, asOfDate: "2026-10-13T00:00:00+99:99" },
    { ...counts, totalSubscriptionsCount: -1 },
    { ...counts, activeSubscriptionsCount: 0.5 },
    { ...counts, trialingSubscriptionsCount: Number.MAX_SAFE_INTEGER + 1 },
    { ...counts, expiredSubscriptionsCount: undefined },
  ]) {
    await t.test(JSON.stringify(bad), async (t) => {
      fixture(t, user, bad);
      assert.equal(
        (await handleWorkspace(request(), ["admin", "overview"])).status,
        502,
      );
    });
  }
  await t.test("zero", async (t) => {
    const zero = Object.fromEntries(
      Object.entries(counts).map(([k, v]) => [k, k === "asOfDate" ? v : 0]),
    );
    fixture(t, user, zero);
    const response = await handleWorkspace(request(), ["admin", "overview"]);
    assert.equal(response.status, 200);
    assert.deepEqual((await response.json()).data, zero);
  });
  await t.test("strict route and query", async (t) => {
    const calls = fixture(t);
    for (const query of [
      "?farmId=" + user.id,
      "?asOfDate=2026-10-13",
      "?limit=1&limit=2",
    ])
      assert.equal(
        (
          await handleWorkspace(request("admin/overview" + query), [
            "admin",
            "overview",
          ])
        ).status,
        422,
      );
    for (const method of ["POST", "PATCH", "DELETE"])
      assert.equal(resolveEndpoint(["admin", "overview"], method), null);
    assert.equal(resolveEndpoint(["admin", "overview", "extra"], "GET"), null);
    assert.equal(calls.length, 0);
  });
});
test("identity failures fail closed and upstream metric failures retain useful status", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  for (const status of [401, 403, 503]) {
    let calls = 0;
    globalThis.fetch = async () => {
      calls++;
      return Response.json({ success: false }, { status });
    };
    assert.equal(
      (await handleWorkspace(request(), ["admin", "overview"])).status,
      status,
    );
    assert.equal(calls, 1);
    globalThis.fetch = async (url) =>
      new URL(url).pathname.endsWith("/auth/me")
        ? ok(user)
        : Response.json({ success: false }, { status });
    assert.equal(
      (await handleWorkspace(request(), ["admin", "overview"])).status,
      status,
    );
  }
  globalThis.fetch = async () => ok({ ...user, role: "UNKNOWN" });
  assert.equal(
    (await handleWorkspace(request(), ["admin", "overview"])).status,
    502,
  );
  assert.equal(
    (
      await handleWorkspace(request(undefined, { Cookie: "" }), [
        "admin",
        "overview",
      ])
    ).status,
    401,
  );
});
