import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
const file = new URL("../src/lib/api-diagnostics.ts", import.meta.url);
const mod = { exports: {} };
if (existsSync(file)) {
  const { outputText } = ts.transpileModule(readFileSync(file, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  new Function("require", "module", "exports", outputText)(
    require,
    mod,
    mod.exports,
  );
}
const { fetchWithDiagnostics, withResponseDiagnostics } = mod.exports;
test("API diagnostics preserve responses/errors and exclude bodies, query secrets and credentials", async (t) => {
  assert.equal(typeof fetchWithDiagnostics, "function");
  const originalFetch = globalThis.fetch,
    originalDebug = process.env.API_DEBUG;
  const originalMode = process.env.NODE_ENV;
  const logs = [];
  const methods = ["info", "warn", "error"];
  const originals = methods.map((method) => console[method]);
  methods.forEach((method) => {
    console[method] = (...args) => logs.push({ method, args });
  });
  process.env.API_DEBUG = "1";
  t.after(() => {
    globalThis.fetch = originalFetch;
    methods.forEach((method, i) => {
      console[method] = originals[i];
    });
    if (originalDebug === undefined) delete process.env.API_DEBUG;
    else process.env.API_DEBUG = originalDebug;
    if (originalMode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalMode;
  });
  const secret = "NEVER_LOG_PRIVATE_DATA";
  const url = new URL(
    `https://user:${secret}@api.example.test/api/v1/farms/550e8400-e29b-41d4-a716-446655440000?search=${secret}`,
  );
  for (const status of [200, 401, 500]) {
    const body = {
      data: { password: secret, accessToken: secret, email: secret },
      message: secret,
    };
    const response = Response.json(body, { status });
    globalThis.fetch = async (input, init) => {
      assert.equal(input, url);
      assert.equal(init.headers.Authorization, secret);
      return response;
    };
    const result = await fetchWithDiagnostics(url, {
      method: "POST",
      headers: { Authorization: secret },
      body: secret,
    });
    assert.equal(result, response);
    assert.deepEqual(await result.json(), body);
    const record = logs.at(-1);
    assert.equal(
      record.method,
      status >= 500 ? "error" : status >= 400 ? "warn" : "info",
    );
    assert.equal(record.args[1].status, status);
    assert.match(record.args[1].endpoint, /farms\/:id$/);
  }
  const failure = Object.assign(new TypeError(secret), {
    cause: { code: "ECONNREFUSED", message: secret },
  });
  globalThis.fetch = async () => {
    throw failure;
  };
  await assert.rejects(fetchWithDiagnostics(url), (error) => error === failure);
  assert.equal(logs.at(-1).args[1].errorCode, "ECONNREFUSED");
  const response = Response.json(
    { code: "FORBIDDEN", data: secret },
    { status: 403 },
  );
  assert.equal(
    await withResponseDiagnostics(
      new Request(`http://localhost/api/workspace/farms?secret=${secret}`),
      async () => response,
    ),
    response,
  );
  assert.equal(logs.at(-1).args[1].status, 403);
  await assert.rejects(
    withResponseDiagnostics(
      new Request("http://localhost/api/auth/login"),
      async () => {
        throw failure;
      },
    ),
    (error) => error === failure,
  );
  assert.equal(logs.at(-1).args[1].status, 500);
  await withResponseDiagnostics(
    new Request(`http://localhost/api/v1/media/drm/key/${secret}`),
    async () => response,
  );
  assert.ok(!JSON.stringify(logs).includes(secret));
  assert.ok(
    !JSON.stringify(logs).includes("550e8400-e29b-41d4-a716-446655440000"),
  );
  const count = logs.length;
  process.env.API_DEBUG = "0";
  globalThis.fetch = async () => Response.json({});
  await fetchWithDiagnostics(url);
  assert.equal(logs.length, count);
  process.env.NODE_ENV = "production";
  delete process.env.API_DEBUG;
  await fetchWithDiagnostics(url);
  assert.equal(
    logs.length,
    count,
    "Production logging requires explicit opt-in",
  );
});
