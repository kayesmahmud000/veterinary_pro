import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import ts from "typescript";
const require = createRequire(import.meta.url),
  cache = new Map();
function load(file) {
  file = path.resolve(file);
  if (!existsSync(file)) return {};
  if (cache.has(file)) return cache.get(file);
  const module = { exports: {} };
  cache.set(file, module.exports);
  const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  new Function("require", "module", "exports", outputText)(
    (name) =>
      name.startsWith(".")
        ? load(path.resolve(path.dirname(file), name + ".ts"))
        : require(name),
    module,
    module.exports,
  );
  return module.exports;
}
const root = new URL("../src/lib/workspace/", import.meta.url).pathname;
const c = load(root + "farm-contracts.ts"),
  data = load(root + "farm-data.ts"),
  { handleWorkspace, resolveEndpoint } = load(root + "server.ts");
const { NextRequest } = require("next/server");
const farmId = "660e8400-e29b-41d4-a716-446655440001",
  otherId = "660e8400-e29b-41d4-a716-446655440002";
const farm = {
  id: farmId,
  name: "Synthetic farm",
  farmType: "DAIRY",
  country: "Bangladesh",
  address: null,
  role: "HERDSMAN",
  ownerId: otherId,
};
const animal = {
  id: otherId,
  farmId,
  tagNumber: "TEST-1",
  rfidNumber: null,
  name: null,
  species: "COW",
  breed: null,
  gender: "FEMALE",
  dateOfBirth: null,
  ageMonths: null,
  weightKg: null,
  status: "ACTIVE",
  sireId: null,
  damId: null,
  metadata: {},
  syncVersion: 1,
  createdAt: "2026-10-08T00:00:00Z",
  updatedAt: "2026-10-08T00:00:00Z",
};
const animals = {
  items: [animal],
  meta: { page: 1, pageSize: 1, total: 120, totalPages: 120 },
};
const request = (route, headers = {}) =>
  new NextRequest("http://localhost:3410/api/workspace/" + route, {
    headers: { cookie: "vetralink_access=test-cookie", ...headers },
  });
