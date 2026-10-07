// Real local Nest + PostgreSQL/Redis acceptance. API must already use the isolated test services.
// Starts only its own production Next server and headless Chrome; never targets a deployed service.
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
const require = createRequire(import.meta.url),
  apiRequire = createRequire(
    new URL("../../api/package.json", import.meta.url),
  );
const { PrismaClient } = apiRequire("@prisma/client"),
  bcrypt = apiRequire("bcryptjs");
const webDir = fileURLToPath(new URL("../", import.meta.url)),
  origin = "http://localhost:3310",
  api = "http://127.0.0.1:3311/api/v1";
const database = process.env.ROLE_TEST_DATABASE_URL;
if (
  database !== "postgresql://role_test:role_test_only@127.0.0.1:55432/role_test"
)
  throw new Error(
    "Use the explicitly isolated role_test database on 127.0.0.1:55432.",
  );
const db = new PrismaClient({ datasources: { db: { url: database } } }),
  password = "SyntheticBrowserPassword123!",
  run = randomUUID();
const temp = await mkdtemp(path.join(tmpdir(), "vetralink-workspace-qa-")),
  shots = [];
const fixtures = {};
let nextProcess, chrome, client;
async function until(task, message, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      if (await task()) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(message);
}
async function apiRequest(route, method = "GET", body, token, expected = 200) {
  const response = await fetch(`${api}/${route}`, {
    method,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const result = await response.json();
  assert.equal(
    response.status,
    expected,
    `${method} ${route}: ${result.title ?? result.message ?? "unexpected response"}`,
  );
  return result.data ?? result;
}
async function loginApi(user) {
  return (
    await apiRequest("auth/login", "POST", { email: user.email, password })
  ).tokens.accessToken;
}
async function connect(target) {
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let seq = 0;
  const pending = new Map(),
    exceptions = [];
  ws.onmessage = ({ data }) => {
    const value = JSON.parse(data);
    if (value.method === "Runtime.exceptionThrown")
      exceptions.push(
        value.params.exceptionDetails.exception?.description ??
          value.params.exceptionDetails.text,
      );
    if (!value.id) return;
    const item = pending.get(value.id);
    pending.delete(value.id);
    value.error
      ? item?.reject(new Error(value.error.message))
      : item?.resolve(value.result);
  };
  const call = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  const evaluate = async (expression) => {
    const r = await call("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (r.exceptionDetails)
      throw new Error(
        r.exceptionDetails.exception?.description ??
          "Browser evaluation failed",
      );
    return r.result.value;
  };
  await call("Runtime.enable");
  await call("Page.enable");
  return { ws, call, evaluate, exceptions };
}
async function navigate(route) {
  await client.call("Page.navigate", { url: `${origin}${route}` });
  await until(
    () =>
      client.evaluate(
        "document.readyState==='complete' && [...document.querySelectorAll('header [data-auth-trigger]')].some(b=>!b.disabled)",
      ),
    "Session did not become ready",
  );
}
async function viewport(width) {
  await client.call("Emulation.setDeviceMetricsOverride", {
    width,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: width < 800,
  });
}
async function locale(value) {
  await client.call("Network.setCookie", {
    name: "vetralink-locale",
    value,
    url: origin,
  });
}
async function fill(values, prefix = "") {
  await client.evaluate(
    `(()=>{for(const [key,value]of Object.entries(${JSON.stringify(values)})){const el=document.getElementById(${JSON.stringify(prefix)}+key);if(!el)throw new Error('Missing field '+key);if(el.type==='checkbox'){if(el.checked!==value)el.click();continue;}const proto=el.tagName==='SELECT'?HTMLSelectElement.prototype:el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));}})()`,
  );
}
async function submit(selector = "main form") {
  await client.evaluate(
    `document.querySelector(${JSON.stringify(selector)}).requestSubmit()`,
  );
}
async function open(mode = "login") {
  await client.evaluate(
    `(()=>{const buttons=[...document.querySelectorAll('header button')].filter(b=>b.getClientRects().length);const button=${mode === "register" ? "buttons.find(b=>b.textContent.trim()==='Sign up')" : "buttons.find(b=>b.hasAttribute('data-auth-trigger'))"};if(!button)throw new Error('Missing auth button');button.click();})()`,
  );
  await until(
    () => client.evaluate("!!document.querySelector('dialog[open]')"),
    "Auth modal did not open",
  );
}
async function dismiss() {
  await client.call("Input.dispatchKeyEvent", {
    type: "keyDown",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await client.call("Input.dispatchKeyEvent", {
    type: "keyUp",
    key: "Escape",
    code: "Escape",
    windowsVirtualKeyCode: 27,
  });
  await until(
    () => client.evaluate("!document.querySelector('dialog[open]')"),
    "Dialog did not close",
  );
}
async function signOut() {
  await open();
  await client.evaluate(
    "[...document.querySelectorAll('dialog button')].find(b=>b.textContent.trim()==='Sign out').click()",
  );
  await until(
    () => client.evaluate("!document.querySelector('dialog[open]')"),
    "Logout failed",
  );
}
async function signIn(user) {
  await navigate("/learning");
  await open();
  await fill({ email: user.email, password }, "auth-");
  await submit("dialog form");
  if (user.farmerOnboardingRequired) {
    await until(
      () =>
        client.evaluate(
          "location.pathname==='/account/farm-onboarding' && !!document.querySelector('#setup-mode')",
        ),
      "Farmer login did not resume setup",
    );
  } else {
    await until(
      () => client.evaluate("!!document.querySelector('[data-account-title]')"),
      "Login profile did not appear",
    );
    await dismiss();
  }
}
async function confirm() {
  await until(
    () =>
      client.evaluate(
        "!!document.querySelector('dialog[open] #workspace-confirm-title')",
      ),
    "Confirmation missing",
  );
  await client.evaluate(
    "document.querySelector('dialog[open] button').click()",
  );
  await until(
    () => client.evaluate("!document.querySelector('dialog[open]')"),
    "Confirmation did not finish",
  );
}
async function shot(name) {
  assert.equal(
    await client.evaluate("document.documentElement.scrollWidth<=innerWidth"),
    true,
    `${name}: horizontal overflow`,
  );
  const result = await client.call("Page.captureScreenshot");
  const file = path.join(temp, `${name}.png`);
  await writeFile(file, Buffer.from(result.data, "base64"));
  shots.push(file);
}
try {
  await apiRequest(
    "role-requests/questionnaires/BUYER",
    "GET",
    undefined,
    undefined,
    401,
  );
  const hash = await bcrypt.hash(password, 12);
  for (const [key, role] of [
    ["admin", "ADMIN"],
    ["super", "SUPER_ADMIN"],
    ["member", "FARMER"],
  ])
    fixtures[key] = await db.user.create({
      data: {
        email: `${key}-${run}@browser.example.test`,
        name: `Synthetic ${key}`,
        passwordHash: hash,
        role,
        farmerOnboardingRequired: role === "FARMER",
      },
    });
  nextProcess = spawn(
    process.execPath,
    [require.resolve("next/dist/bin/next"), "start", "-p", "3310"],
    {
      cwd: webDir,
      windowsHide: true,
      stdio: "ignore",
      env: { ...process.env, NODE_ENV: "production", API_BASE_URL: api },
    },
  );
  await until(
    async () => (await fetch(origin)).ok,
    "Production Next server failed",
    30000,
  );
  chrome = spawn(
    process.env.CHROME_PATH ||
      "C:/Program Files/Google/Chrome/Application/chrome.exe",
    [
      "--headless=new",
      "--remote-debugging-port=9335",
      `--user-data-dir=${path.join(temp, "profile")}`,
      "--no-first-run",
      "--no-default-browser-check",
      "about:blank",
    ],
    { windowsHide: true, stdio: "ignore" },
  );
  await until(
    async () => (await fetch("http://127.0.0.1:9335/json/version")).ok,
    "Chrome did not start",
  );
  const targets = await (await fetch("http://127.0.0.1:9335/json/list")).json();
  client = await connect(
    targets.find((t) => t.type === "page" && t.url === "about:blank"),
  );
  console.log("Stage: default Learner signup and application");
  await viewport(1440);
  await locale("en");
  await navigate("/learning");
  await open("register");
  assert.equal(
    await client.evaluate(
      "document.querySelector('input[value=LEARNER]').checked",
    ),
    true,
  );
  const learner = {
    email: `learner-${run}@browser.example.test`,
    name: "Synthetic Learner",
  };
  await fill({ ...learner, password, confirmation: password }, "auth-");
  await submit("dialog form");
  await until(
    () => client.evaluate("!!document.querySelector('[data-account-title]')"),
    "Default signup failed",
  );
  assert.ok(
    await client.evaluate(
      "document.querySelector('dialog').textContent.includes('Learner')",
    ),
  );
  await dismiss();
  const storedLearner = await db.user.findUnique({
    where: { email: learner.email },
  });
  assert.equal(storedLearner.role, "LEARNER");
  await navigate("/account/role-requests/new");
  await until(
    () => client.evaluate("!!document.querySelector('#targetRole')"),
    "Application role control missing",
  );
  await fill({ targetRole: "BUYER" });
  await until(
    () => client.evaluate("!!document.querySelector('#use')"),
    "Buyer questionnaire missing",
  );
  await submit();
  assert.ok(
    await client.evaluate(
      "document.querySelectorAll('main [aria-invalid=true]').length>=3",
    ),
  );
  await fill({
    use: "PERSONAL",
    district: "Dhaka",
    interests: "Animal care products",
    reason: "I need care products for my local household.",
    consent: true,
  });
  await submit();
  await until(
    () =>
      client.evaluate(
        "location.pathname.startsWith('/account/role-requests/') && location.pathname.split('/').at(-1).length===36 && document.querySelector('main').textContent.includes('under review')",
      ),
    "Application submission failed",
  );
  const requestId = await client.evaluate(
    "location.pathname.split('/').at(-1)",
  );
  assert.equal(
    await client.evaluate(
      "document.cookie.includes('vetralink_access') || document.cookie.includes('vetralink_refresh')",
    ),
    false,
  );
  const adminToken = await loginApi(fixtures.admin);
  await apiRequest(
    `admin/role-requests/${requestId}/decision`,
    "POST",
    {
      decision: "APPROVED",
      expectedRequestVersion: 1,
      expectedApplicantRoleVersion: 0,
    },
    adminToken,
    201,
  );
  await client.evaluate(
    "[...document.querySelectorAll('main button')].find(b=>b.textContent.trim()==='Refresh account').click()",
  );
  await until(
    () =>
      client.evaluate(
        "document.querySelector('main').textContent.includes('Current role: Buyer')",
      ),
    "Role approval did not refresh the browser session",
  );
  await shot("en-approved-1440");
  await signOut();
  console.log("Stage: farmer signup, setup and owner members");
  const farmer = {
    email: `farmer-${run}@browser.example.test`,
    name: "Synthetic Farm Owner",
  };
  await navigate("/learning");
  await open("register");
  await fill({ ...farmer, password, confirmation: password }, "auth-");
  await client.evaluate(
    "document.querySelector('input[value=FARMER]').click()",
  );
  await submit("dialog form");
  await until(
    () =>
      client.evaluate(
        "location.pathname==='/account/farm-onboarding' && !!document.querySelector('#setup-mode')",
      ),
    "Farmer signup did not immediately start setup",
  );
  await navigate("/farm");
  await until(
    () =>
      client.evaluate(
        "location.pathname==='/account/farm-onboarding' && !!document.querySelector('#setup-mode')",
      ),
    "Dashboard gate failed",
  );
  const farmerToken = await loginApi(farmer);
  const gate = await apiRequest(
    `farms/${randomUUID()}/members`,
    "GET",
    undefined,
    farmerToken,
    403,
  );
  assert.equal(gate.errorDetails.title, "FARM_ONBOARDING_REQUIRED");
  for (const lang of ["bn", "en"])
    for (const width of [1440, 320]) {
      await locale(lang);
      await viewport(width);
      await navigate("/account/farm-onboarding");
      await until(
        () => client.evaluate("!!document.querySelector('#name')"),
        "Onboarding form missing",
      );
      assert.equal(
        await client.evaluate("document.documentElement.lang"),
        lang,
      );
      await shot(`${lang}-onboarding-${width}`);
    }
  await locale("en");
  await viewport(1440);
  await navigate("/account/farm-onboarding");
  await until(
    () => client.evaluate("!!document.querySelector('#name')"),
    "Farm form missing",
  );
  await submit();
  assert.ok(
    await client.evaluate(
      "document.querySelectorAll('main [aria-invalid=true]').length>=3",
    ),
  );
  await fill({
    name: "Synthetic Dairy Farm",
    farmType: "DAIRY",
    district: "Dhaka",
    upazila: "Savar",
    address: "Synthetic farm road 25",
    animalCount: "5",
    experienceYears: "2",
    gpsLat: "23.8",
  });
  await client.evaluate("document.querySelector('#species input').click()");
  await submit();
  assert.equal(
    await client.evaluate(
      "document.querySelector('#gpsLat').getAttribute('aria-invalid')",
    ),
    "true",
  );
  await fill({ gpsLng: "90.2" });
  await submit();
  await until(
    () =>
      client.evaluate(
        "location.pathname==='/farm' && !!document.querySelector('#email')",
      ),
    "Farm setup did not open dashboard",
  );
  const storedFarmer = await db.user.findUnique({
      where: { email: farmer.email },
    }),
    farm = await db.farm.findFirst({ where: { ownerId: storedFarmer.id } });
  assert.equal(storedFarmer.farmerOnboardingRequired, false);
  assert.equal(
    (
      await db.farmMember.findUnique({
        where: { farmId_userId: { farmId: farm.id, userId: storedFarmer.id } },
      })
    ).role,
    "OWNER",
  );
  assert.equal(
    await client.evaluate(
      "[...document.querySelector('#role').options].length",
    ),
    4,
  );
  await fill({ email: fixtures.member.email, role: "MANAGER" });
  await submit("main form");
  await until(
    () =>
      client.evaluate(
        "document.querySelector('main').textContent.includes('Member added.')",
      ),
    "Owner could not add member by email",
  );
  await until(
    () =>
      client.evaluate(
        "document.querySelector('main').textContent.includes('Synthetic member')",
      ),
    "Member display name missing",
  );
  await fill({ email: learner.email });
  await submit("main form");
  await until(
    () =>
      client.evaluate(
        "document.querySelector('main [role=alert]')?.textContent.includes('staff limit')",
      ),
    "Staff quota failure missing",
  );
  for (const lang of ["bn", "en"])
    for (const width of [1440, 375, 320]) {
      await locale(lang);
      await viewport(width);
      await navigate("/farm");
      await until(
        () => client.evaluate("!!document.querySelector('#email')"),
        "Farm dashboard missing",
      );
      await shot(`${lang}-farm-${width}`);
    }
  await locale("en");
  await viewport(1440);
  await navigate("/farm");
  await signOut();
  await signIn(fixtures.member);
  await fill({ "setup-mode": "join" });
  await until(
    () => client.evaluate("!!document.querySelector('#farmId')"),
    "Existing membership control missing",
  );
  await fill({ farmId: farm.id, confirmed: true });
  await submit();
  await until(
    () =>
      client.evaluate(
        "location.pathname==='/farm' && !!document.querySelector('#role')",
      ),
    "Member onboarding did not complete",
  );
  assert.equal(
    await client.evaluate(
      "[...document.querySelector('#role').options].some(o=>o.value==='OWNER')",
    ),
    false,
  );
  await signOut();
  console.log("Stage: role review and administrative permissions");
  const applicant = await apiRequest(
    "auth/register",
    "POST",
    {
      email: `review-${run}@browser.example.test`,
      name: "Synthetic Review Applicant",
      password,
    },
    undefined,
    201,
  );
  const pending = await apiRequest(
    "users/me/role-requests",
    "POST",
    {
      targetRole: "BUYER",
      questionnaireVersion: 1,
      locale: "en",
      submissionKey: randomUUID(),
      answers: {
        use: "PERSONAL",
        district: "Dhaka",
        interests: "Animal health products",
        reason: "I need care products for local household animals.",
        consent: true,
      },
    },
    applicant.tokens.accessToken,
    201,
  );
  await signIn(fixtures.admin);
  await navigate(`/admin/role-requests/${pending.id}`);
  await until(
    () => client.evaluate("!!document.querySelector('#decision')"),
    "Review form missing",
  );
  await fill({ decision: "REJECTED" });
  await submit();
  assert.equal(
    await client.evaluate(
      "document.querySelector('#publicReason').getAttribute('aria-invalid')",
    ),
    "true",
  );
  await fill({
    publicReason: "Please provide more detail before approval.",
    privateNote: "Private reviewer assessment only.",
  });
  await submit();
  await confirm();
  await until(
    () =>
      client.evaluate(
        "document.querySelector('main').textContent.includes('already been decided')",
      ),
    "Review decision did not update",
  );
  await shot("en-review-1440");
  const own = await apiRequest(
    `users/me/role-requests/${pending.id}`,
    "GET",
    undefined,
    applicant.tokens.accessToken,
  );
  assert.equal(
    own.publicDecisionReason,
    "Please provide more detail before approval.",
  );
  assert.equal("privateReviewNote" in own, false);
  await navigate("/admin/administrative-access");
  await until(
    () =>
      client.evaluate(
        "document.querySelector('main').textContent.includes('unavailable for your role')",
      ),
    "Normal admin privilege gate missing",
  );
  assert.equal(
    await client.evaluate("document.querySelector('main form')===null"),
    true,
  );
  const forbidden = await client.evaluate(
    "fetch('/api/workspace/admin/users',{cache:'no-store'}).then(r=>r.status)",
  );
  assert.equal(forbidden, 403);
  await signOut();
  await signIn(fixtures.super);
  await navigate("/admin/administrative-access");
  await until(
    () => client.evaluate("!!document.querySelector('#email')"),
    "Administrative target form missing",
  );
  await fill({ email: applicant.user.email });
  await submit("main > form");
  await until(
    () => client.evaluate("!!document.querySelector('#actorPassword')"),
    "Administrative target missing",
  );
  await fill({
    reason: "Synthetic promotion approved for local testing.",
    actorPassword: password,
  });
  await submit("main section form");
  await confirm();
  await until(
    () =>
      client.evaluate(
        "document.querySelector('main').textContent.includes('Administrative access updated') && document.querySelector('#action')?.value==='GRANT_SUPER_ADMIN'",
      ),
    "Privilege grant failed",
  );
  assert.equal(
    (await db.user.findUnique({ where: { id: applicant.user.id } })).role,
    "ADMIN",
  );
  await apiRequest(
    "auth/refresh",
    "POST",
    { refreshToken: applicant.tokens.refreshToken },
    undefined,
    401,
  );
  await fill({
    action: "REMOVE_PRIVILEGE",
    reason: "Restore the original role after local testing.",
    actorPassword: password,
  });
  await submit("main section form");
  await confirm();
  await until(async () => {
    const user = await db.user.findUnique({ where: { id: applicant.user.id } });
    return (
      user.role === "LEARNER" &&
      (await client.evaluate(
        "document.querySelector('#action')?.value==='GRANT_ADMIN'",
      ))
    );
  }, "Privilege fallback failed");
  await shot("en-access-1440");
  await until(
    async () => {
      const event = await db.roleNotificationOutbox.findUnique({
        where: { eventKey: `request-${pending.id}-2` },
      });
      return (
        event &&
        (await db.roleNotificationDelivery.count({
          where: { outboxId: event.id, status: "SENT" },
        })) > 0
      );
    },
    "Mock notification worker did not deliver the decision",
    30000,
  );
  assert.deepEqual(client.exceptions, []);
  console.log(
    "PASS: real API default signup, Learner application/approval/session refresh, immediate farmer setup/dashboard gate, atomic OWNER, email member addition/quota, membership confirmation, manager role restriction, private reviewer notes, normal admin denial, SUPER_ADMIN grant/removal/fallback and durable mock mail.",
  );
  console.log(
    "PASS: bn/en onboarding and farm rendering at 1440/375/320px with no horizontal overflow.",
  );
  console.log(`Screenshots: ${JSON.stringify(shots)}`);
  console.log(
    "Isolated PostgreSQL/Redis and mock mail only; no production service or real email provider was used.",
  );
} catch (error) {
  if (client)
    console.error(
      "Browser failure state:",
      await client
        .evaluate(
          "({path:location.pathname,text:document.querySelector('main')?.innerText,alerts:[...document.querySelectorAll('[role=alert]')].map(el=>el.textContent)})",
        )
        .catch(() => ({ unavailable: true })),
    );
  throw error;
} finally {
  if (client) {
    await client.call("Browser.close").catch(() => {});
    client.ws.close();
  }
  chrome?.kill();
  nextProcess?.kill();
  await db.$disconnect();
  const profile = path.resolve(temp, "profile");
  if (
    !profile.startsWith(path.resolve(tmpdir()) + path.sep) ||
    !path.basename(temp).startsWith("vetralink-workspace-qa-")
  )
    throw new Error("Unsafe temporary profile cleanup target");
  await rm(profile, {
    recursive: true,
    force: true,
    maxRetries: 5,
    retryDelay: 200,
  }).catch(() => {});
}
