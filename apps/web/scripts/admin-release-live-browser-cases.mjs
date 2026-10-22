// Used only by the guarded disposable-database workspace browser harness.
import assert from "node:assert/strict";

export async function checkRealAdminRelease({
  client,
  db,
  fixtures,
  password,
  apiRequest,
  origin,
  shot,
}) {
  let checks = 0;
  const responses = [],
    failures = [],
    pending = new Set();
  const listener = ({ data }) => {
    const value = JSON.parse(data),
      p = value.params;
    if (value.method === "Network.loadingFailed" && pending.has(p.requestId))
      failures.push(p.errorText);
    if (
      value.method === "Network.requestWillBeSent" &&
      p.request.url.startsWith(origin + "/api/workspace/")
    )
      pending.add(p.requestId);
    if (value.method === "Network.responseReceived" && pending.has(p.requestId))
      responses.push({
        path: new URL(p.response.url).pathname,
        status: p.response.status,
      });
    if (
      ["Network.loadingFinished", "Network.loadingFailed"].includes(
        value.method,
      )
    )
      pending.delete(p.requestId);
  };
  client.ws.addEventListener("message", listener);
  await client.call("Network.enable");
  async function until(check, message) {
    const end = Date.now() + 20000;
    while (Date.now() < end) {
      if (await check()) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(message);
  }
  const cookie = (name, value, httpOnly = true) =>
    client.call("Network.setCookie", {
      name,
      value,
      url: origin,
      httpOnly,
      sameSite: "Lax",
    });
  async function session(user, locale) {
    const auth = await apiRequest("auth/login", "POST", {
      email: user.email,
      password,
    });
    await cookie("vetralink_access", auth.tokens.accessToken);
    await cookie("vetralink_refresh", auth.tokens.refreshToken);
    await cookie("vetralink-locale", locale, false);
    return auth.tokens.refreshToken;
  }
  async function visit(route) {
    const before = responses.length;
    pending.clear();
    failures.length = 0;
    await client.call("Page.navigate", { url: origin + route });
    await until(
      () =>
        client.evaluate(
          `location.pathname===${JSON.stringify(route)} && document.readyState==='complete' && !!document.querySelector('[data-workspace-shell] main h1')`,
        ),
      "Real admin page missing: " + route,
    );
    const paths = expectedPaths[route];
    assert.ok(paths, "Declare expected BFF reads for " + route);
    await until(
      () =>
        Promise.resolve(
          paths.every((path) =>
            responses
              .slice(before)
              .some((r) => r.path === "/api/workspace/" + path),
          ) && pending.size === 0,
        ),
      "Real admin data did not finish: " +
        route +
        " (inspect pending request diagnostics)",
    );
    assert.deepEqual(failures, [], route + " transport failures");
    await until(
      () =>
        client.evaluate(
          `!document.querySelector('main [aria-busy="true"]') && ![...document.querySelectorAll('main [role="status"]')].some(el=>/Loading|লোড হচ্ছে|তথ্য আসছে/.test(el.textContent))`,
        ),
      "Real admin content still loading: " + route,
    );
    if (route === "/admin/dashboard") {
      assert.equal(
        await client.evaluate(
          "document.querySelectorAll('[data-admin-count]').length",
        ),
        7,
      );
      assert.equal(
        await client.evaluate(
          "!!document.querySelector('[data-admin-applications] [data-review-link], [data-admin-applications] [data-admin-empty]')",
        ),
        true,
      );
    }
    await client.evaluate(
      "new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))",
    );
    assert.deepEqual(
      responses.slice(before).filter((r) => r.status >= 400),
      [],
      route + " BFF errors",
    );
    assert.equal(
      await client.evaluate("!!document.querySelector('main [role=alert]')"),
      false,
      route + " rendered error",
    );
    assert.equal(
      await client.evaluate("document.documentElement.scrollWidth>innerWidth"),
      false,
      route + " overflow",
    );
    checks += 3;
  }
  const expectedPaths = {
    "/admin/dashboard": ["admin/overview", "admin/role-requests"],
    "/admin/role-requests": ["admin/role-requests"],
    "/admin/users": ["admin/directory/users"],
    "/admin/veterinarians": ["admin/directory/veterinarians"],
    "/admin/farms": ["admin/directory/farms"],
    "/admin/audit": ["admin/directory/audit"],
    "/admin/products": ["admin/products"],
    "/admin/courses": ["admin/products"],
    "/admin/media": ["admin/media", "admin/products"],
    "/admin/orders": ["admin/billing/orders"],
    "/admin/subscriptions": ["admin/billing/subscriptions"],
    "/admin/plans": ["admin/billing/plans"],
    "/admin/dunning": ["admin/billing/dunning"],
    "/admin/triage": ["admin/consultations"],
    "/admin/consultations": ["admin/consultations"],
    "/admin/settlements": ["admin/settlements", "admin/settlements/summary"],
    "/admin/reviews": ["admin/reviews"],
    "/admin/content": ["admin/content"],
    "/admin/notifications": ["admin/notifications"],
    "/admin/support": ["admin/support"],
    "/admin/metrics": ["admin/platform/reports"],
    "/admin/reports": ["admin/platform/reports"],
    "/admin/settings": ["admin/platform/settings"],
    "/admin/settings/integrations": ["admin/platform/integrations"],
    "/admin/system": ["admin/platform/system"],
    "/admin/administrative-access": ["admin/users"],
  };
  const routes = [
    "dashboard",
    "role-requests",
    "users",
    "veterinarians",
    "farms",
    "products",
    "courses",
    "media",
    "orders",
    "subscriptions",
    "plans",
    "dunning",
    "triage",
    "consultations",
    "settlements",
    "reviews",
    "content",
    "notifications",
    "support",
    "audit",
    "metrics",
    "reports",
  ];
  try {
    for (const key of ["admin", "super"]) {
      const user = fixtures[key];
      for (const locale of ["bn", "en"]) {
        const refreshToken = await session(user, locale);
        try {
          for (const width of [320, 1440]) {
            await client.call("Emulation.setDeviceMetricsOverride", {
              width,
              height: 1000,
              deviceScaleFactor: 1,
              mobile: width < 800,
            });
            for (const name of routes) await visit("/admin/" + name);
            if (key === "super")
              for (const route of [
                "/admin/settings",
                "/admin/settings/integrations",
                "/admin/system",
                "/admin/administrative-access",
              ])
                await visit(route);
            if (width === 320) {
              await client.evaluate(
                "document.querySelector('[data-workspace-menu-trigger]').focus()",
              );
              for (const type of ["keyDown", "keyUp"])
                await client.call("Input.dispatchKeyEvent", {
                  type,
                  key: "Enter",
                  code: "Enter",
                  windowsVirtualKeyCode: 13,
                  ...(type === "keyDown"
                    ? { text: "\r", unmodifiedText: "\r" }
                    : {}),
                });
              await until(
                () =>
                  client.evaluate(
                    "!!document.querySelector('#workspace-drawer[open]')",
                  ),
                "Keyboard drawer did not open",
              );
              assert.equal(
                await client.evaluate(
                  "document.querySelector('#workspace-drawer').contains(document.activeElement)",
                ),
                true,
              );
              checks++;
              for (const type of ["keyDown", "keyUp"])
                await client.call("Input.dispatchKeyEvent", {
                  type,
                  key: "Escape",
                  code: "Escape",
                  windowsVirtualKeyCode: 27,
                });
              await until(
                () =>
                  client.evaluate(
                    "!document.querySelector('#workspace-drawer[open]') && document.activeElement.hasAttribute('data-workspace-menu-trigger')",
                  ),
                "Keyboard drawer focus did not return",
              );
              checks++;
            }
            await shot(`adm9-real-${user.role}-${locale}-${width}`);
          }
          if (key === "admin") {
            for (const route of [
              "/admin/settings",
              "/admin/system",
              "/admin/administrative-access",
            ]) {
              const result = await client.evaluate(
                `fetch(${JSON.stringify(route)},{redirect:'follow'}).then(r=>new URL(r.url).pathname)`,
              );
              assert.equal(result, "/admin/dashboard");
              checks++;
            }
            assert.equal(
              await client.evaluate(
                "fetch('/api/workspace/admin/platform/settings').then(r=>r.status)",
              ),
              403,
            );
            checks++;
          }
        } finally {
          await apiRequest("auth/logout", "POST", { refreshToken });
        }
      }
    }
    // One real confirmed BFF write, persistence, stale replay and audit boundary.
    const user = fixtures.super,
      refreshToken = await session(user, "en");
    try {
      await visit("/admin/settings");
      const before = await client.evaluate(
        "fetch('/api/workspace/admin/platform/settings').then(r=>r.json()).then(r=>r.data)",
      );
      const payload = {
        organizationBn: "সমন্বিত গ্রহণযোগ্যতা",
        organizationEn: "Synthetic ADM9 acceptance",
        supportEmail: "acceptance@example.test",
        reportTimezone: "Asia/Dhaka",
        expectedVersion: before.version,
        actorPassword: password,
        reason: "Synthetic real BFF acceptance",
        confirmed: true,
      };
      const save = (body) =>
        client.evaluate(
          `fetch('/api/workspace/admin/platform/settings',{method:'POST',headers:{'Content-Type':'application/json','X-Workspace-Actor':${JSON.stringify(`${user.id}:${user.role}:${user.roleVersion}`)}},body:${JSON.stringify(JSON.stringify(body))}}).then(async r=>({status:r.status,body:await r.json()}))`,
        );
      const denied = await save({
        ...payload,
        actorPassword: "deliberately-wrong",
      });
      assert.equal(denied.status, 403);
      assert.equal(denied.body.code, "PASSWORD_CONFIRMATION_FAILED");
      checks++;
      const result = await save(payload);
      assert.equal(result.status, 201);
      checks++;
      assert.equal(result.body.data.version, before.version + 1);
      checks++;
      await visit("/admin/settings");
      const stored = await db.platformSettings.findUniqueOrThrow({
        where: { id: "00000000-0000-4000-8000-000000000008" },
      });
      assert.equal(stored.organizationEn, payload.organizationEn);
      checks++;
      assert.equal((await save(payload)).status, 409);
      checks++;
      assert.equal(
        await db.auditLog.count({
          where: { userId: user.id, action: "PLATFORM_SETTINGS_UPDATED" },
        }),
        1,
      );
      checks++;
    } finally {
      await apiRequest("auth/logout", "POST", { refreshToken });
    }
    // Actual ordinary-role sessions are denied at both server-rendered and BFF boundaries.
    for (const role of ["LEARNER", "FARMER", "BUYER", "VET"]) {
      const user = await db.user.create({
        data: {
          name: "Synthetic ADM9 denied role",
          email: `adm9-${crypto.randomUUID()}@browser.example.test`,
          passwordHash: fixtures.admin.passwordHash,
          role,
          farmerOnboardingRequired: false,
        },
      });
      const refreshToken = await session(user, "en");
      try {
        const result = await client.evaluate(
          "fetch('/admin/reports').then(async r=>({path:new URL(r.url).pathname,body:await r.text()}))",
        );
        assert.notEqual(result.path, "/admin/reports");
        checks++;
        assert.doesNotMatch(result.body, /data-platform-report/);
        checks++;
        assert.equal(
          await client.evaluate(
            "fetch('/api/workspace/admin/platform/reports?from=2026-10-01&to=2026-10-22&timezone=Asia%2FDhaka').then(r=>r.status)",
          ),
          403,
        );
        checks++;
      } finally {
        await apiRequest("auth/logout", "POST", { refreshToken });
        await db.user.delete({ where: { id: user.id } });
      }
    }
    assert.deepEqual(client.exceptions, []);
    console.log(
      `Passed ${checks} real API/database admin browser checks (bn/en, 320/1440px, both admin roles, ordinary-role denial, confirmed write/replay/audit).`,
    );
  } finally {
    client.ws.removeEventListener("message", listener);
  }
}
