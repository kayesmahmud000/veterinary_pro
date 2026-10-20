// Integrated production web -> BFF -> real Nest/PG/Redis. No production target is accepted.
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { createWriteStream } from "node:fs";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const require = createRequire(import.meta.url),
  apiRequire = createRequire(
    new URL("../../api/package.json", import.meta.url),
  );
const { PrismaClient } = apiRequire("@prisma/client"),
  bcrypt = apiRequire("bcryptjs"),
  { Queue } = apiRequire("bullmq");
const database = "postgresql://postgres:adm9_only@127.0.0.1:55449/adm9_test";
assert.equal(
  process.env.ADM9_TEST_DATABASE_URL,
  database,
  "Explicit disposable ADM9 database required",
);
const redisContainer = process.env.ADM9_REDIS_CONTAINER;
assert.match(redisContainer ?? "", /^vet-adm9-[a-f0-9]{32}-redis$/);
const inspection = spawnSync("docker", ["inspect", redisContainer], {
  encoding: "utf8",
  windowsHide: true,
});
assert.equal(inspection.status, 0);
const inspected = JSON.parse(inspection.stdout)[0];
assert.equal(inspected.Config.Labels["vetralink.task"], "adm9");
assert.ok(
  inspected.NetworkSettings.Ports["6379/tcp"].some(
    (p) => p.HostIp === "127.0.0.1" && p.HostPort === "56449",
  ),
);
const postgresContainer = redisContainer.replace(/-redis$/, "-pg");
const postgresInspection = spawnSync("docker", ["inspect", postgresContainer], {
  encoding: "utf8",
  windowsHide: true,
});
assert.equal(postgresInspection.status, 0);
const postgres = JSON.parse(postgresInspection.stdout)[0];
assert.equal(postgres.Config.Labels["vetralink.task"], "adm9");
assert.ok(
  postgres.NetworkSettings.Ports["5432/tcp"].some(
    (p) => p.HostIp === "127.0.0.1" && p.HostPort === "55449",
  ),
);
const webDir = fileURLToPath(new URL("../", import.meta.url)),
  apiDir = fileURLToPath(new URL("../../api/", import.meta.url));
const buildDir = process.env.WEB_TEST_BUILD_DIR;
assert.ok(
  buildDir &&
    (await readFile(path.join(buildDir, ".next/BUILD_ID"), "utf8")).trim(),
  "Build web first",
);
const origin = "http://localhost:35410",
  api = "http://127.0.0.1:35411/api/v1";
const temp = await mkdtemp(path.join(tmpdir(), "vet-adm9-acceptance-"));
const db = new PrismaClient({ datasources: { db: { url: database } } });
const queue = new Queue("role-notifications", {
  connection: { host: "127.0.0.1", port: 56449, maxRetriesPerRequest: 1 },
});
const password = "SyntheticADM9Password123!",
  confirmation = {
    actorPassword: password,
    reason: "Reviewed ADM9 synthetic acceptance",
    confirmed: true,
  };
const query = { from: "2026-10-01", to: "2026-10-21", timezone: "Asia/Dhaka" };
const run = randomUUID(),
  users = {},
  children = [],
  logs = [],
  results = [],
  exceptions = [],
  responses = [];
