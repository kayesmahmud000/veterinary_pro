import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import {
  platformId,
  platformSettingsFixture,
  platformSystemFixture,
  platformIntegrationFixture,
  platformReportFixture,
  platformAuditFixture,
} from "./admin-platform-fixtures.mjs";
let settings = structuredClone(platformSettingsFixture);
export const platformState = {
  failure: false,
  conflict: false,
  writeFailure: false,
  malformed: false,
};
export function handlePlatformFixture(req, res, data, route, role) {
  if (!route.startsWith("admin/platform/")) return false;
  const send = (status, value, code) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(
      JSON.stringify({
        success: status < 400,
        data: value,
        ...(code ? { errorDetails: { title: code } } : {}),
      }),
    );
    return true;
  };
  if (!["ADMIN", "SUPER_ADMIN"].includes(role)) return send(403, null);
  const type = route.split("/")[2];
  if (!["reports", "audit-export"].includes(type) && role !== "SUPER_ADMIN")
    return send(403, null);
  if (
    platformState.failure ||
    (platformState.writeFailure && req.method === "POST")
  )
    return send(503, null);
  if (req.method === "GET") {
    if (type === "settings") return send(200, settings);
    if (type === "system") return send(200, platformSystemFixture);
    if (type === "integrations") return send(200, platformIntegrationFixture);
    if (type === "reports") {
      const query = Object.fromEntries(
        new URL(req.url, "http://fixture").searchParams,
      );
      const report = platformReportFixture(query, settings);
      return send(
        200,
        platformState.malformed
          ? { ...report, privateSecret: "SYNTHETIC_PRIVATE" }
          : report,
      );
    }
  }
  if (data.actorPassword !== "DemoPassword123!")
    return send(403, null, "PASSWORD_CONFIRMATION_FAILED");
  if (type === "settings") {
    if (platformState.conflict || data.expectedVersion !== settings.version)
      return send(409, null, "SETTINGS_CONFLICT");
    const { organizationBn, organizationEn, supportEmail, reportTimezone } =
      data;
    settings = {
      organizationBn,
      organizationEn,
      supportEmail,
      reportTimezone,
      version: settings.version + 1,
      updatedAt: new Date().toISOString(),
    };
    return send(200, settings);
  }
  if (type === "diagnostics")
    return send(200, {
      requestId: data.requestId,
      result: platformSystemFixture,
    });
  if (type === "reports")
    return send(200, {
      exportId: platformId,
      report: platformReportFixture(data.query, settings),
    });
  if (type === "audit-export")
    return send(200, platformAuditFixture(data.query));
  return send(404, null);
}
export async function checkAdminPlatform({
  seed,
  go,
  call,
  evaluate,
  until,
  temp,
  requests,
}) {
  let checks = 0;
  const set = (id, value) =>
    evaluate(
      `(()=>{const e=document.getElementById(${JSON.stringify(id)});const proto=e.tagName==='SELECT'?HTMLSelectElement.prototype:e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e.tagName==='SELECT'?'change':'input',{bubbles:true}));})()`,
    );
  const wait = (text) =>
    until(
      () =>
        evaluate(
          `document.querySelector('main').textContent.includes(${JSON.stringify(text)})`,
        ),
      text,
    );
  const action = async (route, password = "DemoPassword123!") => {
    const selector = `document.querySelector('[data-platform-action="${route}"]')`;
    const fields = await evaluate(
      `(()=>{const s=${selector};return {reason:s.querySelector('textarea').id,password:s.querySelector('input[type=password]').id};})()`,
    );
    await set(fields.reason, "Reviewed synthetic platform action");
    await set(fields.password, password);
    await evaluate(`(${selector}).querySelector('form').requestSubmit()`);
    await until(
      () => evaluate(`!!document.querySelector('dialog[open]')`),
      "Confirmation opened",
    );
    await evaluate(`document.querySelector('dialog[open] button').click()`);
    await until(
      () => evaluate(`!document.querySelector('dialog[open]')`),
      "Confirmation completed",
    );
  };
  const noOverflow = async () => {
    assert.equal(
      await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`),
      true,
    );
    checks++;
  };
  for (const role of ["ADMIN", "SUPER_ADMIN"])
    for (const locale of ["bn", "en"])
      for (const width of [320, 1440]) {
        settings = structuredClone(platformSettingsFixture);
        await seed(role, locale);
        await call("Emulation.setDeviceMetricsOverride", {
          width,
          height: 1000,
          deviceScaleFactor: 1,
          mobile: width < 600,
        });
        await go("/admin/metrics");
        await until(
          () => evaluate(`!!document.querySelector('[data-platform-report]')`),
          "Metrics loaded",
        );
        assert.equal(
          await evaluate(
            `document.querySelector('main').textContent.includes('USD') && document.querySelector('main').textContent.includes('BDT')`,
          ),
          true,
        );
        checks++;
        assert.equal(
          await evaluate(
            `document.querySelectorAll('main [data-platform-action]').length`,
          ),
          0,
        );
        checks++;
        await noOverflow();
        await go("/admin/reports");
        await until(
          () => evaluate(`!!document.querySelector('[data-platform-report]')`),
          "Reports loaded",
        );
        await set("from", "2026-10-01");
        await set("to", "2026-10-02");
        await set("timezone", "UTC");
        await evaluate(
          `document.getElementById('from').closest('form').requestSubmit()`,
        );
        await wait("2026-10-01T00:00:00.000Z");
        checks++;
        await action("admin/platform/reports/export");
        await until(
          () =>
            evaluate(
              `!!document.querySelector('[data-platform-artifact] a[download]')`,
            ),
          "Download ready",
        );
        const exported = await evaluate(
          `fetch(document.querySelector('[data-platform-artifact] a').href).then(r=>r.json())`,
        );
        assert.equal(exported.report.range.timezone, "UTC");
        assert.equal(exported.report.orders[1].totalMinor, "9007199254740993");
        checks += 2;
        await set("audit-action", "USER_SUSPENDED");
        assert.equal(
          await evaluate(
            `!!document.querySelector('[data-platform-artifact]')`,
          ),
          false,
        );
        checks++;
        await action("admin/platform/audit-export");
        await until(
          () =>
            evaluate(`!!document.querySelector('[data-platform-artifact] a')`),
          "Audit ready",
        );
        const audit = await evaluate(
          `fetch(document.querySelector('[data-platform-artifact] a').href).then(r=>r.json())`,
        );
        assert.equal(audit.items[0].action, "USER_SUSPENDED");
        assert.equal(audit.items[0].newValues, undefined);
        checks += 2;
        await noOverflow();
        if (role === "SUPER_ADMIN") {
          await go("/admin/settings");
          await until(
            () => evaluate(`!!document.getElementById('organizationEn')`),
            "Settings ready",
          );
          await set("organizationEn", "Saved synthetic organization");
          await action("admin/platform/settings");
          await wait(locale === "bn" ? "সংরক্ষিত হয়েছে" : "Saved.");
          await go("/admin/settings");
          await until(
            () =>
              evaluate(
                `document.getElementById('organizationEn')?.value==='Saved synthetic organization'`,
              ),
            "Saved settings persisted",
          );
          checks++;
          await go("/admin/settings/integrations");
          await wait(
            locale === "bn"
              ? "কনফিগার করা, যাচাই হয়নি"
              : "Configured, unverified",
          );
          await wait(locale === "bn" ? "মক প্রোভাইডার" : "Mock provider");
          await noOverflow();
          checks++;
          await go("/admin/system");
          await wait("transactional-mail");
          await action("admin/platform/diagnostics");
          await wait(
            locale === "bn" ? "স্ন্যাপশট সংরক্ষিত" : "snapshot recorded",
          );
          await noOverflow();
          checks++;
        } else {
          for (const route of [
            "/admin/settings",
            "/admin/settings/integrations",
            "/admin/system",
          ]) {
            await go(route, "/admin/dashboard");
            assert.equal(
              await evaluate(`location.pathname`),
              "/admin/dashboard",
            );
            checks++;
          }
        }
        await go("/admin/reports");
        await until(
          () => evaluate(`!!document.querySelector('[data-platform-report]')`),
          "Report screenshot ready",
        );
        const screenshot = await call("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: true,
        });
        await writeFile(
          path.join(temp, `platform-${role}-${locale}-${width}.png`),
          Buffer.from(screenshot.data, "base64"),
        );
      }
  await seed("SUPER_ADMIN", "en");
  await go("/admin/settings");
  await until(
    () => evaluate(`!!document.getElementById('organizationEn')`),
    "Failure settings ready",
  );
  await set("organizationEn", "Retained synthetic draft");
  await action("admin/platform/settings", "wrong");
  await wait("Password confirmation failed");
  assert.equal(
    await evaluate(`document.getElementById('organizationEn').value`),
    "Retained synthetic draft",
  );
  checks++;
  platformState.conflict = true;
  await action("admin/platform/settings");
  await wait("record changed");
  assert.equal(
    await evaluate(
      `document.querySelector('[data-platform-action] fieldset').disabled`,
    ),
    true,
  );
  checks++;
  platformState.conflict = false;
  await evaluate(
    `Array.from(document.querySelectorAll('[data-platform-action] button')).find(b=>b.textContent.includes('Reload')).click()`,
  );
  await until(
    () => evaluate(`!!document.getElementById('organizationEn')`),
    "Reload after conflict",
  );
  await set("organizationEn", "Uncertain retained draft");
  platformState.writeFailure = true;
  await action("admin/platform/settings");
  await wait("Unable to complete");
  assert.equal(
    await evaluate(`document.getElementById('organizationEn').value`),
    "Uncertain retained draft",
  );
  assert.equal(
    await evaluate(
      `document.querySelector('[data-platform-action] fieldset').disabled`,
    ),
    true,
  );
  checks += 2;
  platformState.writeFailure = false;
  platformState.failure = true;
  await go("/admin/reports");
  await wait("Unable to complete");
  assert.equal(
    await evaluate(`!!document.querySelector('[data-platform-report]')`),
    false,
  );
  checks++;
  platformState.failure = false;
  platformState.malformed = true;
  await go("/admin/reports");
  await wait("Unable to complete");
  assert.equal(
    await evaluate(`document.body.textContent.includes('SYNTHETIC_PRIVATE')`),
    false,
  );
  checks++;
  platformState.malformed = false;
  for (const role of ["LEARNER", "FARMER", "BUYER", "VET"]) {
    await seed(role, "en");
    await go("/admin/reports", "/account/profile");
    assert.equal(await evaluate(`location.pathname`), "/account/profile");
    checks++;
  }
  const writes = requests.filter(
    (r) => r.route.startsWith("admin/platform/") && r.method === "POST",
  );
  assert.ok(
    writes.length > 0 &&
      writes.every((r) =>
        [
          "admin/platform/settings",
          "admin/platform/reports/export",
          "admin/platform/audit-export",
          "admin/platform/diagnostics",
        ].includes(r.route),
      ),
  );
  checks++;
  console.log(`ADM8 platform browser: ${checks} checks passed`);
  return checks;
}
