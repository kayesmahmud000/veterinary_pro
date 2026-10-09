import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
function compile(file, overrides = {}) {
  const url = new URL(file, import.meta.url);
  if (!existsSync(url)) return {};
  const { outputText } = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const mod = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name) => overrides[name] ?? require(name),
    mod,
    mod.exports,
  );
  return mod.exports;
}
const nav = compile("../src/lib/workspace/navigation.ts", {
  "../i18n/workspace-shell": compile("../src/lib/i18n/workspace-shell.ts"),
});
const diagnostics = compile("../src/lib/api-diagnostics.ts");
const session = compile("../src/lib/auth/route-session.ts", {
  "../api-diagnostics": diagnostics,
});
const { middleware } = compile("../src/middleware.ts", {
  "@/lib/auth/route-session": session,
  "@/lib/workspace/navigation": nav,
  "@/lib/public-content": { findBlogPost: (id) => id === "known" },
  "@/lib/doctor-data": { doctorProfiles: [] },
  "@/lib/doctor-directory": { findDoctor: (_, id) => id === "known" },
});
const { NextRequest } = require("next/server");
const user = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Synthetic User",
  email: "synthetic@example.test",
  role: "LEARNER",
  status: "ACTIVE",
  isEmailVerified: false,
  maskedPhone: null,
  avatarUrl: null,
  createdAt: "2026-10-09T00:00:00Z",
};
const request = (path, cookie = "") =>
  new NextRequest("http://localhost:3410" + path, { headers: { cookie } });