const ok = (data) => Response.json({ success: true, data });
test("overview GET routes are fixed, UUID scoped and reject wrong methods", () => {
  for (const [suffix, upstream] of [
    ["animals", "animals"],
    ["milk/analytics", "milk-logs/analytics"],
    ["vaccinations/schedule", "clinical-health/vaccinations/schedule"],
    ["finance/summary", "financial/profit-loss/summary"],
    ["access-status", `subscriptions/farm/${farmId}/access-status`],
    ["quota", `subscriptions/farm/${farmId}/quota`],
  ]) {
    const endpoint = resolveEndpoint(
      ["farms", farmId, ...suffix.split("/")],
      "GET",
    );
    assert.ok(endpoint, suffix);
    assert.equal(endpoint.upstream, upstream);
    assert.equal(endpoint.farmId, farmId);
    assert.equal(
      resolveEndpoint(["farms", "invalid", ...suffix.split("/")], "GET"),
      null,
    );
    assert.equal(
      resolveEndpoint(["farms", farmId, ...suffix.split("/")], "DELETE"),
      null,
    );
  }
});
test("animal totals use unfiltered pagination metadata and milk emptiness preserves real zero", () => {
  assert.equal(data.projectAnimalCount(animals), 120);
  assert.equal(
    data.projectMilkYield({ summary: { totalRecords: 0, totalYieldLiters: 0 } })
      .state,
    "empty",
  );
  assert.deepEqual(
    data.projectMilkYield({
      summary: { totalRecords: 1, totalYieldLiters: 0 },
    }),
    { state: "ready", data: 0 },
  );
  assert.throws(() =>
    data.projectAnimalCount({
      ...animals,
      meta: { ...animals.meta, total: -1 },
    }),
  );
});
test("query dates and pagination reject malformed inputs and extra tenant fields", () => {
  assert.equal(
    c.animalQuerySchema.safeParse({ page: "2", limit: "20", search: "TEST" })
      .success,
    true,
  );
  for (const q of [
    { page: 0 },
    { limit: 101 },
    { farmId: otherId },
    { species: "DOG" },
  ])
    assert.equal(c.animalQuerySchema.safeParse(q).success, false);
  assert.equal(
    c.milkQuerySchema.safeParse({
      startDate: "2026-10-01",
      endDate: "2026-10-08",
      entryType: "ALL",
    }).success,
    true,
  );
  for (const q of [
    { startDate: "2026-02-30", endDate: "2026-03-01" },
    { startDate: "2026-10-09", endDate: "2026-10-08" },
  ])
    assert.equal(c.milkQuerySchema.safeParse(q).success, false);
  const period = data.getReportingPeriod(new Date("2026-10-08T20:00:00Z"));
  assert.equal(period.localDate, "2026-10-09");
  assert.equal(period.reportDate, "2026-10-08");
  assert.equal(period.monthStart, "2026-10-01");
});
test("BFF forwards cookie authorization and route farm, rejects duplicate/unknown query", async () => {
  const old = globalThis.fetch;
  let called = 0;
  try {
    globalThis.fetch = async (url, init) => {
      called++;
      assert.equal(init.headers.Authorization, "Bearer test-cookie");
      assert.equal(init.headers["x-farm-id"], farmId);
      assert.equal(new URL(url).pathname, "/api/v1/animals");
      return ok(animals);
    };
    const response = await handleWorkspace(
      request(`farms/${farmId}/animals?page=1&limit=1`, {
        Authorization: "Bearer attacker",
        "x-farm-id": otherId,
      }),
      ["farms", farmId, "animals"],
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.meta.total, 120);
    assert.match(response.headers.get("cache-control"), /private, no-store/);
    for (const query of ["limit=101", "farmId=" + otherId, "page=1&page=2"])
      assert.equal(
        (
          await handleWorkspace(request(`farms/${farmId}/animals?${query}`), [
            "farms",
            farmId,
            "animals",
          ])
        ).status,
        422,
      );
    assert.equal(called, 1);
  } finally {
    globalThis.fetch = old;
  }
});
test("subscription reads require positive membership before contacting unguarded upstream", async () => {
  const old = globalThis.fetch,
    calls = [];
  try {
    globalThis.fetch = async (url) => {
      calls.push(new URL(url).pathname);
      return ok({ required: false, farms: [] });
    };
    assert.equal(
      (
        await handleWorkspace(request(`farms/${farmId}/quota`), [
          "farms",
          farmId,
          "quota",
        ])
      ).status,
      403,
    );
    assert.deepEqual(calls, ["/api/v1/farms/my"]);
  } finally {
    globalThis.fetch = old;
  }
});
test("malformed and cross-farm response is an error and never a zero value", async () => {
  const old = globalThis.fetch;
  try {
    for (const payload of [
      { ...animals, meta: {} },
      { ...animals, items: [{ ...animal, farmId: otherId }] },
    ]) {
      globalThis.fetch = async () => ok(payload);
      const response = await handleWorkspace(
        request(`farms/${farmId}/animals`),
        ["farms", farmId, "animals"],
      );
      assert.equal(response.status, 502);
      assert.equal((await response.json()).code, "INVALID_RESPONSE");
    }
    globalThis.fetch = async () =>
      Response.json(
        {
          success: false,
          errorDetails: { title: "PRIVATE_ERROR", detail: "Private notes" },
        },
        { status: 403 },
      );
    const response = await handleWorkspace(request(`farms/${farmId}/animals`), [
      "farms",
      farmId,
      "animals",
    ]);
    assert.deepEqual(await response.json(), { code: "FORBIDDEN" });
  } finally {
    globalThis.fetch = old;
  }
});
test("independent reads start concurrently while refresh remains serialized", async () => {
  const { workspaceRequest } = load(root + "client.ts"),
    old = globalThis.fetch;
  let started = 0;
  const releases = [];
  try {
    globalThis.fetch = () =>
      new Promise((resolve) => {
        started++;
        releases.push(() => resolve(Response.json({ data: { value: 1 } })));
      });
    const schema = require("zod").z.object({
      value: require("zod").z.number(),
    });
    const pending = [
      workspaceRequest("first", schema),
      workspaceRequest("second", schema),
    ];
    await new Promise((r) => setTimeout(r, 40));
    const concurrent = started;
    releases.forEach((release) => release());
    // Let a previously serialized second request finish as well.
    await new Promise((r) => setTimeout(r, 40));
    releases.forEach((release) => release());
    await Promise.all(pending);
    assert.equal(concurrent, 2);
  } finally {
    releases.forEach((release) => release());
    globalThis.fetch = old;
  }
});
test("401 read refreshes through the shared lock and retries the scoped read", async () => {
  const { workspaceRequest } = load(root + "client.ts"),
    old = globalThis.fetch,
    calls = [];
  let reads = 0;
  const user = {
    id: farmId,
    email: "test@example.test",
    name: "Test",
    role: "FARMER",
    status: "ACTIVE",
    isEmailVerified: false,
    maskedPhone: null,
    avatarUrl: null,
    createdAt: "2026-10-08T00:00:00Z",
  };
  try {
    globalThis.fetch = async (url) => {
      calls.push(url);
      if (url === "/api/auth/session")
        return Response.json(
          { user: null, code: "session_expired" },
          { status: 401 },
        );
      if (url === "/api/auth/refresh") return Response.json({ user });
      if (++reads === 1)
        return Response.json({ code: "UNAUTHORIZED" }, { status: 401 });
      return Response.json({ data: animals });
    };
    const result = await workspaceRequest(
      `farms/${farmId}/animals`,
      c.animalListSchema,
    );
    assert.equal(result.status, 200);
    assert.equal(result.data.meta.total, 120);
    assert.deepEqual(calls, [
      `/api/workspace/farms/${farmId}/animals`,
      "/api/auth/session",
      "/api/auth/refresh",
      `/api/workspace/farms/${farmId}/animals`,
    ]);
  } finally {
    globalThis.fetch = old;
  }
});
test("registry forms enforce API fields, date/weight bounds and reject tenant injection", () => {
  const valid = {
    tagNumber: " TEST-2 ",
    species: "COW",
    gender: "FEMALE",
    weightKg: 250.5,
  };
  assert.equal(c.registerAnimalSchema.safeParse(valid).success, true);
  for (const bad of [
    { ...valid, tagNumber: " " },
    { ...valid, weightKg: 0 },
    { ...valid, weightKg: 1.234 },
    { ...valid, dateOfBirth: "2999-01-01" },
    { ...valid, dateOfBirth: "2026-02-30" },
    { ...valid, farmId: otherId },
    { ...valid, metadata: { ownerId: otherId } },
  ])
    assert.equal(c.registerAnimalSchema.safeParse(bad).success, false);
  assert.equal(c.updateAnimalSchema.safeParse({ name: null }).success, true);
  assert.equal(c.updateAnimalSchema.safeParse({}).success, false);
});
test("registry POST/PATCH map only selected farm and UUID animal, response id must match", async () => {
  const create = resolveEndpoint(["farms", farmId, "animals"], "POST"),
    update = resolveEndpoint(["farms", farmId, "animals", otherId], "PATCH");
  assert.ok(create);
  assert.ok(update);
  assert.equal(update.upstream, `animals/${otherId}`);
  assert.equal(
    resolveEndpoint(["farms", farmId, "animals", "new"], "PATCH"),
    null,
  );
  const old = globalThis.fetch;
  try {
    globalThis.fetch = async (url, init) => {
      if (new URL(url).pathname.endsWith("/farms/my"))
        return ok({ required: false, farms: [farm] });
      if (new URL(url).pathname.endsWith("/access-status"))
        return ok({
          subscriptionId: "",
          farmId,
          status: "ACTIVE",
          accessMode: "FULL_ACCESS",
          canRead: true,
          canWrite: true,
          daysPastDue: 0,
          gracePeriodDaysRemaining: 0,
          gracePeriodEnd: null,
          suspensionDate: null,
        });
      assert.equal(init.headers["x-farm-id"], farmId);
      assert.equal(init.method, "PATCH");
      return ok({ ...animal, id: farmId });
    };
    const req = new NextRequest(
      `http://localhost:3410/api/workspace/farms/${farmId}/animals/${otherId}`,
      {
        method: "PATCH",
        headers: {
          cookie: "vetralink_access=test-cookie",
          origin: "http://localhost:3410",
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Edited" }),
      },
    );
    assert.equal(
      (await handleWorkspace(req, ["farms", farmId, "animals", otherId]))
        .status,
      502,
    );
  } finally {
    globalThis.fetch = old;
  }
});
test("native All-filter GET form accepts blank enum query values", () => {
  assert.equal(
    c.animalQuerySchema.safeParse({ search: "", species: "", status: "" })
      .success,
    true,
  );
});
test("registry mutation refuses read-only access before sending a write upstream", async () => {
  const old = globalThis.fetch,
    calls = [];
  try {
    globalThis.fetch = async (url, init) => {
      const route = new URL(url).pathname;
      calls.push({ route, method: init.method ?? "GET" });
      if (route.endsWith("/farms/my"))
        return ok({ required: false, farms: [farm] });
      if (route.endsWith("/access-status"))
        return ok({
          subscriptionId: "",
          farmId,
          status: "ACTIVE",
          accessMode: "READ_ONLY",
          canRead: true,
          canWrite: false,
          daysPastDue: 0,
          gracePeriodDaysRemaining: 0,
          gracePeriodEnd: null,
          suspensionDate: null,
        });
      return ok(animal);
    };
    const req = new NextRequest(
      `http://localhost:3410/api/workspace/farms/${farmId}/animals`,
      {
        method: "POST",
        headers: {
          cookie: "vetralink_access=test-cookie",
          origin: "http://localhost:3410",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          tagNumber: "NEW",
          species: "COW",
          gender: "FEMALE",
        }),
      },
    );
    assert.equal(
      (await handleWorkspace(req, ["farms", farmId, "animals"])).status,
      403,
    );
    assert.equal(
      calls.some((call) => call.method === "POST"),
      false,
    );
  } finally {
    globalThis.fetch = old;
  }
});
test("farm GET allowlist excludes inherited object keys", () => {
  for (const key of ["constructor", "toString", "__proto__"])
    assert.equal(resolveEndpoint(["farms", farmId, key], "GET"), null);
});
test("editing sends changed fields only and explicit clearing cannot overwrite other snapshots", () => {
  const initial = {
    tagNumber: "TEST-1",
    name: "Old",
    rfidNumber: "",
    species: "COW",
    breed: "",
    gender: "FEMALE",
    dateOfBirth: "",
    weightKg: "250",
    status: "ACTIVE",
  };
  assert.deepEqual(
    data.buildAnimalWritePayload({ ...initial, name: "New" }, initial),
    { name: "New" },
  );
  assert.deepEqual(
    data.buildAnimalWritePayload({ ...initial, weightKg: "" }, initial),
    { weightKg: null },
  );
  assert.deepEqual(data.buildAnimalWritePayload(initial, initial), {});
  assert.deepEqual(
    data.buildAnimalWritePayload({ ...initial, name: " Old " }, initial),
    {},
  );
});
