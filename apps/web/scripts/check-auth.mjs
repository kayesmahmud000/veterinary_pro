import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { NextRequest } = require("next/server");
function compile(path, overrides = {}) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
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
const contracts = compile("../src/lib/auth/contracts.ts");
const { handleAuth } = compile("../src/lib/auth/server.ts", {
  "./contracts": contracts,
});
const user = {
  id: "550e8400-e29b-41d4-a716-446655440000",
  email: "farmer@example.test",
  name: "Test Farmer",
  role: "FARMER",
  status: "ACTIVE",
  isEmailVerified: false,
  maskedPhone: null,
  avatarUrl: null,
  createdAt: "2026-10-07T00:00:00Z",
};
const tokens = {
  accessToken: "synthetic-access",
  refreshToken: "synthetic-refresh",
  tokenType: "Bearer",
  expiresIn: 900,
};
const input = {
  email: "farmer@example.test",
  name: "Test Farmer",
  password: "pass word!",
  role: "FARMER",
};
const ok = (data, status = 200) =>
  Response.json({ success: true, data }, { status });
const fail = (status, message = "failure") =>
  Response.json({ success: false, data: null, message }, { status });
function request(action, body = {}, options = {}) {
  const method = action === "session" ? "GET" : "POST";
  return new NextRequest(`http://localhost:3100/api/auth/${action}`, {
    method,
    headers: {
      ...(method === "POST"
        ? {
            origin: "http://localhost:3100",
            "content-type": "application/json",
          }
        : {}),
      ...options.headers,
    },
    ...(method === "POST" ? { body: options.raw ?? JSON.stringify(body) } : {}),
  });
}
const cookie = `vetralink_access=${tokens.accessToken}; vetralink_refresh=${tokens.refreshToken}`;

test("uses exact payloads, signup bounds and four public roles and default Learner; preserves login password", () => {
  for (const role of contracts.PUBLIC_ROLES) {
    const result = contracts.validateCredentials("register", {
      ...input,
      email: " FARMER@example.test ",
      name: " Test Farmer ",
      role,
      phone: " ",
      confirmation: "not-upstream",
      arbitrary: true,
    });
    assert.deepEqual(result.payload, role === "LEARNER" ? { email: input.email, name: input.name, password: input.password } : { ...input, role });
  }
  assert.equal(
    contracts.validateCredentials("register", { ...input, role: "ADMIN" })
      .fields.role,
    "role",
  );
  assert.equal(
    contracts.validateCredentials("register", { ...input, role: "SUPER_ADMIN" })
      .payload,
    undefined,
  );
  assert.equal(
    contracts.validateCredentials("register", { ...input, name: " " }).fields
      .name,
    "name",
  );
  for (const password of ["a".repeat(7), "a".repeat(129)])
    assert.equal(
      contracts.validateCredentials("register", { ...input, password }).fields
        .password,
      "password",
    );
  for (const password of ["a".repeat(8), "a".repeat(128)])
    assert.ok(
      contracts.validateCredentials("register", { ...input, password }).payload,
    );
  assert.deepEqual(
    contracts.validateCredentials("login", {
      email: input.email,
      password: " x ",
      rememberMe: true,
    }).payload,
    { email: input.email, password: " x " },
  );
  assert.equal(
    contracts.validateCredentials("login", {
      phone: "+8801700000000",
      password: "valid",
    }).payload,
    undefined,
  );
});