const mutationsOnly = process.env.ADM9_RELEASE_FOCUS === "mutations";
let chrome, ws, client, worker;
const baseEnv = {
  PATH: process.env.PATH,
  SystemRoot: process.env.SystemRoot,
  TEMP: process.env.TEMP,
  TMP: process.env.TMP,
  USERPROFILE: process.env.USERPROFILE,
  NODE_ENV: "test",
  API_DEBUG: "0",
  DATABASE_URL: database,
  REDIS_URL: "redis://127.0.0.1:56449",
  EMAIL_PROVIDER: "mock",
  PORT: "35411",
  WEB_BASE_URL: origin,
  API_BASE_URL: api,
  CORS_ORIGINS: origin,
  AWS_EC2_METADATA_DISABLED: "true",
};
async function until(task, message, timeout = 25000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await task()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(message);
}
function start(name, file, args = [], env = {}) {
  const log = createWriteStream(path.join(temp, name + ".log"));
  logs.push(log);
  const child = spawn(process.execPath, [file, ...args], {
    cwd: temp,
    env: { ...baseEnv, ...env },
    windowsHide: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(log);
  child.stderr.pipe(log);
  children.push(child);
  child.on("error", (e) => {
    console.error(name + ": " + e.code);
  });
  return child;
}
async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exit = new Promise((resolve) => child.once("exit", resolve));
  child.kill();
  await Promise.race([
    exit,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Child did not stop")), 10000).unref(),
    ),
  ]);
}
async function apiRequest(
  route,
  { method = "GET", body, token, status = 200 } = {},
) {
  const response = await fetch(api + "/" + route, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20000),
  });
  const json = await response.json();
  assert.equal(
    response.status,
    status,
    `${method} ${route} status ${response.status}; ${json.errorDetails?.title ?? json.title ?? ""}`,
  );
  return json.data ?? json;
}
async function login(user) {
  return apiRequest("auth/login", {
    method: "POST",
    body: { email: user.email, password },
  });
}
async function cdp(target) {
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let id = 0;
  const pending = new Map();
  ws.onmessage = ({ data }) => {
    const value = JSON.parse(data);
    if (value.method === "Runtime.exceptionThrown")
      exceptions.push(value.params.exceptionDetails.text);
    if (
      value.method === "Network.responseReceived" &&
      value.params.response.url.startsWith(origin + "/api/workspace/")
    )
      responses.push({
        url: value.params.response.url,
        status: value.params.response.status,
      });
    if (!value.id) return;
    const p = pending.get(value.id);
    pending.delete(value.id);
    value.error
      ? p?.reject(new Error(value.error.message))
      : p?.resolve(value.result);
  };
  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const seq = ++id;
      pending.set(seq, { resolve, reject });
      ws.send(JSON.stringify({ id: seq, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await call("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    assert.ok(
      !r.exceptionDetails,
      r.exceptionDetails?.exception?.description ?? "Browser evaluation failed",
    );
    return r.result.value;
  };
  for (const domain of ["Page", "Runtime", "Network"])
    await call(domain + ".enable");
  return { call, evaluate };
}
async function navigate(route) {
  await client.call("Page.navigate", { url: origin + route });
  await until(
    () =>
      client.evaluate(
        `document.readyState==='complete' && location.pathname===${JSON.stringify(route.split("?")[0])} && document.querySelectorAll('main').length===1`,
      ),
    "Page not loaded: " + route,
  );
}
async function browserRequest(
  route,
  body,
  method = body ? "POST" : "GET",
  expected = method === "POST" ? 201 : 200,
) {
  const result = await client.evaluate(
    `(async()=>{const r=await fetch('/api/workspace/'+${JSON.stringify(route)},{method:${JSON.stringify(method)},headers:{'Content-Type':'application/json','X-Workspace-Actor':${JSON.stringify(client.actor)}},${body ? "body:JSON.stringify(" + JSON.stringify(body) + ")," : ""}cache:'no-store'});return {status:r.status,cache:r.headers.get('cache-control'),body:await r.json()};})()`,
  );
  if (expected === null)
    assert.ok(
      [201, 409].includes(result.status),
      `Concurrent BFF write: ${result.status}`,
    );
  else
    assert.equal(
      result.status,
      expected,
      `${method} BFF ${route}: ${result.status} ${JSON.stringify(result.body.error ?? result.body.errorDetails ?? {})}`,
    );
  assert.match(result.cache, /no-store/);
  if (expected === null) return result;
  return result.body.data ?? result.body;
}
async function seedSession(role, locale) {
  const session = await login(users[role]);
  client.actor = `${users[role].id}:${role}:0`;
  for (const [name, value] of [
    ["vetralink_access", session.tokens.accessToken],
    ["vetralink_refresh", session.tokens.refreshToken],
    ["vetralink-locale", locale],
  ])
    await client.call("Network.setCookie", {
      name,
      value,
      url: origin,
      httpOnly: name !== "vetralink-locale",
      sameSite: "Lax",
    });
  return session;
}
async function loginUi(role, locale) {
  await client.call("Network.clearBrowserCookies");
  await client.call("Network.setCookie", {
    name: "vetralink-locale",
    value: locale,
    url: origin,
  });
  await navigate("/?auth=required&returnTo=%2Fadmin%2Fdashboard");
  await until(
    () =>
      client.evaluate(
        "!!document.querySelector('dialog[open] #auth-email') && !!document.querySelector('dialog[open] button[type=submit]') && !document.querySelector('dialog[open] button[type=submit]').matches(':disabled')",
      ),
    "Login modal not ready",
  );
  await client.evaluate(
    `(()=>{for(const [id,value] of Object.entries(${JSON.stringify({ "auth-email": users[role].email, "auth-password": password })})){const el=document.getElementById(id);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(el,value);el.dispatchEvent(new Event('input',{bubbles:true}));}})()`,
  );
  await client.evaluate(
    "document.querySelector('dialog[open] form').requestSubmit()",
  );
  await until(
    () =>
      client.evaluate(
        "location.pathname==='/admin/dashboard' && !document.querySelector('dialog[open]')",
      ),
    "Real UI login did not enter admin dashboard",
  );
  client.actor = `${users[role].id}:${role}:0`;
}
const record = (text) => {
  results.push(text);
  console.log("PASS " + text);
};
async function checkColdBootstrap() {
  const name = "adm9_bootstrap_" + run.replaceAll("-", "");
  const created = spawnSync(
    "docker",
    [
      "exec",
      postgresContainer,
      "createdb",
      "-U",
      "postgres",
      "--template",
      "adm9_restore",
      name,
    ],
    { encoding: "utf8", windowsHide: true },
  );
  assert.equal(
    created.status,
    0,
    "Create dedicated synthetic cold-bootstrap database",
  );
  const url = database.replace("/adm9_test", "/" + name);
  const bootDb = new PrismaClient({ datasources: { db: { url } } });
  const ready = () =>
    until(
      async () => {
        try {
          return (
            await fetch("http://127.0.0.1:35412/api/v1/health/readiness", {
              signal: AbortSignal.timeout(1000),
            })
          ).ok;
        } catch {
          return false;
        }
      },
      "Cold-bootstrap API not ready",
      180000,
    );
  let child;
  try {
    assert.equal(await bootDb.subscriptionPlan.count(), 0);
    child = start("cold-bootstrap", path.join(apiDir, "dist/main.js"), [], {
      DATABASE_URL: url,
      PORT: "35412",
    });
    await ready();
    assert.equal(await bootDb.subscriptionPlan.count(), 3);
    await stop(child);
    const output = await readFile(
      path.join(temp, "cold-bootstrap.log"),
      "utf8",
    );
    assert.equal(
      (output.match(/Missing default subscription plans detected/g) ?? [])
        .length,
      1,
    );
    assert.ok(!output.includes("Unique constraint failed"));
    await bootDb.subscriptionPlan.update({
      where: { tier: "PRO" },
      data: { name: "Synthetic edited local plan", priceMonthlyCents: 12345 },
    });
    child = start(
      "cold-bootstrap-restart",
      path.join(apiDir, "dist/main.js"),
      [],
      { DATABASE_URL: url, PORT: "35412" },
    );
    await ready();
    assert.equal(
      (
        await bootDb.subscriptionPlan.findUniqueOrThrow({
          where: { tier: "PRO" },
        })
      ).priceMonthlyCents,
      12345,
    );
    await stop(child);
    record(
      "Cold API boot seeds exactly once without a tier conflict; restart preserves an edited plan",
    );
  } finally {
    await stop(child);
    await bootDb.$disconnect();
  }
}
try {
  assert.equal(
    (
      await db.user.findUniqueOrThrow({
        where: { email: "adm9-baseline@example.test" },
      })
    ).name,
    "Synthetic pre-ADM9 baseline",
  );
  assert.equal(await db.$queryRaw`SELECT 1`.then(() => true), true);
  if (!mutationsOnly) await checkColdBootstrap();
  const hash = await bcrypt.hash(password, 12);
  for (const role of [
    "ADMIN",
    "SUPER_ADMIN",
    "LEARNER",
    "FARMER",
    "BUYER",
    "VET",
  ])
    users[role] = await db.user.create({
      data: {
        email: `adm9-${run}-${role.toLowerCase()}@example.test`,
        name: "Synthetic ADM9 " + role,
        role,
        passwordHash: hash,
      },
    });
  users.PEER = await db.user.create({
    data: {
      email: `adm9-${run}-peer@example.test`,
      name: "Synthetic ADM9 peer",
      passwordHash: hash,
    },
  });
  start("api", path.join(apiDir, "dist/main.js"));
  await until(
    async () => {
      try {
        return (
          await fetch(api + "/health/readiness", {
            signal: AbortSignal.timeout(1000),
          })
        ).ok;
      } catch {
        return false;
      }
    },
    "Real API readiness failed",
    180000,
  );
  start(
    "next",
    require.resolve("next/dist/bin/next"),
    ["start", buildDir, "-p", "35410", "-H", "127.0.0.1"],
    { NODE_ENV: "production" },
  );
  await until(
    async () => {
      try {
        return (await fetch(origin)).ok;
      } catch {
        return false;
      }
    },
    "Production Next not ready",
    60000,
  );
  await apiRequest("admin/directory/users", { status: 401 });
  await apiRequest("admin/directory/users", { token: "forged", status: 401 });
  const anonymous = await fetch(origin + "/admin/dashboard", {
    redirect: "manual",
  });
  assert.equal(anonymous.status, 307);
  assert.match(anonymous.headers.get("cache-control"), /no-store/);
  record(
    "Built API and production Next start with real PostgreSQL/Redis and isolated configuration",
  );
  chrome = spawn(
    process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    [
      "--headless=new",
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
      "--remote-debugging-address=127.0.0.1",
      "--remote-debugging-port=9349",
      `--user-data-dir=${path.join(temp, "chrome")}`,
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  children.push(chrome);
  let targets;
  await until(async () => {
    try {
      targets = await (await fetch("http://127.0.0.1:9349/json")).json();
      return targets.some((t) => t.type === "page");
    } catch {
      return false;
    }
  }, "Chrome not ready");
  client = await cdp(targets.find((t) => t.type === "page"));
  const routes = [
    ["/admin/dashboard", "admin/overview"],
    ["/admin/users", "admin/directory/users"],
    ["/admin/veterinarians", "admin/directory/veterinarians"],
    ["/admin/farms", "admin/directory/farms"],
    ["/admin/audit", "admin/directory/audit"],
    ["/admin/products", "admin/products"],
    ["/admin/courses", "admin/products"],
    ["/admin/media", "admin/media"],
    ["/admin/orders", "admin/billing/orders"],
    ["/admin/subscriptions", "admin/billing/subscriptions"],
    ["/admin/plans", "admin/billing/plans"],
    ["/admin/dunning", "admin/billing/dunning"],
    ["/admin/triage", "admin/consultations"],
    ["/admin/consultations", "admin/consultations"],
    ["/admin/settlements", "admin/settlements"],
    ["/admin/reviews", "admin/reviews"],
    ["/admin/content", "admin/content"],
    ["/admin/notifications", "admin/notifications"],
    ["/admin/support", "admin/support"],
    ["/admin/metrics", "admin/platform/reports"],
    ["/admin/reports", "admin/platform/reports"],
    ["/admin/role-requests", "admin/role-requests"],
  ];
  for (const role of mutationsOnly ? [] : ["ADMIN", "SUPER_ADMIN"])
    for (const locale of ["bn", "en"])
      for (const width of [320, 1440]) {
        await client.call("Emulation.setDeviceMetricsOverride", {
          width,
          height: 1000,
          deviceScaleFactor: 1,
          mobile: width < 800,
        });
        await loginUi(role, locale);
        const selected =
          role === "SUPER_ADMIN"
            ? [
                ...routes,
                ["/admin/settings", "admin/platform/settings"],
                ["/admin/settings/integrations", "admin/platform/integrations"],
                ["/admin/system", "admin/platform/system"],
                ["/admin/administrative-access", "admin/users"],
              ]
            : routes;
        for (const [route, endpoint] of selected) {
          const before = responses.length;
          await navigate(route);
          await until(
            () =>
              responses
                .slice(before)
                .some(
                  (r) =>
                    r.url.includes("/api/workspace/" + endpoint) &&
                    r.status === 200,
                ),
            `No successful real BFF load: ${role} ${locale} ${route}`,
          );
          assert.deepEqual(
            responses.slice(before).filter((r) => r.status >= 400),
            [],
            "Failed BFF response on " + route,
          );
          const page = await client.evaluate(
            "({lang:document.documentElement.lang,h1:document.querySelectorAll('main h1').length,overflow:document.documentElement.scrollWidth>innerWidth+1,alerts:[...document.querySelectorAll('main [role=alert]')].map(e=>e.innerText)})",
          );
          assert.equal(page.lang, locale);
          assert.equal(page.h1, 1, route);
          assert.equal(page.overflow, false, route);
          assert.deepEqual(page.alerts, [], route);
        }
        await writeFile(
          path.join(temp, `${role}-${locale}-${width}.png`),
          Buffer.from(
            (
              await client.call("Page.captureScreenshot", {
                captureBeyondViewport: true,
              })
            ).data,
            "base64",
          ),
        );
        record(
          `${role} ${locale} ${width}px: ${selected.length} real admin routes, successful BFF loads, language/landmarks/overflow`,
        );
      }
  await client.call("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await seedSession("SUPER_ADMIN", "en");
  await navigate("/admin/settings");
  const current = await browserRequest("admin/platform/settings");
  const fields = {
    organizationBn: "পরীক্ষার প্রতিষ্ঠান",
    organizationEn: "Synthetic ADM9 organization",
    supportEmail: "adm9@example.test",
    reportTimezone: "Asia/Dhaka",
    expectedVersion: current.version,
    ...confirmation,
  };
  await browserRequest(
    "admin/platform/settings",
    { ...fields, actorPassword: "deliberately-wrong" },
    "POST",
    403,
  );
  const race = await Promise.all([
    browserRequest("admin/platform/settings", fields, "POST", null),
    browserRequest("admin/platform/settings", fields, "POST", null),
  ]);
  assert.deepEqual(race.map((r) => r.status).sort(), [201, 409]);
  const saved = await browserRequest("admin/platform/settings");
  assert.equal(saved.organizationEn, fields.organizationEn);
  assert.equal(saved.version, current.version + 1);
  assert.equal(
    (await db.platformSettings.findFirstOrThrow()).version,
    saved.version,
  );
  record(
    "Real settings password rejection, concurrent version protection and persisted reload",
  );
  const system = await browserRequest("admin/platform/system");
  assert.equal(system.database, "UP");
  assert.equal(system.redis, "UP");
  assert.ok(system.queues.every((q) => q.status === "OBSERVED"));
  const integrations = await browserRequest("admin/platform/integrations");
  assert.equal(
    integrations.items.find((i) => i.name === "EMAIL").status,
    "MOCK",
  );
  const report = await browserRequest(
    "admin/platform/reports?" + new URLSearchParams(query),
  );
  assert.equal(report.range.timezone, "Asia/Dhaka");
  const exported = await browserRequest(
    "admin/platform/reports/export",
    { ...confirmation, query },
    "POST",
  );
  assert.equal(exported.report.range.timezone, query.timezone);
  const audit = await browserRequest(
    "admin/platform/audit-export",
    { ...confirmation, query: { ...query, limit: 20 } },
    "POST",
  );
  assert.ok(audit.items.length <= 20);
  assert.ok(!JSON.stringify(audit).includes(hash));
  assert.ok(!JSON.stringify(audit).includes(password));
  record(
    "Real Redis queue diagnostics, explicit mock-provider status and bounded report/audit exports",
  );
  const contentId = randomUUID(),
    slug = "adm9-" + run;
  const draft = {
    bn: {
      title: "পরীক্ষার প্রকাশনা",
      summary: "পরীক্ষার সারাংশ",
      body: "পরীক্ষার লেখা <script>window.ADM9_UNSAFE=true</script>",
    },
    en: {
      title: "Synthetic ADM9 publication",
      summary: "Synthetic summary",
      body: "Synthetic article <script>window.ADM9_UNSAFE=true</script>",
    },
  };
  let doc = await browserRequest(
    "admin/content",
    { id: contentId, kind: "BLOG", slug, draft },
    "POST",
  );
  await apiRequest("content/BLOG/" + slug, { status: 404 });
  doc = await browserRequest(`admin/content/${contentId}/actions`, {
    ...confirmation,
    expectedVersion: doc.version,
    action: "PUBLISH",
  });
  const published = await apiRequest("content/BLOG/" + slug);
  assert.equal(published.content.en.title, draft.en.title);
  assert.equal(published.draft, undefined);
  const publicPage = await (await fetch(origin + "/blog/" + slug)).text();
  assert.ok(publicPage.includes("&lt;script&gt;"));
  assert.ok(!publicPage.includes("<script>window.ADM9_UNSAFE"));
  doc = await browserRequest(`admin/content/${contentId}/actions`, {
    ...confirmation,
    expectedVersion: doc.version,
    action: "UNPUBLISH",
  });
  await apiRequest("content/BLOG/" + slug, { status: 404 });
  assert.equal(
    (await db.editorialDocument.findUniqueOrThrow({ where: { id: contentId } }))
      .publishedAt,
    null,
  );
  record(
    "Real draft privacy, confirmed publication/removal, persisted state and escaped public rendering",
  );
  const product = await browserRequest("admin/products", {
    title: "Synthetic ADM9 course",
    slug: "course-" + run,
    description: "Synthetic course for isolated acceptance",
    type: "VIDEO_COURSE",
    contentProvider: "YOUTUBE",
    priceCents: 0,
    discountPriceCents: null,
    currency: "BDT",
    minSubscriptionTier: "STARTER",
  });
  const curriculum = await browserRequest(
    `admin/products/${product.id}/curriculum`,
    {
      expectedVersion: product.version,
      lessons: [
        {
          title: "Synthetic lesson",
          summary: "Local acceptance only",
          videoUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
          access: "ENROLLED",
        },
      ],
    },
    "PUT",
  );
  assert.equal(curriculum.lessons.length, 1);
  assert.equal(
    await db.courseLesson.count({ where: { productId: product.id } }),
    1,
  );
  record("Real product draft and course curriculum persist through BFF/API");
  await seedSession("LEARNER", "en");
  await navigate("/account/support");
  const ticketId = randomUUID();
  let ticket = await browserRequest("support/tickets", {
    id: ticketId,
    messageId: randomUUID(),
    subject: "Synthetic ADM9 support",
    category: "ACCOUNT",
    body: "Synthetic requester message",
  });
  await seedSession("ADMIN", "en");
  await navigate("/admin/support");
  ticket = await browserRequest(`admin/support/${ticketId}/actions`, {
    ...confirmation,
    expectedVersion: ticket.version,
    action: "REPLY",
    messageId: randomUUID(),
    body: "SYNTHETIC_ADM9_PRIVATE_NOTE",
    internal: true,
  });
  await seedSession("LEARNER", "en");
  await navigate("/account/support");
  const own = await browserRequest(`support/tickets/${ticketId}`);
  assert.ok(!JSON.stringify(own).includes("SYNTHETIC_ADM9_PRIVATE_NOTE"));
  await seedSession("BUYER", "en");
  await navigate("/account/support");
  await browserRequest(`support/tickets/${ticketId}`, undefined, "GET", 404);
  record(
    "Real requester support, admin internal reply privacy and foreign-account denial",
  );
  for (const role of ["LEARNER", "FARMER", "BUYER", "VET"]) {
    const session = await seedSession(role, "en");
    await apiRequest("admin/directory/users", {
      token: session.tokens.accessToken,
      status: 403,
    });
    const r = await client.evaluate(
      "fetch('/admin/dashboard',{redirect:'follow'}).then(r=>({url:r.url,status:r.status}))",
    );
    assert.ok(!r.url.endsWith("/admin/dashboard"));
    await browserRequest("admin/directory/users", undefined, "GET", 403);
  }
  await seedSession("ADMIN", "en");
  await browserRequest("admin/platform/settings", undefined, "GET", 403);
  const superDenied = await client.evaluate(
    "fetch('/admin/settings',{redirect:'follow'}).then(r=>r.url)",
  );
  assert.ok(!superDenied.endsWith("/admin/settings"));
  record(
    "Four ordinary roles and ADMIN-on-Super controls denied by real API, BFF and server routing",
  );
  const adminSession = await seedSession("ADMIN", "en");
  await db.user.update({
    where: { id: users.ADMIN.id },
    data: {
      role: "LEARNER",
      roleVersion: { increment: 1 },
      authorizationVersion: { increment: 1 },
    },
  });
  await apiRequest("admin/directory/users", {
    token: adminSession.tokens.accessToken,
    status: 401,
  });
  await browserRequest("admin/directory/users", undefined, "GET", 401);
  await db.user.update({
    where: { id: users.ADMIN.id },
    data: { role: "ADMIN" },
  });
  record(
    "Already-issued administrative session fails after current-primary demotion/version change",
  );
  await seedSession("SUPER_ADMIN", "en");
  await navigate("/admin/users");
  const peerLogin = await login(users.PEER),
    beforePeer = await browserRequest(`admin/directory/users/${users.PEER.id}`);
  const accountInput = {
    actorPassword: password,
    reason: confirmation.reason,
    action: "REVOKE_SESSIONS",
    expectedAuthorizationVersion: beforePeer.authorizationVersion,
  };
  await browserRequest(
    `admin/directory/users/${users.PEER.id}/actions`,
    accountInput,
  );
  await apiRequest("auth/me", {
    token: peerLogin.tokens.accessToken,
    status: 401,
  });
  await apiRequest("auth/refresh", {
    method: "POST",
    body: { refreshToken: peerLogin.tokens.refreshToken },
    status: 401,
  });
  record("Confirmed account support revokes real access and refresh sessions");
  // Persist while no role worker exists, fail safely on a missing key, retain generation zero,
  // then explicitly retry and restart with the mock provider. No external request is needed.
  assert.equal(await queue.getWorkersCount(), 0);
  const outbox = await db.roleNotificationOutbox.create({
    data: {
      eventKey: "adm9-worker-" + run,
      eventType: "PRIVILEGED_ROLE_CHANGED",
      targetUserId: users.LEARNER.id,
      authorizationVersion: 0,
      locale: "bn",
    },
  });
  assert.equal(
    await db.roleNotificationDelivery.count({ where: { outboxId: outbox.id } }),
    0,
  );
  worker = start(
    "worker-missing-key",
    path.join(apiDir, "dist/role-notifications.worker.js"),
    [],
    { EMAIL_PROVIDER: "resend" },
  );
  await until(
    async () => (await queue.getWorkersCount()) > 0,
    "Worker did not register",
  );
  let delivery;
  await until(
    async () => {
      delivery = await db.roleNotificationDelivery.findFirst({
        where: { outboxId: outbox.id },
      });
      return delivery?.status === "FAILED";
    },
    "Missing-key retries did not reach FAILED",
    60000,
  );
  const oldJob = await queue.getJob("role-mail-" + delivery.id);
  assert.ok(oldJob);
  await until(
    async () => (await oldJob.getState()) === "failed",
    "Retained failed job missing",
  );
  assert.equal(delivery.attempts, 5);
  await stop(worker);
  worker = null;
  await browserRequest(`admin/notifications/${delivery.id}/retry`, {
    ...confirmation,
    expectedGeneration: 0,
  });
  assert.equal(
    (
      await db.roleNotificationDelivery.findUniqueOrThrow({
        where: { id: delivery.id },
      })
    ).retryGeneration,
    1,
  );
  worker = start(
    "worker-mock-restart",
    path.join(apiDir, "dist/role-notifications.worker.js"),
  );
  await until(
    async () =>
      (
        await db.roleNotificationDelivery.findUniqueOrThrow({
          where: { id: delivery.id },
        })
      ).status === "SENT",
    "Restarted worker did not process durable retry",
    30000,
  );
  const accepted = await db.roleNotificationDelivery.findUniqueOrThrow({
    where: { id: delivery.id },
  });
  assert.match(accepted.providerMessageId, /^mock-msg-/);
  assert.equal(await oldJob.getState(), "failed");
  const observed = await browserRequest("admin/platform/system");
  assert.equal(observed.redis, "UP");
  assert.ok(observed.roleEmail);
  // The platform HTTP allowlist exposes role outbox counts separately, not this
  // queue. Verify the separate worker directly through real BullMQ.
  assert.ok((await queue.getWorkersCount()) >= 1);
  const history = await browserRequest("admin/notifications?source=ROLE_EMAIL");
  assert.equal(
    history.items.find((entry) => entry.id === delivery.id)?.status,
    "ACCEPTED",
  );
  record(
    "Durable worker startup/five safe provider failures/retained failed job/generation-one retry/restart/mock acceptance observed on real Redis",
  );
  for (const [locale, width] of [
    ["bn", 320],
    ["en", 1440],
  ]) {
    await client.call("Network.setCookie", {
      name: "vetralink-locale",
      value: locale,
      url: origin,
    });
    await client.call("Emulation.setDeviceMetricsOverride", {
      width,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: width < 800,
    });
    await navigate("/admin/reports");
    await until(
      () =>
        client.evaluate("!!document.querySelector('[data-platform-report]')"),
      "Real report ready for visual inspection",
    );
    await writeFile(
      path.join(temp, `report-${locale}-${width}.png`),
      Buffer.from(
        (
          await client.call("Page.captureScreenshot", {
            captureBeyondViewport: false,
          })
        ).data,
        "base64",
      ),
    );
    assert.equal(
      await client.evaluate(
        "document.documentElement.scrollWidth>innerWidth+1",
      ),
      false,
    );
  }
  record(
    "Real report renders at Bangla 320px and English 1440px with captured viewport evidence",
  );
  await navigate("/admin/dashboard");
  await client.evaluate(
    "document.querySelector('[data-workspace-nav=desktop] a[href=\"/\"]').click()",
  );
  await until(
    () =>
      client.evaluate(
        "location.pathname==='/' && !!document.querySelector('[data-avatar-trigger]')",
      ),
    "Return to public Home",
  );
  await client.evaluate(
    "document.querySelector('[data-avatar-trigger]').click()",
  );
  await until(
    () => client.evaluate("!!document.querySelector('[data-public-signout]')"),
    "Public logout available",
  );
  await client.evaluate(
    "document.querySelector('[data-public-signout]').click()",
  );
  await until(
    () =>
      client.evaluate(
        "!!document.querySelector('[data-auth-trigger]:not(:disabled)')",
      ),
    "Logout completed",
  );
  await client.evaluate("history.back()");
  await until(
    () =>
      client.evaluate(
        "location.pathname==='/' && !!document.querySelector('dialog[open] #auth-email') && !document.querySelector('[data-workspace-shell]')",
      ),
    "Logout/Back must use public auth handoff",
  );
  record(
    "Real logout/Back discards cached admin workspace and restores the public login handoff",
  );
  assert.deepEqual(exceptions, []);
  await writeFile(
    path.join(temp, "results.json"),
    JSON.stringify(
      {
        revision: "a07d77f plus ADM9 changes",
        buildId: (
          await readFile(path.join(buildDir, ".next/BUILD_ID"), "utf8")
        ).trim(),
        checks: results,
        focus: mutationsOnly ? "mutations" : "full",
        browserExceptions: exceptions,
        externalProviderDelivery: "NOT_TESTED",
        deployedAcceptance: "NOT_TESTED",
      },
      null,
      2,
    ),
  );
  console.log(`PASS ${results.length} integrated groups. Evidence: ${temp}`);
} catch (error) {
  console.error(`FAIL ${error.stack}\nEvidence: ${temp}`);
  if (client) {
    const state = await client
      .evaluate(
        "({url:location.href,dialog:document.querySelector('dialog[open]')?.innerText,alerts:[...document.querySelectorAll('[role=alert]')].map(e=>e.innerText)})",
      )
      .catch(() => ({}));
    console.error(JSON.stringify(state));
    await writeFile(
      path.join(temp, "failed.png"),
      Buffer.from(
        (
          await client.call("Page.captureScreenshot", {
            captureBeyondViewport: true,
          })
        ).data,
        "base64",
      ),
    ).catch(() => {});
  }
  process.exitCode = 1;
} finally {
  ws?.close();
  for (const child of children.reverse())
    await stop(child).catch(() => {
      child.kill("SIGKILL");
    });
  for (const log of logs) log.end();
  await queue.close();
  await db.$disconnect();
}
