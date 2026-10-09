// Local production browser acceptance with synthetic identities and a controlled API.
// This checks real Next components/BFF behavior, not deployed provider/database readiness.
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import http from "node:http";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const webDir = fileURLToPath(new URL("../", import.meta.url));
const buildDir = process.env.WEB_TEST_BUILD_DIR || webDir;
const origin = "http://localhost:3410";
const temp = await mkdtemp(path.join(tmpdir(), "khamar-workspace-qa-"));
const roles = ["LEARNER", "FARMER", "BUYER", "VET", "ADMIN", "SUPER_ADMIN"];
const users = new Map(
  roles.map((role, i) => [
    role,
    {
      id: `550e8400-e29b-41d4-a716-44665544000${i}`,
      role,
      roleVersion: 0,
      name: "Synthetic " + role,
      email: role.toLowerCase() + "@example.test",
      status: "ACTIVE",
      isEmailVerified: false,
      maskedPhone: "+88018*******23",
      avatarUrl: null,
      createdAt: "2026-10-08T00:00:00Z",
      farmerOnboardingRequired: false,
    },
  ]),
);
const farmA = "660e8400-e29b-41d4-a716-446655440001",
  farmB = "660e8400-e29b-41d4-a716-446655440002";
const farmFixtures = [
  {
    id: farmA,
    name: "Synthetic Dairy A",
    farmType: "DAIRY",
    country: "Bangladesh",
    address: "Test farm road",
    role: "OWNER",
    ownerId: users.get("FARMER").id,
  },
  {
    id: farmB,
    name: "Synthetic Beef B",
    farmType: "BEEF",
    country: "Bangladesh",
    address: "Second farm road",
    role: "MANAGER",
    ownerId: users.get("FARMER").id,
  },
];
let revoked = false,
  delayMembers = false,
  milkRecords = 0,
  financeFailure = false,
  readOnly = false,
  quotaFull = false;