test("auth boundary protects origins, HttpOnly cookies, errors and rotation lifecycle", async (t) => {
  const originalFetch = globalThis.fetch;
  const previousBase = process.env.API_BASE_URL;
  process.env.API_BASE_URL = "http://upstream.invalid/api/v1";
  t.after(() => {
    globalThis.fetch = originalFetch;
    if (previousBase === undefined) delete process.env.API_BASE_URL;
    else process.env.API_BASE_URL = previousBase;
  });
  let calls = [];
  const mock = (handler) => {
    calls = [];
    globalThis.fetch = async (url, options) => {
      calls.push({ url: String(url), ...options });
      return handler(calls.at(-1));
    };
  };

  await t.test(
    "rejects cross-origin, non-JSON, invalid body and privileged role before upstream",
    async () => {
      mock(() => {
        throw new Error("must not call upstream");
      });
      assert.equal(
        (
          await handleAuth(
            request("register", input, {
              headers: { origin: "https://evil.invalid" },
            }),
            "register",
          )
        ).status,
        403,
      );
      assert.equal(
        (
          await handleAuth(
            request("login", input, {
              headers: { "content-type": "text/plain" },
            }),
            "login",
          )
        ).status,
        403,
      );
      assert.equal(
        (await handleAuth(request("register", input, { raw: "{" }), "register"))
          .status,
        400,
      );
      assert.equal(
        (
          await handleAuth(
            request("register", { ...input, role: "ADMIN" }),
            "register",
          )
        ).status,
        400,
      );
      assert.equal(
        (await handleAuth(request("session"), "arbitrary")).status,
        404,
      );
      assert.equal(calls.length, 0);
    },
  );

  await t.test(
    "register/login return sanitized identity and protected browser-session cookies",
    async () => {
      mock(() =>
        ok(
          {
            user: {
              ...user,
              phone: "secret-phone",
              passwordHash: "secret-hash",
              tokens,
            },
            tokens,
          },
          201,
        ),
      );
      const result = await handleAuth(
        request("register", { ...input, confirmation: input.password }),
        "register",
      );
      assert.equal(result.status, 201);
      assert.deepEqual(await result.json(), { user });
      assert.deepEqual(JSON.parse(calls[0].body), input);
      assert.equal(
        calls[0].url,
        "http://upstream.invalid/api/v1/auth/register",
      );
      assert.equal(calls[0].cache, "no-store");
      assert.equal(result.headers.get("cache-control"), "private, no-store");
      for (const value of result.cookies.getAll()) {
        assert.equal(value.httpOnly, true);
        assert.equal(value.sameSite, "lax");
        assert.equal(value.path, "/");
        assert.equal(value.maxAge, undefined);
      }
      const secure = process.env.NODE_ENV === "production";
      assert.equal(result.cookies.get("vetralink_access").secure, secure);
    },
  );

  await t.test(
    "maps wrong credentials, suspension, duplicate fields and malformed upstream safely",
    async () => {
      for (const [status, action, message, code] of [
        [401, "login", "private details", "invalid_credentials"],
        [403, "login", "private details", "suspended"],
        [409, "register", "Email already exists", "conflict_email"],
        [409, "register", "Phone already exists", "conflict_phone"],
        [429, "login", "private details", "rate_limited"],
      ]) {
        mock(() => fail(status, message));
        const response = await handleAuth(request(action, input), action);
        assert.equal(response.status, status);
        assert.deepEqual(await response.json(), { user: null, code });
        assert.equal(response.cookies.getAll().length, 0);
      }
      mock(() => Response.json({ diagnostic: "internal stack" }));
      assert.equal(
        (await handleAuth(request("login", input), "login")).status,
        502,
      );
    },
  );

  await t.test(
    "session verifies bearer via me, refresh rotates and session-expired clears cookies",
    async () => {
      mock(() => ok(user));
      assert.deepEqual(
        await (
          await handleAuth(
            request("session", {}, { headers: { cookie } }),
            "session",
          )
        ).json(),
        { user },
      );
      assert.equal(
        calls[0].headers.Authorization,
        `Bearer ${tokens.accessToken}`,
      );
      const nextTokens = {
        ...tokens,
        accessToken: "rotated-access",
        refreshToken: "rotated-refresh",
      };
      mock((call) =>
        ok(call.url.endsWith("refresh") ? { tokens: nextTokens } : user),
      );
      const refreshed = await handleAuth(
        request("refresh", {}, { headers: { cookie } }),
        "refresh",
      );
      assert.deepEqual(await refreshed.json(), { user });
      assert.equal(
        refreshed.cookies.get("vetralink_refresh").value,
        nextTokens.refreshToken,
      );
      assert.deepEqual(JSON.parse(calls[0].body), {
        refreshToken: tokens.refreshToken,
      });
      mock(() => fail(401));
      const expired = await handleAuth(
        request("refresh", {}, { headers: { cookie } }),
        "refresh",
      );
      assert.equal(expired.status, 401);
      assert.equal(expired.cookies.get("vetralink_refresh").maxAge, 0);
    },
  );

  await t.test(
    "retains newly rotated tokens when profile retrieval fails transiently",
    async () => {
      const nextTokens = { ...tokens, refreshToken: "rotated-refresh" };
      mock((call) =>
        call.url.endsWith("refresh") ? ok({ tokens: nextTokens }) : fail(503),
      );
      const response = await handleAuth(
        request("refresh", {}, { headers: { cookie } }),
        "refresh",
      );
      assert.equal(response.status, 503);
      assert.equal(
        response.cookies.get("vetralink_refresh").value,
        nextTokens.refreshToken,
      );
    },
  );

  await t.test(
    "logout revokes upstream before clearing; failure preserves session for retry",
    async () => {
      mock(() => fail(503));
      const failed = await handleAuth(
        request("logout", {}, { headers: { cookie } }),
        "logout",
      );
      assert.equal(failed.status, 503);
      assert.equal(failed.cookies.getAll().length, 0);
      mock(() => ok(null));
      const loggedOut = await handleAuth(
        request("logout", {}, { headers: { cookie } }),
        "logout",
      );
      assert.equal(loggedOut.status, 200);
      assert.equal(loggedOut.cookies.get("vetralink_access").maxAge, 0);
      assert.deepEqual(JSON.parse(calls[0].body), {
        refreshToken: tokens.refreshToken,
      });
    },
  );
});
