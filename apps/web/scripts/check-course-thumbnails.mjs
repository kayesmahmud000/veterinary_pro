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
const { handleThumbnailUpload } = compile(
  "../src/lib/workspace/thumbnail-upload-server.ts",
  { "../api-diagnostics": compile("../src/lib/api-diagnostics.ts") },
);
const id = "550e8400-e29b-41d4-a716-446655440001",
  url =
    "https://res.cloudinary.com/test/image/upload/v1/course-thumbnails/test.webp";
const identity = {
  id,
  name: "Admin",
  email: "admin@example.test",
  role: "ADMIN",
  status: "ACTIVE",
  roleVersion: 1,
  isEmailVerified: true,
  maskedPhone: null,
  avatarUrl: null,
  createdAt: "2026-10-15T00:00:00Z",
};
function req(headers = {}, form, opts = {}) {
  const data = form ?? new FormData();
  if (!form)
    data.append(
      "file",
      new Blob(["synthetic"], { type: "image/png" }),
      "cover.png",
    );
  return new NextRequest(
    "http://localhost/api/workspace/admin/course-thumbnails",
    {
      method: "POST",
      headers: {
        Origin: "http://localhost",
        Cookie: "vetralink_access=synthetic",
        "X-Workspace-Actor": `${id}:ADMIN:1`,
        ...headers,
      },
      body: data,
      ...opts,
    },
  );
}
function setup(t, { user = identity, result = { url }, status = 201 } = {}) {
  const original = globalThis.fetch,
    calls = [];
  globalThis.fetch = async (target, init) => {
    calls.push({ url: new URL(target), init });
    return Response.json(
      {
        success: true,
        data: new URL(target).pathname.endsWith("auth/me") ? user : result,
      },
      { status: new URL(target).pathname.endsWith("auth/me") ? 200 : status },
    );
  };
  t.after(() => (globalThis.fetch = original));
  return calls;
}
for (const role of ["ADMIN", "SUPER_ADMIN"])
  test(`${role} upload forwards one file to fixed API with cookie-derived credentials`, async (t) => {
    const calls = setup(t, { user: { ...identity, role } });
    const response = await handleThumbnailUpload(
      req({
        "X-Workspace-Actor": `${id}:${role}:1`,
        Authorization: "Bearer untrusted",
        "x-farm-id": "untrusted",
      }),
    );
    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { data: { url } });
    assert.equal(calls.length, 2);
    assert.equal(calls[1].url.pathname, "/api/v1/admin/courses/thumbnails");
    assert.equal(calls[1].init.headers.Authorization, "Bearer synthetic");
    assert.equal(calls[1].init.headers["x-farm-id"], undefined);
    assert.equal(calls[1].init.redirect, "error");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal([...calls[1].init.body.keys()].join(","), "file");
  });
test("rejects missing cookie, cross-origin, cross-site, missing actor and JSON without uploading", async (t) => {
  const calls = setup(t);
  for (const [headers, code] of [
    [{ Cookie: "" }, 401],
    [{ Origin: "" }, 403],
    [{ Origin: "https://evil.test" }, 403],
    [{ "sec-fetch-site": "cross-site" }, 403],
    [{ "X-Workspace-Actor": "" }, 403],
    [{ "content-type": "application/json" }, 415],
  ]) {
    const r = await handleThumbnailUpload(req(headers));
    assert.equal(r.status, code);
  }
  assert.equal(calls.length, 0);
});
test("rejects changed actor, inactive and ordinary user before reading/uploading body", async (t) => {
  const original = globalThis.fetch;
  t.after(() => (globalThis.fetch = original));
  let uploads = 0;
  for (const user of [
    { ...identity, role: "LEARNER" },
    { ...identity, status: "SUSPENDED" },
    { ...identity, roleVersion: 2 },
  ]) {
    globalThis.fetch = async (target) => {
      if (!String(target).endsWith("auth/me")) uploads++;
      return Response.json({ success: true, data: user });
    };
    assert.equal((await handleThumbnailUpload(req())).status, 403);
  }
  assert.equal(uploads, 0);
});
test("rejects empty, mismatched, oversized and extra multipart entries", async (t) => {
  const calls = setup(t);
  for (const options of [
    { name: "cover.jpg", type: "image/png", content: "x" },
    { name: "cover.png", type: "image/png", content: "" },
    {
      name: "cover.png",
      type: "image/png",
      content: "x".repeat(3 * 1024 * 1024 + 1),
    },
  ]) {
    const form = new FormData();
    form.append(
      "file",
      new Blob([options.content], { type: options.type }),
      options.name,
    );
    assert.ok((await handleThumbnailUpload(req({}, form))).status >= 400);
  }
  for (const name of ["file", "extra"]) {
    const form = new FormData();
    form.append("file", new Blob(["x"], { type: "image/png" }), "cover.png");
    form.append(name, "untrusted");
    assert.equal((await handleThumbnailUpload(req({}, form))).status, 422);
  }
  assert.ok(calls.every((call) => call.url.pathname.endsWith("auth/me")));
});
test("bounds actual bytes without Content-Length before multipart parsing", async (t) => {
  const calls = setup(t);
  const bytes = new Uint8Array(3 * 1024 * 1024 + 64 * 1024 + 1);
  const request = req(
    { "Content-Type": "multipart/form-data; boundary=test" },
    undefined,
    { body: bytes },
  );
  assert.equal((await handleThumbnailUpload(request)).status, 413);
  assert.equal(calls.length, 1);
});
test("rejects invalid upstream URLs and redacts provider failures", async (t) => {
  const original = globalThis.fetch;
  t.after(() => (globalThis.fetch = original));
  for (const [data, status, want] of [
    [{ url: "http://unsafe.test/x" }, 201, 502],
    [{ url, secret: "hidden" }, 201, 502],
    [{ errorDetails: { title: "PROVIDER_SECRET" } }, 503, 503],
  ]) {
    let n = 0;
    globalThis.fetch = async () =>
      ++n === 1
        ? Response.json({ success: true, data: identity })
        : Response.json(
            status === 201
              ? { success: true, data }
              : { ...data, message: "provider-secret" },
            { status },
          );
    const response = await handleThumbnailUpload(req());
    assert.equal(response.status, want);
    assert.equal(
      JSON.stringify(await response.json()).includes("provider-secret"),
      false,
    );
  }
});