const animalId = "880e8400-e29b-41d4-a716-446655440001";
const animalFixture = {
  id: animalId,
  farmId: farmA,
  tagNumber: "TEST-1",
  rfidNumber: null,
  name: "Synthetic animal",
  species: "COW",
  breed: null,
  gender: "FEMALE",
  dateOfBirth: null,
  ageMonths: null,
  weightKg: 250,
  status: "ACTIVE",
  sireId: null,
  damId: null,
  metadata: {},
  syncVersion: 1,
  createdAt: "2026-10-08T00:00:00Z",
  updatedAt: "2026-10-08T00:00:00Z",
};
const herd = new Map([
  [farmA, [{ ...animalFixture }]],
  [farmB, [{ ...animalFixture, farmId: farmB }]],
]);
let offline = false;
let fixtureRole = "LEARNER";
let next, chrome, ws;
let debugEvaluate;
let checks = 0;
const focus = process.env.WORKSPACE_BROWSER_FOCUS === "history";
const requests = [];
const upstream = http.createServer(async (req, res) => {
  let text = "";
  for await (const chunk of req) text += chunk;
  const data = text ? JSON.parse(text) : {};
  const route = new URL(req.url, "http://local").pathname.replace(
    "/api/v1/",
    "",
  );
  const role =
    req.headers.authorization?.replace("Bearer a-", "") || fixtureRole;
  requests.push({
    route,
    method: req.method,
    farmId: req.headers["x-farm-id"],
    body: data,
  });
  const send = (status, data) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ success: status < 400, data }));
  };
  if (offline) return send(503, null);
  if (route === "auth/me")
    return req.headers.authorization
      ? send(200, users.get(role))
      : send(401, null);
  if (route === "auth/login" || route === "auth/register") {
    const user =
      route === "auth/register"
        ? {
            ...users.get(data.role ?? "LEARNER"),
            name: data.name,
            email: data.email,
          }
        : [...users.values()].find((u) => u.email === data.email);
    if (!user || data.password !== "DemoPassword123!") return send(401, null);
    return send(200, {
      user,
      tokens: {
        accessToken: "a-" + user.role,
        refreshToken: "r-" + user.role,
        tokenType: "Bearer",
        expiresIn: 900,
      },
    });
  }
  if (route === "auth/refresh") return send(401, null);
  if (route === "auth/logout") return send(200, null);
  if (route === "farms/my" || route === "farms/onboarding")
    return send(200, {
      required: users.get(role)?.farmerOnboardingRequired,
      farms: role === "LEARNER" || revoked ? [] : farmFixtures,
    });
  if (route.match(/^farms\/[^/]+\/members$/)) {
    if (revoked || role === "LEARNER") return send(403, null);
    const farmId = route.split("/")[1];
    if (delayMembers && farmId === farmA) await sleep(700);
    return send(200, {
      items: [
        {
          id: "770e8400-e29b-41d4-a716-446655440001",
          farmId,
          userId: users.get(role).id,
          role: "OWNER",
          displayName: farmId === farmA ? "Member A" : "Member B",
          createdAt: "2026-10-08T00:00:00Z",
        },
      ],
      total: 1,
    });
  }
  const selected = req.headers["x-farm-id"] || route.split("/")[2],
    query = new URL(req.url, "http://local").searchParams;
  if (route === "animals" && req.method === "GET") {
    const filtered = (herd.get(selected) || []).filter(
      (a) =>
        (!query.get("search") ||
          a.tagNumber.includes(query.get("search").toUpperCase())) &&
        (!query.get("species") || a.species === query.get("species")) &&
        (!query.get("status") || a.status === query.get("status")),
    );
    const page = Number(query.get("page") || 1),
      limit = Number(query.get("limit") || 20);
    return send(200, {
      items: filtered.slice((page - 1) * limit, page * limit),
      meta: {
        page,
        pageSize: limit,
        total: query.get("limit") === "1" ? 120 : filtered.length,
        totalPages:
          query.get("limit") === "1" ? 120 : Math.ceil(filtered.length / limit),
      },
    });
  }
  if (route === "animals" && req.method === "POST") {
    if (readOnly || quotaFull) return send(403, null);
    if (
      (herd.get(selected) || []).some(
        (a) => a.tagNumber === data.tagNumber.trim().toUpperCase(),
      )
    )
      return send(409, null);
    const entity = {
      ...animalFixture,
      ...data,
      id: randomUUID(),
      farmId: selected,
      tagNumber: data.tagNumber.trim().toUpperCase(),
    };
    herd.get(selected).push(entity);
    return send(201, entity);
  }
  if (route.startsWith("animals/")) {
    const entity = herd
      .get(selected)
      ?.find((a) => a.id === route.split("/")[1]);
    if (!entity) return send(404, null);
    if (req.method === "PATCH") {
      if (readOnly) return send(403, null);
      Object.assign(entity, data);
    }
    return send(200, entity);
  }
  if (route === "milk-logs/analytics")
    return send(200, {
      farmId: selected,
      startDate: query.get("startDate"),
      endDate: query.get("endDate"),
      summary: { totalYieldLiters: 0, totalRecords: milkRecords },
    });
  if (route === "clinical-health/vaccinations/schedule")
    return send(200, {
      totalRecords: 0,
      totalVaccinations: 0,
      totalDewormings: 0,
      dueNext7Days: 0,
      dueNext30Days: 0,
      overdueCount: 0,
      upcomingEvents: [],
    });
  if (route === "financial/profit-loss/summary")
    return financeFailure
      ? send(503, null)
      : send(200, {
          farmId: selected,
          startDate: query.get("startDate"),
          endDate: query.get("endDate"),
          currency: "USD",
          totalRevenue: 100,
          totalExpense: 25,
          netProfit: 75,
          profitMarginPercentage: 75,
          operatingExpenseRatio: 25,
          isProfitable: true,
        });
  if (route.endsWith("/access-status"))
    return send(200, {
      subscriptionId: "",
      farmId: selected,
      status: "ACTIVE",
      accessMode: readOnly ? "READ_ONLY" : "FULL_ACCESS",
      canRead: true,
      canWrite: !readOnly,
      daysPastDue: 0,
      gracePeriodDaysRemaining: 0,
      gracePeriodEnd: null,
      suspensionDate: null,
    });
  if (route.endsWith("/quota")) {
    const usage = (type) => ({
      quotaType: type,
      currentUsage: 1,
      limit: 5,
      remaining: 4,
      isUnlimited: false,
      canAccommodate: !quotaFull,
      planTier: "STARTER",
      upgradeTier: "PRO",
    });
    return send(200, {
      farmId: selected,
      planTier: "STARTER",
      planName: "Starter",
      isSubscriptionActive: true,
      quotas: { animals: usage("ANIMALS"), staff: usage("STAFF") },
    });
  }
  if (route === "users/me/role-requests")
    return send(200, { requests: [], nextCursor: null });
  if (route === "admin/role-requests")
    return ["ADMIN", "SUPER_ADMIN"].includes(role)
      ? send(200, { requests: [], nextCursor: null })
      : send(403, null);
  return send(404, null);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(task, message, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try {
      if (await task()) return;
    } catch {}
    await sleep(80);
  }
  if (debugEvaluate)
    console.error(
      await debugEvaluate(
        `JSON.stringify({url:location.href,body:document.body.innerText.slice(0,1800)})`,
      ).catch(() => ""),
    );
  throw new Error(message);
}
try {
  await new Promise((resolve, reject) =>
    upstream.once("error", reject).listen(3411, "127.0.0.1", resolve),
  );
  next = spawn(
    process.execPath,
    [require.resolve("next/dist/bin/next"), "start", buildDir, "-p", "3410"],
    {
      cwd: webDir,
      stdio: "ignore",
      env: {
        ...process.env,
        NODE_ENV: "production",
        API_BASE_URL: "http://127.0.0.1:3411/api/v1",
      },
    },
  );
  await until(
    async () => (await fetch(origin)).ok,
    "Next test server ready",
    30000,
  );
  chrome = spawn(
    process.env.CHROME_PATH || "/usr/bin/google-chrome",
    [
      "--headless=new",
      ...(process.env.CHROME_NO_SANDBOX === "1" ? ["--no-sandbox"] : []),
      "--remote-debugging-port=9341",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${path.join(temp, "chrome")}`,
      "about:blank",
    ],
    { stdio: "ignore" },
  );
  await until(
    async () => (await fetch("http://127.0.0.1:9341/json/version")).ok,
    "Chrome ready",
  );
  const target = (
    await (await fetch("http://127.0.0.1:9341/json")).json()
  ).find((t) => t.type === "page");
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  let seq = 0;
  const pending = new Map();
  const exceptions = [];
  ws.onmessage = ({ data }) => {
    const r = JSON.parse(data);
    if (r.method === "Runtime.exceptionThrown") {
      exceptions.push(r.params.exceptionDetails.exception?.description);
      console.error(r.params.exceptionDetails.exception?.description);
    }
    if (!r.id) return;
    const p = pending.get(r.id);
    pending.delete(r.id);
    r.error ? p.reject(r.error) : p.resolve(r.result);
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
      throw new Error(r.exceptionDetails.exception?.description);
    return r.result.value;
  };
  debugEvaluate = evaluate;
  await call("Page.enable");
  await call("Runtime.enable");
  await call("Network.enable");
  async function cookie(name, value) {
    await call("Network.setCookie", { name, value, url: origin, path: "/" });
  }
  async function go(route, expected = route.split("?")[0]) {
    await call("Page.navigate", { url: origin + route });
    await until(
      () =>
        evaluate(
          `document.readyState==='complete' && location.pathname===${JSON.stringify(expected)} && !!document.querySelector('main h1')`,
        ),
      "Page loaded " + route,
    );
  }
  async function key(key, code, n) {
    for (const type of ["keyDown", "keyUp"])
      await call("Input.dispatchKeyEvent", {
        type,
        ...(type === "keyDown" && key === "Enter"
          ? { text: "\r", unmodifiedText: "\r" }
          : {}),
        key,
        code,
        windowsVirtualKeyCode: n,
      });
  }
  async function seed(role, locale = "en") {
    fixtureRole = role;
    await cookie("vetralink_access", "a-" + role);
    await cookie("vetralink_refresh", "r-" + role);
    await cookie("vetralink-locale", locale);
  }
  if (!focus) {
    for (const locale of ["bn", "en"])
      for (const role of roles) {
        await seed(role, locale);
        await go(
          "/dashboard",
          role === "LEARNER" ? "/account/profile" : "/dashboard",
        );
        await until(
          () =>
            evaluate(
              role === "LEARNER"
                ? `!!document.querySelector('[data-account-profile]') && !document.querySelector('[data-dashboard-role]')`
                : `document.querySelector('[data-dashboard-role]')?.getAttribute('data-dashboard-role')===${JSON.stringify(role)}`,
            ),
          "Role overview " + role,
        );
        assert.equal(
          await evaluate(`!!document.querySelector('[data-workspace-shell]')`),
          true,
          "Shared application shell exists",
        );
        assert.equal(
          await evaluate(`document.querySelectorAll('main').length`),
          1,
        );
        assert.equal(
          await evaluate(`document.querySelectorAll('h1').length`),
          1,
        );
        const hrefs = await evaluate(
          `Array.from(document.querySelectorAll('[data-workspace-nav="desktop"] a')).map(a=>a.getAttribute('href'))`,
        );
        assert.equal(hrefs.includes("/dashboard"), role !== "LEARNER");
        assert.equal(
          await evaluate(
            `!!document.querySelector('header a[href="/dashboard"]')`,
          ),
          role !== "LEARNER",
        );
        assert.equal(
          hrefs.includes("/admin/role-requests"),
          ["ADMIN", "SUPER_ADMIN"].includes(role),
        );
        assert.equal(
          hrefs.includes("/admin/administrative-access"),
          role === "SUPER_ADMIN",
        );
        assert.equal(
          hrefs.includes("/account/role-requests/new"),
          role === "LEARNER",
        );
        await go("/account/profile");
        await until(
          () => evaluate(`!!document.querySelector('[data-account-profile]')`),
          "Read-only profile",
        );
        assert.ok(
          await evaluate(
            `document.querySelector('main').textContent.includes('+88018*******23')`,
          ),
        );
        assert.equal(
          await evaluate(
            `document.querySelector('main input[name="role"]')!==null`,
          ),
          false,
        );
        checks++;
      }
    for (const responsiveLocale of ["bn", "en"]) {
      await seed("FARMER", responsiveLocale);
      for (const width of [320, 375, 768, 1024, 1440]) {
        await call("Emulation.setDeviceMetricsOverride", {
          width,
          height: 1000,
          deviceScaleFactor: 1,
          mobile: false,
        });
        for (const [route, marker, label] of [
          ["/dashboard", "[data-dashboard-role]", "dashboard"],
          ["/account/profile", "[data-account-profile]", "profile"],
          [`/app/farms/${farmA}`, "[data-selected-farm]", "farm"],
          [`/app/farms/${farmA}/animals/new`, "[data-animal-form]", "register"],
        ]) {
          await go(route);
          await until(
            () =>
              evaluate(`!!document.querySelector(${JSON.stringify(marker)})`),
            "Responsive " + label,
          );
          if (label === "farm")
            await until(
              () =>
                evaluate(
                  `!document.querySelector('[data-farm-metric] [role="status"]')`,
                ),
              "Metrics ready for screenshot",
            );
          assert.equal(
            await evaluate(`document.documentElement.scrollWidth>innerWidth`),
            false,
            label + " overflow " + width,
          );
          const shot = await call("Page.captureScreenshot", { format: "png" });
          await writeFile(
            path.join(temp, `${label}-${responsiveLocale}-${width}.png`),
            Buffer.from(shot.data, "base64"),
          );
        }
        if (width < 1024) {
          await evaluate(
            `document.querySelector('[data-workspace-menu-trigger]').focus();document.querySelector('[data-workspace-menu-trigger]').click()`,
          );
          await until(
            () =>
              evaluate(
                `!!document.querySelector('[data-workspace-drawer][open]')`,
              ),
            "Drawer opens",
          );
          assert.equal(
            await evaluate(
              `document.querySelector('[data-workspace-drawer]').contains(document.activeElement)`,
            ),
            true,
          );
          await key("Escape", "Escape", 27);
          await until(
            () =>
              evaluate(
                `!document.querySelector('[data-workspace-drawer][open]')`,
              ),
            "Drawer Escape",
          );
          assert.equal(
            await evaluate(
              `document.activeElement===document.querySelector('[data-workspace-menu-trigger]')`,
            ),
            true,
          );
          if (width === 375 || width === 768) {
            await evaluate(
              `document.querySelector('[data-workspace-menu-trigger]').click()`,
            );
            await until(
              () =>
                evaluate(
                  `!!document.querySelector('[data-workspace-drawer][open]')`,
                ),
              "Drawer reopens",
            );
            if (width === 375) {
              await evaluate(
                `document.querySelector('[data-workspace-drawer] a[href="/account/profile"]').click()`,
              );
              await until(
                () =>
                  evaluate(
                    `location.pathname==='/account/profile' && !!document.querySelector('[data-account-profile]') && !document.querySelector('[data-workspace-drawer][open]')`,
                  ),
                "Drawer route dismissal",
              );
            } else {
              await call("Emulation.setDeviceMetricsOverride", {
                width: 1024,
                height: 1000,
                deviceScaleFactor: 1,
                mobile: false,
              });
              await until(
                () =>
                  evaluate(
                    `!document.querySelector('[data-workspace-drawer][open]') && document.querySelector('[data-workspace-menu-trigger]').getAttribute('aria-expanded')==='false'`,
                  ),
                "Drawer resize dismissal",
              );
              await call("Emulation.setDeviceMetricsOverride", {
                width,
                height: 1000,
                deviceScaleFactor: 1,
                mobile: false,
              });
            }
            checks++;
          }
        }
        checks++;
      }
    }
    await call("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await seed("FARMER", "en");
    await go("/account/profile?section=unknown");
    await until(
      () => evaluate(`!!document.querySelector('[data-account-profile]')`),
      "Unknown section defaults",
    );
    assert.equal(
      await evaluate(
        `document.querySelector('main nav a[aria-current]')?.getAttribute('href')`,
      ),
      "/account/profile?section=details",
    );
    const active = await evaluate(
      `(()=>{const a=document.querySelector('[data-workspace-nav="desktop"] a[aria-current="page"]');const css=getComputedStyle(a);return {color:css.color,bg:css.backgroundColor,decoration:css.textDecorationLine}})()`,
    );
    assert.deepEqual(active, {
      color: "rgb(162, 105, 19)",
      bg: "rgba(0, 0, 0, 0)",
      decoration: "none",
    });
    await evaluate(`document.querySelector('header details summary').focus()`);
    await key("Enter", "Enter", 13);
    await until(
      () => evaluate(`document.querySelector('header details').open`),
      "Account menu keyboard",
    );
    await key("Escape", "Escape", 27);
    assert.equal(
      await evaluate(
        `document.activeElement===document.querySelector('header details summary')`,
      ),
      true,
    );
    checks++;
    const farmerName = users.get("FARMER").name,
      farmerPhone = users.get("FARMER").maskedPhone;
    users.get("FARMER").name =
      "শামসুল আলম Long Farm Account Name That Must Wrap";
    users.get("FARMER").maskedPhone = null;
    users.get("FARMER").isEmailVerified = true;
    await call("Emulation.setDeviceMetricsOverride", {
      width: 320,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await go("/account/profile");
    await until(
      () => evaluate(`!!document.querySelector('[data-account-profile]')`),
      "Fallback profile",
    );
    assert.equal(
      await evaluate(`document.documentElement.scrollWidth>innerWidth`),
      false,
    );
    assert.ok(
      await evaluate(
        `document.querySelector('main').textContent.includes('Not provided') && document.querySelector('main').textContent.includes('Verified')`,
      ),
    );
    users.get("FARMER").name = farmerName;
    users.get("FARMER").maskedPhone = farmerPhone;
    users.get("FARMER").isEmailVerified = false;
    checks++;
    // 720 CSS pixels exercises 1440px desktop content reflow at a 200% zoom equivalent.
    await call("Emulation.setDeviceMetricsOverride", {
      width: 720,
      height: 1000,
      deviceScaleFactor: 2,
      mobile: false,
    });
    await go("/dashboard");
    await until(
      () => evaluate(`!!document.querySelector('[data-dashboard-role]')`),
      "Zoom-equivalent reflow",
    );
    assert.equal(
      await evaluate(`document.documentElement.scrollWidth>innerWidth`),
      false,
    );
    checks++;
    await call("Emulation.setDeviceMetricsOverride", {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await seed("FARMER", "en");
    users.get("FARMER").farmerOnboardingRequired = true;
    await go("/farm", "/account/farm-onboarding");
    await until(
      () => evaluate(`location.pathname==='/account/farm-onboarding'`),
      "Mandatory setup redirect",
    );
    users.get("FARMER").farmerOnboardingRequired = false;
    checks++;
    // Direct denied routes retain the shell but never render privileged forms.
    await seed("BUYER", "en");
    await go("/admin/administrative-access");
    await until(
      () =>
        evaluate(`document.querySelector('[data-workspace-denied]')!==null`),
      "Admin direct denial",
    );
    assert.equal(
      await evaluate(`!!document.querySelector('#target-email')`),
      false,
    );
    checks++;
    // Existing public browsing does not redirect on restored sessions.
    await go("/learning");
    await sleep(600);
    assert.equal(await evaluate(`location.pathname`), "/learning");
    checks++;
    // Signed-out protected entry resumes its local URL after modal login.
    await call("Network.deleteCookies", {
      name: "vetralink_access",
      url: origin,
    });
    await call("Network.deleteCookies", {
      name: "vetralink_refresh",
      url: origin,
    });
    await go("/account/profile?section=access");
    await until(
      () => evaluate(`!!document.querySelector('[data-workspace-sign-in]')`),
      "Protected login gate",
    );
    await evaluate(`document.querySelector('[data-auth-trigger]').click()`);
    await until(
      () => evaluate(`!!document.querySelector('dialog[open] #auth-email')`),
      "Login modal",
    );
    await evaluate(
      `(() => {const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;for(const [name,value] of Object.entries({email:'learner@example.test',password:'DemoPassword123!'})){const input=document.getElementById('auth-'+name);set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}})()`,
    );
    await evaluate(`document.querySelector('dialog form').requestSubmit()`);
    await until(
      () =>
        evaluate(
          `!!document.querySelector('[data-account-profile]') && !document.querySelector('dialog[open]')`,
        ),
      "Login resumes profile",
    );
    assert.equal(
      await evaluate(`location.pathname+location.search`),
      "/account/profile?section=access",
    );
    checks++;
    // A new public-page login lands on dashboard.
    await call("Network.deleteCookies", {
      name: "vetralink_access",
      url: origin,
    });
    await call("Network.deleteCookies", {
      name: "vetralink_refresh",
      url: origin,
    });
    await go("/learning");
    await until(
      () =>
        evaluate(
          `!!document.querySelector('[data-auth-trigger]:not(:disabled)')`,
        ),
      "Public auth ready",
    );
    await evaluate(`document.querySelector('[data-auth-trigger]').click()`);
    await until(
      () => evaluate(`!!document.querySelector('dialog[open] #auth-email')`),
      "Public login",
    );
    await evaluate(
      `(() => {const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;for(const [name,value] of Object.entries({email:'buyer@example.test',password:'DemoPassword123!'})){const input=document.getElementById('auth-'+name);set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}})()`,
    );
    await evaluate(`document.querySelector('dialog form').requestSubmit()`);
    await until(
      () =>
        evaluate(
          `location.pathname==='/dashboard' && !!document.querySelector('[data-dashboard-role="BUYER"]')`,
        ),
      "Explicit login landing",
    );
    checks++;
    // Learner public login/signup returns home with a direct profile link.
    for (const locale of ["bn", "en"]) {
      for (const mode of ["login", "register"]) {
        await seed("LEARNER", locale);
        await call("Network.deleteCookies", {
          name: "vetralink_access",
          url: origin,
        });
        await call("Network.deleteCookies", {
          name: "vetralink_refresh",
          url: origin,
        });
        await go("/learning");
        await until(
          () =>
            evaluate(
              `!!document.querySelector('[data-auth-trigger]:not(:disabled)')`,
            ),
          "Signed-out public controls",
        );
        await evaluate(`document.querySelector('[data-auth-trigger]').click()`);
        await until(
          () => evaluate(`!!document.querySelector('#auth-email')`),
          "Learner login dialog",
        );
        if (mode === "register") {
          await evaluate(
            `document.querySelector('dialog form').nextElementSibling.querySelector('button').click()`,
          );
          await until(
            () => evaluate(`!!document.querySelector('#auth-name')`),
            "Learner signup dialog",
          );
        }
        await evaluate(
          `(() => {const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;for(const [name,value] of Object.entries(${JSON.stringify(mode === "register" ? { name: "Synthetic Learner", email: "learner@example.test", password: "DemoPassword123!", confirmation: "DemoPassword123!" } : { email: "learner@example.test", password: "DemoPassword123!" })})){const input=document.getElementById('auth-'+name);set.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));}})()`,
        );
        await evaluate(`document.querySelector('dialog form').requestSubmit()`);
        await until(
          () =>
            evaluate(
              `location.pathname==='/' && !document.querySelector('dialog[open]') && !!document.querySelector('[data-profile-link]')`,
            ),
          "Learner " + mode + " home",
        );
        assert.equal(
          await evaluate(`!!document.querySelector('a[href="/dashboard"]')`),
          false,
        );
        await evaluate(
          `Array.from(document.querySelectorAll('[data-profile-link]')).find(a=>a.getClientRects().length).click()`,
        );
        await until(
          () =>
            evaluate(
              `location.pathname==='/account/profile' && !!document.querySelector('[data-account-profile]')`,
            ),
          "Direct learner profile",
        );
        await evaluate(
          `document.querySelector('header details summary').click()`,
        );
        assert.equal(
          await evaluate(
            `!!document.querySelector('header details a[href="/dashboard"]')`,
          ),
          false,
        );
        checks++;
      }
    }
    // Farm context: route identity, professional membership and revocation.
    for (const locale of ["bn", "en"])
      for (const role of ["FARMER", "BUYER", "VET"]) {
        await seed(role, locale);
        await go(`/app/farms/${farmA}`);
        await until(
          () =>
            evaluate(
              `document.querySelector('[data-selected-farm]')?.dataset.selectedFarm===${JSON.stringify(farmA)}`,
            ),
          "Authorized farm " + role,
        );
        assert.ok(
          await evaluate(
            `document.querySelector('main').textContent.includes('Synthetic Dairy A')`,
          ),
        );
        checks++;
      }
    await seed("FARMER", "en");
    delayMembers = true;
    await go(`/app/farms/${farmA}/members`);
    await until(
      () => evaluate(`!!document.getElementById('active-farm')`),
      "Farm selector ready",
    );
    await evaluate(
      `document.getElementById('active-farm').value=${JSON.stringify(farmB)};document.getElementById('active-farm').dispatchEvent(new Event('change',{bubbles:true}))`,
    );
    await until(
      () =>
        evaluate(
          `location.pathname===${JSON.stringify("/app/farms/" + farmB + "/members")} && document.querySelector('main').textContent.includes('Member B')`,
        ),
      "Switch to B",
    );
    await sleep(800);
    assert.equal(
      await evaluate(
        `document.querySelector('main').textContent.includes('Member A')`,
      ),
      false,
    );
    delayMembers = false;
    checks++;
    await go(`/app/farms/${farmA}`);
    await until(
      () =>
        evaluate(
          `document.querySelector('[data-farm-metric^="animals"]')?.textContent.includes('120')`,
        ),
      "Actual animal total",
    );
    await until(
      () =>
        evaluate(
          `document.querySelector('[data-farm-metric^="milk/"]')?.textContent.includes('No entry')`,
        ),
      "No milk entry",
    );
    checks++;
    milkRecords = 1;
    financeFailure = true;
    await go(`/app/farms/${farmA}`);
    await until(
      () =>
        evaluate(
          `document.querySelector('[data-farm-metric^="milk/"]')?.textContent.includes('0 liters')`,
        ),
      "Recorded zero milk",
    );
    await until(
      () =>
        evaluate(
          `!!document.querySelector('[data-farm-metric^="finance/"] [role="alert"]')`,
        ),
      "Independent finance error",
    );
    assert.ok(
      await evaluate(
        `document.querySelector('[data-farm-metric^="animals"]')?.textContent.includes('120')`,
      ),
    );
    financeFailure = false;
    checks++;
    await go(`/app/farms/${farmB}`);
    await until(
      () => evaluate(`!!document.querySelector('[data-selected-farm]')`),
      "Beef farm",
    );
    assert.equal(
      await evaluate(`!!document.querySelector('[data-farm-metric^="milk/"]')`),
      false,
    );
    checks++;
    revoked = true;
    await go(`/app/farms/${farmA}`);
    await until(
      () => evaluate(`!!document.querySelector('[data-farm-denied]')`),
      "Revoked membership",
    );
    assert.equal(
      await evaluate(`!!document.querySelector('[data-selected-farm]')`),
      false,
    );
    revoked = false;
    checks++;
    await seed("LEARNER");
    await go(`/app/farms/${farmA}`);
    await until(
      () => evaluate(`!!document.querySelector('[data-workspace-denied]')`),
      "Learner farm denial",
    );
    checks++;
    for (const locale of ["bn", "en"]) {
      await seed("FARMER", locale);
      await go(`/app/farms/${farmA}/animals/new`);
      await until(
        () =>
          evaluate(
            `!!document.querySelector('[data-animal-form] button[type="submit"]:not(:disabled)')`,
          ),
        "Registry write allowed",
      );
      const tag = "UI-" + locale.toUpperCase();
      await evaluate(
        `(() => {const inputSet=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set,selectSet=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;for(const [id,value] of Object.entries({tagNumber:${JSON.stringify(tag)},name:'Test animal',species:'COW',gender:'FEMALE',weightKg:'250.5'})){const field=document.getElementById(id);(field.tagName==='SELECT'?selectSet:inputSet).call(field,value);field.dispatchEvent(new Event(field.tagName==='SELECT'?'change':'input',{bubbles:true}));}})()`,
      );
      await evaluate(
        `document.querySelector('[data-animal-form]').requestSubmit();document.querySelector('[data-animal-form]').requestSubmit()`,
      );
      await until(
        () =>
          evaluate(
            `!!document.querySelector('[data-animal-detail]') && document.querySelector('main').textContent.includes(${JSON.stringify(tag)})`,
          ),
        "Created animal detail",
      );
      assert.equal(
        requests.filter(
          (r) =>
            r.method === "POST" &&
            r.route === "animals" &&
            r.body.tagNumber === tag,
        ).length,
        1,
      );
      await until(
        () =>
          evaluate(`!!document.querySelector('[data-animal-detail] button')`),
        "Edit available",
      );
      await evaluate(
        `document.querySelector('[data-animal-detail] button').click()`,
      );
      await until(
        () => evaluate(`!!document.querySelector('[data-animal-form]')`),
        "Edit form",
      );
      await evaluate(
        `(()=>{const input=document.getElementById('name');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Updated '+${JSON.stringify(locale)});input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
      );
      await until(
        () =>
          evaluate(
            `!!document.querySelector('[data-animal-form] button[type="submit"]:not(:disabled)')`,
          ),
        "Edit access loaded",
      );
      await evaluate(
        `document.querySelector('[data-animal-form]').requestSubmit()`,
      );
      await until(
        () =>
          evaluate(
            `!!document.querySelector('[data-animal-detail]') && !document.querySelector('[data-animal-form]') && document.querySelector('main').textContent.includes('Updated '+${JSON.stringify(locale)})`,
          ),
        "Partial edit saved",
      );
      const patch = requests.findLast(
        (r) => r.route.startsWith("animals/") && r.method === "PATCH",
      );
      assert.deepEqual(patch.body, { name: "Updated " + locale });
      checks++;
      await go(`/app/farms/${farmB}/animals/new`);
      await until(
        () =>
          evaluate(
            `!!document.querySelector('[data-animal-form] button[type="submit"]:not(:disabled)')`,
          ),
        "Second farm write",
      );
      await evaluate(
        `(() => {const inputSet=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set,selectSet=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;for(const [id,value] of Object.entries({tagNumber:${JSON.stringify(tag)},species:'COW',gender:'FEMALE'})){const field=document.getElementById(id);(field.tagName==='SELECT'?selectSet:inputSet).call(field,value);field.dispatchEvent(new Event(field.tagName==='SELECT'?'change':'input',{bubbles:true}));}})()`,
      );
      await evaluate(
        `document.querySelector('[data-animal-form]').requestSubmit()`,
      );
      await until(
        () => evaluate(`!!document.querySelector('[data-animal-detail]')`),
        "Same tag in other farm",
      );
      checks++;
      await go(`/app/farms/${farmA}/animals/new`);
      await until(
        () =>
          evaluate(
            `!!document.querySelector('[data-animal-form] button[type="submit"]:not(:disabled)')`,
          ),
        "Conflict form",
      );
      await evaluate(
        `(() => {const inputSet=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set,selectSet=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set;for(const [id,value] of Object.entries({tagNumber:${JSON.stringify(tag)},name:'Keep this name',species:'COW',gender:'FEMALE'})){const field=document.getElementById(id);(field.tagName==='SELECT'?selectSet:inputSet).call(field,value);field.dispatchEvent(new Event(field.tagName==='SELECT'?'change':'input',{bubbles:true}));}})()`,
      );
      await evaluate(
        `document.querySelector('[data-animal-form]').requestSubmit()`,
      );
      await until(
        () =>
          evaluate(
            `!!document.querySelector('[data-animal-form] [role="alert"]')`,
          ),
        "Duplicate tag feedback",
      );
      assert.equal(
        await evaluate(`document.getElementById('name').value`),
        "Keep this name",
      );
      checks++;
      await evaluate(
        `window.dispatchEvent(new Event('vetralink-session-updated'))`,
      );
      await sleep(350);
      assert.equal(
        await evaluate(`document.getElementById('name')?.value`),
        "Keep this name",
        "Background restore preserves typed form",
      );
      checks++;
      await evaluate(
        `window.confirm=()=>false;document.getElementById('active-farm').value=${JSON.stringify(farmB)};document.getElementById('active-farm').dispatchEvent(new Event('change',{bubbles:true}));`,
      );
      await evaluate(
        `document.querySelector('[data-workspace-nav="desktop"] a[href="/farm"]').click()`,
      );
      await sleep(150);
      assert.equal(
        await evaluate(`location.pathname`),
        `/app/farms/${farmA}/animals/new`,
      );
      checks++;
      await go(`/app/farms/${farmA}/animals?search=${tag}`);
      await until(
        () => evaluate(`!!document.querySelector('[data-animal-list]')`),
        "Filtered list",
      );
      assert.ok(
        await evaluate(
          `document.querySelector('[data-animal-list]').textContent.includes(${JSON.stringify(tag)})`,
        ),
      );
      checks++;
    }
    for (let i = 1; i <= 25; i++)
      herd.get(farmA).push({
        ...animalFixture,
        id: randomUUID(),
        farmId: farmA,
        tagNumber: "PAGE-" + String(i).padStart(2, "0"),
        species: "COW",
        status: "ACTIVE",
      });
    await seed("FARMER", "en");
    await go(
      `/app/farms/${farmA}/animals?search=PAGE-&species=COW&status=ACTIVE`,
    );
    await until(
      () =>
        evaluate(
          `!!document.querySelector('[data-animal-list] nav a[href*="page=2"]')`,
        ),
      "Pagination next",
    );
    assert.ok(
      await evaluate(
        `document.querySelector('[data-animal-list]').textContent.includes('PAGE-20')`,
      ),
    );
    await evaluate(
      `document.querySelector('[data-animal-list] nav a[href*="page=2"]').click()`,
    );
    await until(
      () =>
        evaluate(
          `document.querySelector('[data-animal-list]')?.textContent.includes('PAGE-21')===true`,
        ),
      "Second page",
    );
    assert.equal(
      await evaluate(`new URLSearchParams(location.search).get('page')`),
      "2",
    );
    assert.equal(
      await evaluate(`new URLSearchParams(location.search).get('species')`),
      "COW",
    );
    assert.equal(
      await evaluate(`new URLSearchParams(location.search).get('status')`),
      "ACTIVE",
    );
    assert.equal(
      await evaluate(`new URLSearchParams(location.search).get('search')`),
      "PAGE-",
    );
    await evaluate("history.back()");
    await until(
      () =>
        evaluate(
          `document.querySelector('[data-animal-list]')?.textContent.includes('PAGE-20')===true`,
        ),
      "Pagination history",
    );
    assert.equal(
      await evaluate(`new URLSearchParams(location.search).get('page')`),
      null,
    );
    checks++;
  }
  for (const legacy of [false, true]) {
    await seed("FARMER", "en");
    await go(`/app/farms/${farmA}/animals`);
    if (legacy)
      await evaluate(
        `(()=>{Object.defineProperty(window,'navigation',{value:undefined,configurable:true});return true})()`,
      );
    await until(
      () =>
        evaluate(
          `!!document.querySelector('main a[href="/app/farms/${farmA}/animals/new"]')`,
        ),
      "Registry route link",
    );
    await evaluate(
      `document.querySelector('main a[href="/app/farms/${farmA}/animals/new"]').click()`,
    );
    await until(
      () => evaluate(`!!document.querySelector('[data-animal-form]')`),
      "Draft form from link",
    );
    await evaluate(
      `(()=>{const input=document.getElementById('name');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Draft for history');input.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
    await until(
      () => evaluate(`document.querySelector('[data-farm-dirty]')!==null`),
      "Draft dirty guard ready",
    );
    await sleep(150);
    await evaluate(
      `window.confirmCalls=0;window.confirm=()=>{window.confirmCalls++;return false};history.back()`,
    );
    await sleep(300);
    assert.equal(await evaluate("window.confirmCalls"), 1);
    assert.equal(
      await evaluate(`location.pathname`),
      `/app/farms/${farmA}/animals/new`,
    );
    assert.equal(
      await evaluate(`document.getElementById('name')?.value`),
      "Draft for history",
    );
    checks++;
    await evaluate(`window.confirm=()=>true;history.back()`);
    await until(
      () =>
        evaluate(
          `location.pathname===${JSON.stringify("/app/farms/" + farmA + "/animals")} && !!document.querySelector('[data-animal-list]')`,
        ),
      "Confirmed history exit",
    );
    checks++;
  }
  await seed("FARMER", "en");
  readOnly = true;
  await go(`/app/farms/${farmA}/animals/new`);
  await until(
    () => evaluate(`!!document.querySelector('[data-animal-form]')`),
    "Read-only form",
  );
  await sleep(300);
  assert.equal(
    await evaluate(
      `document.querySelector('[data-animal-form] button[type="submit"]').disabled`,
    ),
    true,
  );
  readOnly = false;
  quotaFull = true;
  await go(`/app/farms/${farmA}/animals/new`);
  await until(
    () =>
      evaluate(
        `document.querySelector('main').textContent.includes('reached its animal quota')`,
      ),
    "Quota blocked",
  );
  assert.equal(
    await evaluate(
      `document.querySelector('[data-animal-form] button[type="submit"]').disabled`,
    ),
    true,
  );
  quotaFull = false;
  checks++;
  assert.deepEqual(exceptions, []);
  console.log(
    `Passed ${checks} ${focus ? "history draft/confirmation and access" : "dashboard/profile, responsive, farm, registry and login"} checks. Screenshots: ${temp}`,
  );
} finally {
  ws?.close();
  chrome?.kill();
  next?.kill();
  await new Promise((resolve) => upstream.close(resolve));
}
