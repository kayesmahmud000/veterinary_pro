import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
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
    (name) => overrides[name] ?? require(name),
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
const id = "d7000000-0000-4000-8000-000000000101",
  other = "d7000000-0000-4000-8000-000000000102",
  date = "2026-10-19T00:00:00Z";
const identity = {
  id,
  name: "Synthetic operator",
  email: "operator@example.test",
  role: "ADMIN",
  roleVersion: 0,
  status: "ACTIVE",
  avatarUrl: null,
  maskedPhone: null,
  isEmailVerified: false,
  createdAt: date,
};
const draft = {
  bn: {
    title: "পরীক্ষা",
    summary: "পরীক্ষার সারাংশ",
    body: "<script>alert('unsafe')</script>\nPlain text",
  },
  en: {
    title: "Synthetic text",
    summary: "Synthetic summary",
    body: "<img src=x onerror=alert(1)>",
  },
};
const content = {
  id,
  kind: "BLOG",
  slug: "synthetic-blog",
  title: { bn: draft.bn.title, en: draft.en.title },
  draft,
  published: null,
  subjectUserId: null,
  version: 1,
  publishedAt: null,
  updatedAt: date,
  revisions: [],
  revisionsTruncated: false,
};
const ticket = {
  id,
  subject: "Synthetic support question",
  category: "ACCOUNT",
  status: "OPEN",
  version: 1,
  requester: { id, name: "Synthetic requester" },
  assignee: null,
  farmId: null,
  orderId: null,
  createdAt: date,
  updatedAt: date,
  messages: [],
  messagesTruncated: false,
};
const confirmation = {
  actorPassword: "synthetic",
  reason: "Reviewed synthetic action",
  confirmed: true,
};
function request(path, body, headers = {}) {
  return new NextRequest(`http://localhost:3100/api/workspace/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      cookie: "vetralink_access=synthetic",
      origin: "http://localhost:3100",
      "content-type": "application/json",
      "X-Workspace-Actor": `${id}:ADMIN:0`,
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
function fixture(t, response, role = "ADMIN") {
  const original = globalThis.fetch,
    calls = [];
  t.after(() => {
    globalThis.fetch = original;
  });
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    const data = String(url).endsWith("auth/me")
      ? { ...identity, role }
      : response;
    return Response.json({ success: true, data });
  };
  return calls;
}
process.env.API_DEBUG = "0";
test("ADM7 BFF exposes exact paths, methods and bounded strict contracts", () => {
  for (const [p, m] of [
    ["admin/content", "GET"],
    ["admin/content", "POST"],
    [`admin/content/${id}/save`, "POST"],
    [`admin/content/${id}/actions`, "POST"],
    ["admin/notifications", "GET"],
    [`admin/notifications/${id}/retry`, "POST"],
    ["admin/support", "GET"],
    [`admin/support/${id}/actions`, "POST"],
    ["support/tickets", "POST"],
    [`support/tickets/${id}/messages`, "POST"],
  ])
    assert.ok(server.resolveEndpoint(p.split("/"), m), `${m} ${p}`);
  for (const [p, m] of [
    ["admin/content/arbitrary", "GET"],
    [`admin/content/${id}`, "DELETE"],
    ["admin/notifications/send", "POST"],
    ["admin/support", "POST"],
    [`support/tickets/${id}/actions`, "POST"],
  ])
    assert.equal(server.resolveEndpoint(p.split("/"), m), null);
  assert.equal(
    shared.editorialQuerySchema.safeParse({ limit: 21 }).success,
    false,
  );
  assert.equal(
    shared.supportActionSchema.safeParse({
      ...confirmation,
      expectedVersion: 1,
      action: "STATUS",
      status: "CLOSED",
      internal: true,
    }).success,
    false,
  );
});
test("all ordinary roles are denied before administrative discovery", async (t) => {
  for (const role of ["LEARNER", "FARMER", "BUYER", "VET"]) {
    const calls = fixture(t, { items: [], nextCursor: null }, role);
    const r = await server.handleWorkspace(request("admin/content"), [
      "admin",
      "content",
    ]);
    assert.equal(r.status, 403);
    assert.equal(calls.length, 1);
  }
});
test("publication rejects missing confirmation, cross-site input and changed/missing actors before mutation", async (t) => {
  const calls = fixture(t, { ...content, version: 2 });
  for (const [b, h, status] of [
    [
      {
        ...confirmation,
        expectedVersion: 1,
        action: "PUBLISH",
        confirmed: false,
      },
      {},
      422,
    ],
    [
      { ...confirmation, expectedVersion: 1, action: "PUBLISH" },
      { origin: "https://evil.example.test" },
      403,
    ],
    [
      { ...confirmation, expectedVersion: 1, action: "PUBLISH" },
      { "X-Workspace-Actor": "different" },
      403,
    ],
  ]) {
    const r = await server.handleWorkspace(
      request(`admin/content/${id}/actions`, b, h),
      ["admin", "content", id, "actions"],
    );
    assert.equal(r.status, status);
  }
  assert.equal(calls.filter((c) => !c.url.endsWith("auth/me")).length, 0);
  const noActor = request(`admin/content/${id}/actions`, {
    ...confirmation,
    expectedVersion: 1,
    action: "PUBLISH",
  });
  noActor.headers.delete("X-Workspace-Actor");
  assert.equal(
    (await server.handleWorkspace(noActor, ["admin", "content", id, "actions"]))
      .status,
    403,
  );
});
test("mutation acknowledgment must correlate ID and next version", async (t) => {
  fixture(t, { ...content, id: other, version: 2 });
  assert.equal(
    (
      await server.handleWorkspace(
        request(`admin/content/${id}/save`, { expectedVersion: 1, draft }),
        ["admin", "content", id, "save"],
      )
    ).status,
    502,
  );
  fixture(t, content);
  assert.equal(
    (
      await server.handleWorkspace(
        request(`admin/content/${id}/save`, { expectedVersion: 1, draft }),
        ["admin", "content", id, "save"],
      )
    ).status,
    502,
  );
  fixture(t, { ...content, version: 2, privateSecret: "must be stripped" });
  const r = await server.handleWorkspace(
    request(`admin/content/${id}/save`, { expectedVersion: 1, draft }),
    ["admin", "content", id, "save"],
  );
  assert.equal(r.status, 200);
  assert.ok(!(await r.text()).includes("privateSecret"));
});
test("own support response rejects foreign identities and internal messages", async (t) => {
  fixture(t, {
    ...ticket,
    requester: { id: other, name: "Foreign requester" },
  });
  assert.equal(
    (
      await server.handleWorkspace(request(`support/tickets/${id}`), [
        "support",
        "tickets",
        id,
      ])
    ).status,
    502,
  );
  fixture(t, {
    ...ticket,
    messages: [
      {
        id: other,
        author: { id, name: "Admin" },
        internal: true,
        body: "PRIVATE",
        createdAt: date,
      },
    ],
  });
  assert.equal(
    (
      await server.handleWorkspace(request(`support/tickets/${id}`), [
        "support",
        "tickets",
        id,
      ])
    ).status,
    502,
  );
  fixture(t, ticket, "LEARNER");
  assert.equal(
    (
      await server.handleWorkspace(
        request(`support/tickets/${id}`, undefined, {
          "X-Workspace-Actor": `${id}:LEARNER:0`,
        }),
        ["support", "tickets", id],
      )
    ).status,
    200,
  );
});
test("notification response strips provider details and requires supported retry acknowledgment", async (t) => {
  const notification = {
    id,
    source: "ROLE_EMAIL",
    status: "FAILED",
    recipient: null,
    channel: "EMAIL",
    category: "ROLE_REQUEST_APPROVED",
    attempts: 5,
    createdAt: date,
    acceptedAt: null,
    generation: 0,
    canRetry: true,
  };
  fixture(t, {
    items: [
      {
        ...notification,
        body: "PRIVATE-MESSAGE",
        providerMessageId: "PRIVATE-PROVIDER",
      },
    ],
    nextCursor: null,
  });
  const r = await server.handleWorkspace(request("admin/notifications"), [
    "admin",
    "notifications",
  ]);
  assert.equal(r.status, 200);
  assert.doesNotMatch(await r.text(), /PRIVATE/);
  fixture(t, { ...notification, generation: 1, status: "ACCEPTED" });
  assert.equal(
    (
      await server.handleWorkspace(
        request(`admin/notifications/${id}/retry`, {
          ...confirmation,
          expectedGeneration: 0,
        }),
        ["admin", "notifications", id, "retry"],
      )
    ).status,
    502,
  );
});
test("unknown/duplicate queries and oversized content fail before forwarding", async (t) => {
  const calls = fixture(t, content);
  assert.equal(
    (
      await server.handleWorkspace(
        request("admin/content?kind=BLOG&kind=PAGE"),
        ["admin", "content"],
      )
    ).status,
    422,
  );
  assert.equal(
    (
      await server.handleWorkspace(
        request("admin/support?includeClinical=true"),
        ["admin", "support"],
      )
    ).status,
    422,
  );
  const r = await server.handleWorkspace(
    request(
      `admin/content/${id}/save`,
      { expectedVersion: 1, draft },
      { "content-length": "262145" },
    ),
    ["admin", "content", id, "save"],
  );
  assert.equal(r.status, 413);
  assert.equal(calls.length, 0);
});
test("public editorial reads distinguish unpublished, unavailable and malformed/wrong content", async (t) => {
  const publicApi = compile("../src/lib/editorial.ts"),
    original = globalThis.fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  globalThis.fetch = async () => new Response(null, { status: 404 });
  assert.equal(
    (await publicApi.publishedEntry("BLOG", "synthetic-blog")).status,
    404,
  );
  globalThis.fetch = async () => new Response(null, { status: 503 });
  assert.equal(
    (await publicApi.publishedEntry("BLOG", "synthetic-blog")).status,
    503,
  );
  globalThis.fetch = async () =>
    Response.json({
      success: true,
      data: {
        id,
        kind: "PAGE",
        slug: "synthetic-blog",
        content: draft,
        publishedAt: date,
        verified: false,
      },
    });
  assert.equal(
    (await publicApi.publishedEntry("BLOG", "synthetic-blog")).status,
    503,
  );
  assert.equal(
    (await publicApi.publishedEntry("BLOG", "../../private")).status,
    404,
  );
});
test("shared draft/public renderer escapes active content in both locales", () => {
  const { EditorialText } = compile(
      "../src/components/marketing/editorial-text.tsx",
    ),
    React = require("react"),
    { renderToStaticMarkup } = require("react-dom/server");
  for (const locale of ["bn", "en"]) {
    const html = renderToStaticMarkup(
      React.createElement(EditorialText, { content: draft, locale }),
    );
    assert.doesNotMatch(html, /<script|<img|<iframe|dangerouslySetInnerHTML/);
    assert.match(html, /&lt;/);
  }
});
