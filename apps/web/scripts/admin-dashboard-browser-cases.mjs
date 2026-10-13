import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";

const state = { metrics: "ready", queue: "ready" };
const applicationId = "990e8400-e29b-41d4-a716-446655440001";
const counts = {
  asOfDate: "2026-10-13T00:00:00.000Z",
  totalSubscriptionsCount: 20,
  activeSubscriptionsCount: 12,
  activePayingSubscriptionsCount: 10,
  trialingSubscriptionsCount: 3,
  pastDueSubscriptionsCount: 2,
  canceledSubscriptionsCount: 2,
  expiredSubscriptionsCount: 1,
};
export function handleAdminFixture(route, role, send) {
  if (route === "subscriptions/metrics/summary") {
    if (!["ADMIN", "SUPER_ADMIN"].includes(role)) send(403, null);
    else if (state.metrics === "error") send(503, null);
    else if (state.metrics === "malformed")
      send(200, { ...counts, totalSubscriptionsCount: -1 });
    else if (state.metrics === "invalid-date")
      send(200, { ...counts, asOfDate: "2026-10-13T00:00:00+99:99" });
    else
      send(
        200,
        state.metrics === "zero"
          ? Object.fromEntries(
              Object.entries(counts).map(([key, value]) => [
                key,
                key === "asOfDate" ? value : 0,
              ]),
            )
          : {
              ...counts,
              mrrCents: 900000,
              providerSecret: "synthetic-private-field",
            },
      );
    return true;
  }
  if (route === "admin/role-requests") {
    if (!["ADMIN", "SUPER_ADMIN"].includes(role)) send(403, null);
    else if (state.queue === "error") send(503, null);
    else
      send(200, {
        requests:
          state.queue === "empty"
            ? []
            : [
                {
                  id: applicationId,
                  targetRole: "VET",
                  status: "PENDING",
                  submittedAt: "2026-10-12T12:00:00Z",
                  applicant: {
                    id: "550e8400-e29b-41d4-a716-446655440000",
                    name: "Synthetic applicant · আবেদনকারী",
                    email: "applicant@example.test",
                  },
                },
              ],
        nextCursor: null,
      });
    return true;
  }
  if (route === "admin/users/administrative-access") {
    send(role === "SUPER_ADMIN" ? 200 : 403, { users: [], nextCursor: null });
    return true;
  }
  return false;
}