test("missing cookies redirect every workspace boundary before page delivery without API calls", async (t) => {
  const original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  globalThis.fetch = async () => {
    throw new Error("Missing-cookie requests must not reach upstream");
  };
  for (const path of [
    "/dashboard",
    "/farm",
    "/account/profile?section=access",
    "/admin/role-requests",
    "/app/farms/660e8400-e29b-41d4-a716-446655440001",
  ]) {
    const response = await middleware(request(path));
    assert.equal(response.status, 307);
    const url = new URL(response.headers.get("location"));
    assert.equal(url.pathname, "/");
    assert.equal(url.searchParams.get("auth"), "required");
    assert.equal(url.searchParams.get("returnTo"), path);
    assert.match(response.headers.get("cache-control"), /no-store/);
    assert.equal(response.headers.get("x-middleware-next"), null);
  }
});
test("only current validated backend identity permits workspace delivery; never rotates in middleware", async (t) => {
  assert.equal(typeof session.checkProtectedAccess, "function");
  const original = globalThis.fetch,
    previous = process.env.API_BASE_URL,
    debug = process.env.API_DEBUG;
  process.env.API_BASE_URL = "http://api.example.test/api/v1";
  process.env.API_DEBUG = "0";
  t.after(() => {
    globalThis.fetch = original;
    if (previous === undefined) delete process.env.API_BASE_URL;
    else process.env.API_BASE_URL = previous;
    if (debug === undefined) delete process.env.API_DEBUG;
    else process.env.API_DEBUG = debug;
  });
  for (const [status, data, success, allowed] of [
    [200, user, true, true],
    [401, null, false, false],
    [403, null, false, false],
    [503, null, false, false],
    [200, { ...user, status: "SUSPENDED" }, true, false],
    [200, { ...user, role: "UNKNOWN" }, true, false],
    [200, null, true, false],
    [200, user, false, false],
  ]) {
    let count = 0;
    globalThis.fetch = async (url, init) => {
      count++;
      assert.equal(url.toString(), "http://api.example.test/api/v1/auth/me");
      assert.equal(init.method, "GET");
      assert.equal(init.cache, "no-store");
      assert.equal(init.redirect, "error");
      assert.equal(init.headers.Authorization, "Bearer synthetic-access");
      assert.ok(init.signal);
      return Response.json({ success, data }, { status });
    };
    const response = await middleware(
      request(
        "/account/profile",
        "vetralink_access=synthetic-access; vetralink_refresh=synthetic-refresh",
      ),
    );
    assert.equal(response.headers.get("x-middleware-next") === "1", allowed);
    assert.equal(count, 1);
  }
  globalThis.fetch = async () => {
    throw new TypeError("Synthetic network failure");
  };
  assert.equal(await session.checkProtectedAccess("synthetic-access"), false);
});
test("refresh-only entry uses public handoff; public/API and existing public 404s stay intact", async () => {
  assert.equal(
    (
      await middleware(
        request("/dashboard", "vetralink_refresh=synthetic-refresh"),
      )
    ).status,
    307,
  );
  for (const path of [
    "/",
    "/learning",
    "/farm-management",
    "/accounting",
    "/api/auth/session",
    "/api/workspace/farms",
    "/blog/known",
    "/doctors/known",
  ])
    assert.equal(
      (await middleware(request(path))).headers.get("x-middleware-next"),
      "1",
      path,
    );
  assert.equal((await middleware(request("/blog/missing"))).status, 404);
  assert.equal((await middleware(request("/doctors/missing"))).status, 404);
});
test("malformed bodies, invalid API configuration and timed-out checks fail closed", async (t) => {
  const originalFetch = globalThis.fetch,
    originalTimer = globalThis.setTimeout,
    previous = process.env.API_BASE_URL,
    previousDebug = process.env.API_DEBUG;
  process.env.API_DEBUG = "0";
  t.after(() => {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalTimer;
    if (previous === undefined) delete process.env.API_BASE_URL;
    else process.env.API_BASE_URL = previous;
    if (previousDebug === undefined) delete process.env.API_DEBUG;
    else process.env.API_DEBUG = previousDebug;
  });
  let calls = 0;
  globalThis.fetch = async () => {
    calls++;
    return new Response("invalid JSON");
  };
  process.env.API_BASE_URL = "http://api.example.test/api/v1";
  assert.equal(await session.checkProtectedAccess("synthetic-access"), false);
  assert.equal(calls, 1);
  for (const base of [
    "file:///api/v1",
    "http://synthetic:secret@api.example.test/api/v1",
    "http://api.example.test/api/v1?query=value",
    "http://api.example.test/api/v1#fragment",
    "invalid URL",
  ]) {
    process.env.API_BASE_URL = base;
    assert.equal(await session.checkProtectedAccess("synthetic-access"), false);
  }
  assert.equal(await session.checkProtectedAccess("a".repeat(3801)), false);
  assert.equal(
    calls,
    1,
    "Unsafe config and oversized cookies never reach fetch",
  );
  process.env.API_BASE_URL = "http://api.example.test/api/v1";
  let delay;
  globalThis.setTimeout = (callback, milliseconds) => {
    delay = milliseconds;
    return originalTimer(callback, 0);
  };
  globalThis.fetch = async (_, init) =>
    new Promise((_, reject) =>
      init.signal.addEventListener(
        "abort",
        () => reject(new DOMException("Synthetic timeout", "AbortError")),
        { once: true },
      ),
    );
  assert.equal(await session.checkProtectedAccess("synthetic-access"), false);
  assert.equal(delay, 12000, "Verification has a bounded timeout");
});
test("entry URLs validate return destinations and reject duplicate/unsafe public query inputs", () => {
  assert.equal(typeof nav.protectedEntryUrl, "function");
  const url = new URL(
    nav.protectedEntryUrl("https://evil.test"),
    "https://local.test",
  );
  assert.equal(url.searchParams.get("returnTo"), "/dashboard");
  assert.equal(
    nav.readProtectedReturnTo("required", "/account/profile?section=access"),
    "/account/profile?section=access",
  );
  for (const bad of [
    "//evil.test",
    "https://evil.test",
    "/api/auth/session",
    ["/dashboard", "/account/profile"],
    "/account/profile?returnTo=https://evil.test",
  ])
    assert.equal(nav.readProtectedReturnTo("required", bad), null);
  assert.equal(
    nav.readProtectedReturnTo(["required", "required"], "/dashboard"),
    null,
  );
  assert.equal(nav.readProtectedReturnTo("login", "/dashboard"), null);
});
