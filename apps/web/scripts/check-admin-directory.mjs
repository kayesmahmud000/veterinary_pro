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

const id = "550e8400-e29b-41d4-a716-446655440001";
const row = {
  id,
  name: "Synthetic",
  email: "test@example.test",
  role: "LEARNER",
  status: "ACTIVE",
  authorizationVersion: 2,
  createdAt: "2026-10-14T00:00:00Z",
};
const identity = {
  ...row,
  role: "ADMIN",
  roleVersion: 0,
  isEmailVerified: false,
  avatarUrl: null,
  maskedPhone: null,
};
function fixture(t, role = "ADMIN", data = { items: [row], nextCursor: null }) {
  const original = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: new URL(url), init });
    return Response.json({
      success: true,
      data: new URL(url).pathname.endsWith("/auth/me")
        ? { ...identity, role }
        : data,
    });
  };
  t.after(() => {
    globalThis.fetch = original;
  });
  return calls;
}
function request(path, method = "GET", body) {
  return new NextRequest(`http://localhost:3100/api/workspace/${path}`, {
    method,
    headers: {
      Cookie: "vetralink_access=synthetic",
      Origin: "http://localhost:3100",
      "Content-Type": "application/json",
      "x-farm-id": id,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
for (const role of ["ADMIN", "SUPER_ADMIN"])
  test(`${role} can read general directory without widening privileged access`, async (t) => {
    const calls = fixture(t, role, {
      items: [{ ...row, passwordHash: "secret", phone: "secret" }],
      nextCursor: null,
    });
    const res = await handleWorkspace(
      request("admin/directory/users?search=Test&limit=20"),
      ["admin", "directory", "users"],
    );
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), {
      data: { items: [row], nextCursor: null },
    });
    assert.equal(calls[1].url.pathname, "/api/v1/admin/directory/users");
    assert.equal(calls[1].url.searchParams.get("search"), "Test");
    assert.equal(calls[1].init.headers["x-farm-id"], undefined);
    if (role === "ADMIN")
      assert.equal(
        (await handleWorkspace(request("admin/users"), ["admin", "users"]))
          .status,
        403,
      );
  });
for (const role of ["LEARNER", "FARMER", "BUYER", "VET"])
  test(`${role} denied before directory upstream`, async (t) => {
    const calls = fixture(t, role);
    const res = await handleWorkspace(request("admin/directory/users"), [
      "admin",
      "directory",
      "users",
    ]);
    assert.equal(res.status, 403);
    assert.equal(calls.length, 1);
  });
test("strict filters and bounded actions reject invalid/duplicate input", async (t) => {
  fixture(t);
  for (const query of [
    "limit=101",
    "limit=20&limit=30",
    "phone=secret",
    "cursor=bad",
  ])
    assert.equal(
      (
        await handleWorkspace(request(`admin/directory/users?${query}`), [
          "admin",
          "directory",
          "users",
        ])
      ).status,
      422,
    );
  assert.equal(
    (
      await handleWorkspace(
        request(`admin/directory/users/${id}/actions`, "POST", {
          action: "SUSPEND",
          reason: "short",
        }),
        ["admin", "directory", "users", id, "actions"],
      )
    ).status,
    422,
  );
  assert.equal(
    resolveEndpoint(["admin", "directory", "audit", id], "DELETE"),
    null,
  );
});
test("action preserves versions and safe conflict code", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  let payload;
  globalThis.fetch = async (url, init) => {
    if (new URL(url).pathname.endsWith("auth/me"))
      return Response.json({ success: true, data: identity });
    payload = JSON.parse(init.body);
    return Response.json(
      { errorDetails: { title: "ACCOUNT_VERSION_CONFLICT" } },
      { status: 409 },
    );
  };
  const input = {
    action: "SUSPEND",
    reason: "Support investigation",
    expectedAuthorizationVersion: 2,
    actorPassword: "password",
  };
  const res = await handleWorkspace(
    request(`admin/directory/users/${id}/actions`, "POST", input),
    ["admin", "directory", "users", id, "actions"],
  );
  assert.equal(res.status, 409);
  assert.deepEqual(await res.json(), { code: "ACCOUNT_VERSION_CONFLICT" });
  assert.deepEqual(payload, input);
});
test("audit schema strips legacy secrets and invalid dates fail closed", async (t) => {
  const audit = {
    id,
    actorId: id,
    action: "USER_SUSPENDED",
    entityType: "User",
    entityId: id,
    traceId: id,
    createdAt: "2026-10-14T00:00:00Z",
    oldValues: { status: "ACTIVE", email: "secret" },
    newValues: { status: "SUSPENDED", password: "secret" },
  };
  fixture(t, "ADMIN", audit);
  const res = await handleWorkspace(request(`admin/directory/audit/${id}`), [
    "admin",
    "directory",
    "audit",
    id,
  ]);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.deepEqual(body.data.oldValues, { status: "ACTIVE" });
  assert.deepEqual(body.data.newValues, { status: "SUSPENDED" });
  assert.equal(
    (
      await handleWorkspace(request("admin/directory/audit?from=bad"), [
        "admin",
        "directory",
        "audit",
      ])
    ).status,
    422,
  );
});
test("detail and action responses must refer to the requested account", async (t) => {
  fixture(t, "ADMIN", {
    ...row,
    id: "550e8400-e29b-41d4-a716-446655440002",
    farms: [],
    farmCount: 0,
    applications: [],
    applicationCount: 0,
    orderCount: 0,
  });
  assert.equal(
    (
      await handleWorkspace(request(`admin/directory/users/${id}`), [
        "admin",
        "directory",
        "users",
        id,
      ])
    ).status,
    502,
  );
});
test("veterinarian directory rejects non-VET upstream identities", async (t) => {
  fixture(t, "ADMIN", { items: [row], nextCursor: null });
  assert.equal(
    (
      await handleWorkspace(request("admin/directory/veterinarians"), [
        "admin",
        "directory",
        "veterinarians",
      ])
    ).status,
    502,
  );
});