export async function checkAdminDashboard({
  seed,
  go,
  call,
  evaluate,
  until,
  requests,
  origin,
  temp,
  users,
}) {
  let checks = 0;
  const ready = () =>
    until(
      () =>
        evaluate(
          `!!document.querySelector('[data-admin-count="totalSubscriptionsCount"]') && !!document.querySelector('[data-admin-applications] a[data-review-link]')`,
        ),
      "Admin overview and applications ready",
    );
  for (const locale of ["bn", "en"]) {
    for (const role of ["ADMIN", "SUPER_ADMIN"]) {
      await seed(role, locale);
      await go("/admin", "/admin/dashboard");
      await ready();
      const n = new Intl.NumberFormat(
        locale === "bn" ? "bn-BD" : "en-GB",
      ).format(20);
      assert.equal(
        await evaluate(
          `document.querySelector('[data-admin-count="totalSubscriptionsCount"]').textContent.trim()`,
        ),
        n,
      );
      assert.equal(
        await evaluate(
          `!!document.querySelector('[data-admin-overview] time[datetime="2026-10-13T00:00:00.000Z"]')`,
        ),
        true,
      );
      assert.equal(
        await evaluate(
          `document.querySelector('[data-admin-applications] a[data-review-link]').getAttribute('href')`,
        ),
        `/admin/role-requests/${applicationId}`,
      );
      assert.equal(
        await evaluate(
          `document.querySelectorAll('[data-workspace-nav="desktop"] a[aria-current="page"]').length`,
        ),
        1,
      );
      assert.doesNotMatch(
        await evaluate(`document.querySelector('main').textContent`),
        /900000|synthetic-private-field|MRR|ARR/,
      );
      await go("/admin/role-requests?status=PENDING");
      await until(
        () =>
          evaluate(
            `!!document.querySelector('#review-status') && document.querySelector('main').textContent.includes('Synthetic applicant')`,
          ),
        "Existing review queue integrated",
      );
      await go(
        "/admin/administrative-access",
        role === "SUPER_ADMIN"
          ? "/admin/administrative-access"
          : "/admin/dashboard",
      );
      await until(
        () =>
          evaluate(
            role === "SUPER_ADMIN"
              ? `!!document.querySelector('#email')`
              : `!!document.querySelector('[data-admin-dashboard]')`,
          ),
        "Super-only access integration",
      );
      checks += 3;
      for (const width of [320, 375, 768, 1024, 1440]) {
        await call("Emulation.setDeviceMetricsOverride", {
          width,
          height: 1000,
          deviceScaleFactor: 1,
          mobile: false,
        });
        await go("/admin/dashboard");
        await ready();
        assert.equal(
          await evaluate(`document.documentElement.scrollWidth > innerWidth`),
          false,
        );
        assert.equal(
          await evaluate(`document.querySelectorAll('main').length`),
          1,
        );
        assert.equal(
          await evaluate(`document.querySelectorAll('h1').length`),
          1,
        );
        if (width === 320) {
          await evaluate(
            `document.querySelector('[aria-controls="workspace-drawer"]').click()`,
          );
          await until(
            () =>
              evaluate(`!!document.querySelector('#workspace-drawer[open]')`),
            "Admin mobile drawer opens",
          );
          assert.equal(
            await evaluate(
              `document.querySelectorAll('#workspace-drawer a[href="/admin/administrative-access"]').length`,
            ),
            role === "SUPER_ADMIN" ? 1 : 0,
          );
          await call("Input.dispatchKeyEvent", {
            type: "keyDown",
            key: "Escape",
            code: "Escape",
            windowsVirtualKeyCode: 27,
          });
          await call("Input.dispatchKeyEvent", {
            type: "keyUp",
            key: "Escape",
            code: "Escape",
            windowsVirtualKeyCode: 27,
          });
          await until(
            () =>
              evaluate(`!document.querySelector('#workspace-drawer[open]')`),
            "Admin drawer Escape",
          );
        }
        const shot = await call("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: true,
        });
        await writeFile(
          path.join(temp, `admin-${role}-${locale}-${width}.png`),
          Buffer.from(shot.data, "base64"),
        );
        checks++;
      }
    }
  }
  await call("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  });
  for (const role of ["LEARNER", "FARMER", "BUYER", "VET"]) {
    for (const destination of [
      "/admin/dashboard",
      "/admin/role-requests",
      "/admin/administrative-access",
    ]) {
      const response = await fetch(origin + destination, {
        redirect: "manual",
        headers: { Cookie: `vetralink_access=a-${role}` },
      });
      assert.equal(response.status, 307);
      assert.equal(
        new URL(response.headers.get("location"), origin).pathname,
        "/account/profile",
      );
      assert.doesNotMatch(
        await response.text(),
        /data-admin-dashboard|data-workspace-shell/,
      );
    }
    await seed(role);
    await go("/admin/dashboard", "/account/profile");
    const status = await evaluate(
      `fetch('/api/workspace/admin/overview').then(r=>r.status)`,
    );
    assert.equal(status, 403);
    checks++;
  }
  await seed("ADMIN");
  for (const failure of ["error", "malformed", "invalid-date"]) {
    state.metrics = failure;
    await go("/admin/dashboard");
    await until(
      () =>
        evaluate(
          `!!document.querySelector('[data-admin-overview] [role="alert"]') && !!document.querySelector('[data-review-link]')`,
        ),
      "Independent overview error",
    );
    assert.equal(
      await evaluate(`document.querySelectorAll('[data-admin-count]').length`),
      0,
    );
    const queueCalls = requests.filter(
      (r) => r.route === "admin/role-requests",
    ).length;
    state.metrics = "ready";
    await evaluate(
      `document.querySelector('[data-admin-overview] [data-admin-retry]').click()`,
    );
    await ready();
    assert.equal(
      requests.filter((r) => r.route === "admin/role-requests").length,
      queueCalls,
    );
    checks++;
  }
  state.queue = "error";
  await go("/admin/dashboard");
  await until(
    () =>
      evaluate(
        `!!document.querySelector('[data-admin-applications] [role="alert"]') && !!document.querySelector('[data-admin-count]')`,
      ),
    "Independent queue failure",
  );
  state.queue = "ready";
  await evaluate(
    `document.querySelector('[data-admin-applications] [data-admin-retry]').click()`,
  );
  await ready();
  state.metrics = "zero";
  state.queue = "empty";
  await go("/admin/dashboard");
  await until(
    () =>
      evaluate(
        `document.querySelector('[data-admin-count="totalSubscriptionsCount"]')?.textContent.trim()==='0' && !!document.querySelector('[data-admin-empty]')`,
      ),
    "Real zero and empty queue",
  );
  state.metrics = "ready";
  state.queue = "ready";
  checks += 2;
  await go("/admin/dashboard");
  await ready();
  users.get("ADMIN").role = "BUYER";
  users.get("ADMIN").roleVersion++;
  await evaluate(
    `window.dispatchEvent(new Event('vetralink-session-updated'))`,
  );
  await until(
    () =>
      evaluate(
        `!!document.querySelector('[data-workspace-denied]') && !document.querySelector('[data-admin-count]')`,
      ),
    "Demotion removes admin data",
  );
  assert.equal(
    await evaluate(`fetch('/api/workspace/admin/overview').then(r=>r.status)`),
    403,
  );
  users.get("ADMIN").role = "ADMIN";
  users.get("ADMIN").roleVersion++;
  checks++;
  for (const role of ["ADMIN", "SUPER_ADMIN"]) {
    for (const name of ["vetralink_access", "vetralink_refresh"])
      await call("Network.deleteCookies", { name, url: origin });
    await go("/learning");
    await until(
      () =>
        evaluate(
          `!!document.querySelector('[data-auth-trigger]:not(:disabled)')`,
        ),
      "Admin public sign-in ready",
    );
    await evaluate(`document.querySelector('[data-auth-trigger]').click()`);
    await until(
      () => evaluate(`!!document.querySelector('dialog[open] #auth-email')`),
      "Admin sign-in dialog",
    );
    const credentials = {
      email: users.get(role).email,
      password: "DemoPassword123!",
    };
    await evaluate(
      `(() => { const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; for (const [name, value] of Object.entries(${JSON.stringify(credentials)})) { const input = document.getElementById('auth-' + name); set.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); } })()`,
    );
    await evaluate(`document.querySelector('dialog form').requestSubmit()`);
    await until(
      () =>
        evaluate(
          `location.pathname === '/admin/dashboard' && !!document.querySelector('[data-dashboard-role="${role}"]')`,
        ),
      "Admin explicit login destination",
    );
    await ready();
    await evaluate(
      `document.querySelector('[data-workspace-nav="desktop"] a[href="/"]').click()`,
    );
    await until(
      () =>
        evaluate(
          `location.pathname === '/' && !!document.querySelector('[data-avatar-trigger]')`,
        ),
      "Admin returns to public Home",
    );
    await evaluate(`document.querySelector('[data-avatar-trigger]').click()`);
    await until(
      () => evaluate(`!!document.querySelector('[data-public-signout]')`),
      "Admin sign-out available",
    );
    await evaluate(`document.querySelector('[data-public-signout]').click()`);
    await until(
      () =>
        evaluate(
          `!!document.querySelector('[data-auth-trigger]:not(:disabled)')`,
        ),
      "Admin sign-out completes",
    );
    await evaluate(`history.back()`);
    await until(
      () =>
        evaluate(
          `location.pathname === '/' && !!document.querySelector('dialog[open] #auth-email') && !document.querySelector('[data-workspace-shell]') && !document.querySelector('[data-admin-count]')`,
        ),
      "Admin logout clears cached dashboard on Back",
    );
    checks += 2;
  }
  return checks;
}