function transport(
  t,
  responses,
  { refresh = async () => ({ ok: false }), lock = (task) => task() } = {},
) {
  const old = globalThis.XMLHttpRequest,
    requests = [];
  class FakeXHR {
    upload = {};
    headers = {};
    status = 0;
    responseText = "";
    open(method, url) {
      this.method = method;
      this.url = url;
    }
    setRequestHeader(name, value) {
      this.headers[name] = value;
    }
    abort() {
      this.onabort?.();
    }
    send(body) {
      this.body = body;
      requests.push(this);
      const response = responses.shift();
      if (response === "pending") return;
      queueMicrotask(() => {
        if (response === "network") {
          this.onerror?.();
          return;
        }
        if (response === "timeout") {
          this.ontimeout?.();
          return;
        }
        this.upload.onprogress?.({
          lengthComputable: true,
          loaded: 50,
          total: 100,
        });
        this.status = response.status;
        this.responseText = JSON.stringify(response.body);
        this.onload?.();
      });
    }
  }
  globalThis.XMLHttpRequest = FakeXHR;
  t.after(() => (globalThis.XMLHttpRequest = old));
  return {
    ...compile("../src/lib/workspace/thumbnail-upload.ts", {
      "../auth/client": { withSessionLock: lock, authRequest: refresh },
    }),
    requests,
  };
}
const file = () => new File(["synthetic"], "cover.png", { type: "image/png" });
const options = (signal) => ({
  expectedActor: `${id}:ADMIN:1`,
  signal,
  onProgress: () => {},
});
test("XHR sends FormData with actor, genuine progress and no manual multipart header", async (t) => {
  const { uploadCourseThumbnail, requests } = transport(t, [
    { status: 201, body: { data: { url } } },
  ]);
  const progress = [];
  assert.deepEqual(
    await uploadCourseThumbnail(file(), {
      ...options(new AbortController().signal),
      onProgress: (value) => progress.push(value),
    }),
    { url },
  );
  assert.deepEqual(progress, [50]);
  assert.equal(requests[0].headers["Content-Type"], undefined);
  assert.equal(requests[0].headers["X-Workspace-Actor"], `${id}:ADMIN:1`);
  assert.equal(requests[0].body.get("file").name, "cover.png");
});
test("aborted queued upload never opens a request", async (t) => {
  let release;
  const { uploadCourseThumbnail, requests } = transport(t, [], {
    lock: (task) =>
      new Promise((resolve, reject) => {
        release = () => task().then(resolve, reject);
      }),
  });
  const controller = new AbortController(),
    result = uploadCourseThumbnail(file(), options(controller.signal));
  controller.abort();
  release();
  await assert.rejects(result, /UPLOAD_CANCELLED/);
  assert.equal(requests.length, 0);
});
test("aborting an active XHR rejects without retry", async (t) => {
  const { uploadCourseThumbnail, requests } = transport(t, ["pending"]);
  const controller = new AbortController(),
    result = uploadCourseThumbnail(file(), options(controller.signal));
  controller.abort();
  await assert.rejects(result, /UPLOAD_CANCELLED/);
  assert.equal(requests.length, 1);
});
test("one explicit 401 may refresh/retry only for the same actor", async (t) => {
  let refreshed = 0;
  const { uploadCourseThumbnail, requests } = transport(
    t,
    [
      { status: 401, body: { code: "UNAUTHORIZED" } },
      { status: 201, body: { data: { url } } },
    ],
    {
      refresh: async () => {
        refreshed++;
        return { ok: true, data: { user: identity } };
      },
    },
  );
  assert.deepEqual(
    await uploadCourseThumbnail(file(), options(new AbortController().signal)),
    { url },
  );
  assert.equal(requests.length, 2);
  assert.equal(refreshed, 1);
});
test("changed actor after refresh cannot retry the original upload", async (t) => {
  const { uploadCourseThumbnail, requests } = transport(
    t,
    [{ status: 401, body: { code: "UNAUTHORIZED" } }],
    {
      refresh: async () => ({
        ok: true,
        data: { user: { ...identity, roleVersion: 2 } },
      }),
    },
  );
  await assert.rejects(
    uploadCourseThumbnail(file(), options(new AbortController().signal)),
    /AUTHORIZATION_CHANGED/,
  );
  assert.equal(requests.length, 1);
});
for (const response of [
  "network",
  "timeout",
  { status: 503, body: { code: "THUMBNAIL_UNAVAILABLE" } },
  { status: 201, body: { data: { url: "javascript:alert(1)" } } },
])
  test(`ambiguous or invalid response ${JSON.stringify(response)} never retries`, async (t) => {
    const { uploadCourseThumbnail, requests } = transport(t, [response]);
    await assert.rejects(
      uploadCourseThumbnail(file(), options(new AbortController().signal)),
    );
    assert.equal(requests.length, 1);
  });
