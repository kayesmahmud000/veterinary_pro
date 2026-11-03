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
        target: ts.ScriptTarget.ES2020,
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
const { handleWorkspace, resolveEndpoint } = compile(
  "../src/lib/workspace/server.ts",
  {
    "./contracts": compile("../src/lib/workspace/contracts.ts"),
    "./farm-contracts": compile("../src/lib/workspace/farm-contracts.ts"),
    "../api-diagnostics": compile("../src/lib/api-diagnostics.ts"),
  },
);
const id = "11111111-1111-4111-8111-111111111111",
  userId = "22222222-2222-4222-8222-222222222222",
  date = "2026-11-02T00:00:00Z";
const identity = {
  id,
  name: "Admin",
  email: "admin@example.test",
  role: "ADMIN",
  status: "ACTIVE",
  roleVersion: 0,
  isEmailVerified: false,
  maskedPhone: null,
  avatarUrl: null,
  createdAt: date,
};
const membership = {
  id,
  userId,
  productId: id,
  status: "ACTIVE",
  version: 0,
  source: "ADMIN",
  createdAt: date,
  activatedAt: date,
  revokedAt: null,
  user: {
    id: userId,
    name: "Learner",
    email: "new@example.test",
    role: "LEARNER",
    status: "ACTIVE",
  },
};
const input = {
  name: "Learner",
  email: "new@example.test",
  newUserPassword: "learner-sentinel",
  actorPassword: "actor-sentinel",
  reason: "Requested enrollment",
};
function renderDirectory(locale, unavailable = false) {
  const React = require("react"),
    { renderToStaticMarkup } = require("react-dom/server"),
    course = { id, title: "Synthetic dairy management", isPublished: true },
    { AdminCourseEnrollments } = compile(
      "../src/components/workspace/admin-course-enrollments.tsx",
      {
        "next/link": {
          default: ({ children, ...props }) =>
            React.createElement("a", props, children),
        },
        "@/components/auth/auth-provider": {
          useAuth: () => ({ locale, user: identity }),
        },
        "@/lib/i18n/admin-course-enrollments": compile(
          "../src/lib/i18n/admin-course-enrollments.ts",
        ),
        "@/components/ui/button": {
          Button: ({ children, variant, ...props }) =>
            React.createElement("button", props, children),
          buttonVariants: () => "",
        },
        "./workspace-gate": { WorkspaceGate: ({ children }) => children },
        "./workspace-ui": {
          useRemote: (path) => ({
            loading: false,
            reload() {},
            ...(path?.startsWith("admin/products/")
              ? { data: course }
              : unavailable
                ? { code: "ENROLLMENTS_UNAVAILABLE", status: 503 }
                : {
                    data: {
                      course,
                      items: [membership],
                      activeCount: 1,
                      revokedCount: 0,
                      nextCursor: null,
                    },
                  }),
          }),
          Field: ({ label, children }) =>
            React.createElement("div", null, label, children),
        },
        "./admin-course-dialog": {},
        "./admin-course-enrollment-actions": {},
        "./admin-course-user-create": {},
      },
    );
  return renderToStaticMarkup(
    React.createElement(AdminCourseEnrollments, { courseId: id }),
  );
}
test("course roster identifies the course and separates learner fields into table columns in both languages", () => {
  for (const [locale, expectedHeaders] of [
    [
      "en",
      ["Name", "Email", "Enrollment status", "Enrollment dates", "Actions"],
    ],
    [
      "bn",
      ["নাম", "ইমেইল", "এনরোলমেন্টের অবস্থা", "এনরোলমেন্টের তারিখ", "পদক্ষেপ"],
    ],
  ]) {
    const html = renderDirectory(locale);
    assert.match(html, /<h1[^>]*>Synthetic dairy management<\/h1>/);
    const headers = [...html.matchAll(/<th\s[^>]*>(.*?)<\/th>/g)].map(
      (match) => match[1],
    );
    assert.deepEqual(headers, expectedHeaders);
    assert.match(html, /<td[^>]*>new@example\.test<\/td>/);
    assert.equal([...html.matchAll(/<td\s/g)].length, 5);
    assert.match(html, /data-membership-remove/);
  }
});
test("course title remains available when the enrollment feature is disabled", () => {
  const html = renderDirectory("en", true);
  assert.match(html, /<h1[^>]*>Synthetic dairy management<\/h1>/);
  assert.match(
    html,
    /role="alert"[^>]*>Enrollment management is currently unavailable\./,
  );
  assert.doesNotMatch(html, /data-membership-row/);
});
const path = ["admin", "courses", id, "enrollments", "create-user"];
function req(
  body = input,
  actor = `${id}:ADMIN:0`,
  origin = "http://localhost",
) {
  return new NextRequest("http://localhost/api/workspace/" + path.join("/"), {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: "vetralink_access=admin-cookie",
      "Content-Type": "application/json",
      ...(actor ? { "X-Workspace-Actor": actor } : {}),
    },
    body: JSON.stringify(body),
  });
}
test("maps exact enrollment routes and rejects arbitrary or privileged lookup aliases", () => {
  assert.equal(resolveEndpoint(path, "POST")?.upstream, path.join("/"));
  assert.equal(
    resolveEndpoint(["admin", "directory", "users", userId, "courses"], "GET")
      ?.upstream,
    `admin/directory/users/${userId}/courses`,
  );
  assert.equal(
    resolveEndpoint(["admin", "courses", "invalid", "enrollments"], "GET"),
    null,
  );
  assert.equal(resolveEndpoint(path, "GET"), null);
  assert.ok(
    resolveEndpoint(
      ["admin", "courses", id, "enrollment-candidates"],
      "GET",
    ).query.safeParse({ email: "new@example.test" }).success,
  );
});
test("preserves admin identity/cookies while creating user; strips response credentials", async (t) => {
  const original = globalThis.fetch;
  t.after(() => (globalThis.fetch = original));
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json({
      success: true,
      data: String(url).endsWith("auth/me")
        ? identity
        : {
            accountCreated: true,
            enrollment: membership,
            password: "do-not-expose",
            tokens: { access: "learner-token" },
          },
    });
  };
  const response = await handleWorkspace(req(), path);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("set-cookie"), null);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal(calls.length, 2);
  assert.equal(calls[1].init.headers.Authorization, "Bearer admin-cookie");
  assert.deepEqual(JSON.parse(calls[1].init.body), input);
  assert.doesNotMatch(
    JSON.stringify(await response.json()),
    /sentinel|password|token/i,
  );
});
test("requires actor binding and administrative current identity", async (t) => {
  const original = globalThis.fetch;
  t.after(() => (globalThis.fetch = original));
  let current = identity;
  globalThis.fetch = async () =>
    Response.json({ success: true, data: current });
  assert.equal((await handleWorkspace(req(input, ""), path)).status, 403);
  current = { ...identity, role: "LEARNER" };
  assert.equal((await handleWorkspace(req(), path)).status, 403);
});
test("rejects origin/secret validation and sanitizes unknown upstream failure", async (t) => {
  const original = globalThis.fetch;
  t.after(() => (globalThis.fetch = original));
  assert.equal(
    (await handleWorkspace(req(input, undefined, "http://foreign.test"), path))
      .status,
    403,
  );
  const invalid = await handleWorkspace(
    req({ ...input, role: "SUPER_ADMIN" }),
    path,
  );
  assert.ok([400, 422].includes(invalid.status));
  assert.doesNotMatch(JSON.stringify(await invalid.json()), /sentinel/);
  globalThis.fetch = async (url) =>
    String(url).endsWith("auth/me")
      ? Response.json({ success: true, data: identity })
      : Response.json(
          {
            message: "learner-sentinel",
            errorDetails: { title: "ACCOUNT_EXISTS" },
          },
          { status: 409 },
        );
  const response = await handleWorkspace(req(), path);
  assert.equal(response.status, 409);
  assert.deepEqual(await response.json(), { code: "ACCOUNT_EXISTS" });
});
test("forwards bounded retry timing without forwarding upstream bodies", async (t) => {
  const original = globalThis.fetch;
  t.after(() => (globalThis.fetch = original));
  globalThis.fetch = async (url) =>
    String(url).endsWith("auth/me")
      ? Response.json({ success: true, data: identity })
      : Response.json(
          {
            errorDetails: { title: "RATE_LIMITED" },
            message: "actor-sentinel",
          },
          { status: 429, headers: { "Retry-After": "900" } },
        );
  const response = await handleWorkspace(req(), path);
  assert.equal(response.status, 429);
  assert.equal(response.headers.get("Retry-After"), "900");
  assert.deepEqual(await response.json(), { code: "RATE_LIMITED" });
});
test("rejects a successful mutation response bound to a different course or user", async (t) => {
  const original = globalThis.fetch;
  t.after(() => (globalThis.fetch = original));
  globalThis.fetch = async (url) =>
    String(url).endsWith("auth/me")
      ? Response.json({ success: true, data: identity })
      : Response.json({
          success: true,
          data: {
            accountCreated: true,
            enrollment: { ...membership, productId: userId },
          },
        });
  assert.equal((await handleWorkspace(req(), path)).status, 502);
});
