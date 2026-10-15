import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
const id = "aa0e8400-e29b-41d4-a716-446655440001",
  second = "aa0e8400-e29b-41d4-a716-446655440002";
let mode = "ready",
  version = 2,
  status = "ACTIVE";
const account = () => ({
  id,
  name: "Synthetic support account",
  email: "support@example.test",
  role: "LEARNER",
  status,
  authorizationVersion: version,
  createdAt: "2026-10-14T00:00:00Z",
});
const farm = {
  id,
  name: "Synthetic support farm",
  farmType: "DAIRY",
  country: "Bangladesh",
  owner: { id: second, name: "Synthetic owner" },
  createdAt: "2026-10-14T00:00:00Z",
};
const audit = {
  id,
  actorId: second,
  action: "USER_SUSPENDED",
  entityType: "User",
  entityId: id,
  traceId: second,
  createdAt: "2026-10-14T00:00:00Z",
};
export function handleDirectoryFixture(
  route,
  role,
  send,
  query,
  method,
  body,
  res,
) {
  if (!route.startsWith("admin/directory/")) return false;
  if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
    send(403, null);
    return true;
  }
  const parts = route.split("/"),
    kind = parts[2];
  if (method === "POST") {
    if (mode === "conflict") {
      res.writeHead(409, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({ errorDetails: { title: "ACCOUNT_VERSION_CONFLICT" } }),
      );
      return true;
    }
    if (body.expectedAuthorizationVersion !== version) {
      send(409, null);
      return true;
    }
    if (body.action === "SUSPEND") status = "SUSPENDED";
    if (body.action === "REACTIVATE") status = "ACTIVE";
    version++;
    send(200, account());
    return true;
  }
  if (mode === "error") {
    send(503, null);
    return true;
  }
  if (parts.length === 3) {
    const row =
      kind === "farms"
        ? farm
        : kind === "audit"
          ? audit
          : kind === "veterinarians"
            ? { ...account(), role: "VET" }
            : account();
    send(200, {
      items:
        query.get("search") === "missing"
          ? []
          : [
              query.get("cursor")
                ? { ...row, id: second, name: "Second synthetic record" }
                : row,
            ],
      nextCursor: query.get("cursor") ? null : id,
    });
    return true;
  }
  const related = {
    farms: [{ id, name: farm.name, relation: "MEMBER" }],
    farmCount: 1,
    applications: [],
    applicationCount: 0,
    orderCount: 0,
  };
  send(
    200,
    kind === "farms"
      ? {
          ...farm,
          members: [],
          memberCount: 0,
          animalCount: 0,
          subscription: null,
        }
      : kind === "audit"
        ? {
            ...audit,
            oldValues: { status: "ACTIVE", email: "MUST_NOT_RENDER" },
            newValues: { status: "SUSPENDED", password: "MUST_NOT_RENDER" },
          }
        : {
            ...account(),
            ...related,
            ...(kind === "veterinarians"
              ? { role: "VET", profile: null, consultationCount: 0 }
              : {}),
          },
  );
  return true;
}
export async function checkAdminDirectory({
  seed,
  go,
  call,
  evaluate,
  until,
  temp,
  requests,
}) {
  let checks = 0;
  const set = async (id, v) =>
    evaluate(
      `(()=>{const e=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(v)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
  for (const locale of ["bn", "en"])
    for (const role of ["ADMIN", "SUPER_ADMIN"])
      for (const width of [320, 1440]) {
        await seed(role, locale);
        await call("Emulation.setDeviceMetricsOverride", {
          width,
          height: 1000,
          deviceScaleFactor: 1,
          mobile: width < 600,
        });
        for (const kind of ["users", "veterinarians", "farms", "audit"]) {
          await go(`/admin/${kind}`);
          await until(
            () => evaluate(`!!document.querySelector('[data-directory-row]')`),
            "Directory rows " + kind,
          );
          assert.equal(
            await evaluate("document.documentElement.scrollWidth>innerWidth"),
            false,
          );
          assert.equal(
            await evaluate('document.querySelectorAll("main").length'),
            1,
          );
          assert.equal(
            await evaluate('document.querySelectorAll("h1").length'),
            1,
          );
          const shot = await call("Page.captureScreenshot", { format: "png" });
          if (kind === "users")
            await writeFile(
              path.join(temp, `directory-${role}-${locale}-${width}.png`),
              Buffer.from(shot.data, "base64"),
            );
          await evaluate(
            `document.querySelector('[data-directory-row] a').click()`,
          );
          await until(
            () =>
              evaluate(
                `document.querySelector('[data-admin-detail]') && !document.querySelector('[data-admin-detail] [role="alert"]') && !!document.querySelector('[data-admin-detail] h2')`,
              ),
            "Detail " + kind,
          );
          assert.equal(
            await evaluate(
              `document.body.textContent.includes('MUST_NOT_RENDER')`,
            ),
            false,
          );
          assert.equal(
            await evaluate("document.documentElement.scrollWidth>innerWidth"),
            false,
          );
          checks += 5;
        }
      }
  await seed("ADMIN", "en");
  await go("/admin/users");
  await until(
    () => evaluate(`!!document.querySelector('[data-directory-next]')`),
    "Next page button",
  );
  await evaluate(`document.querySelector('[data-directory-next]').click()`);
  await until(
    () =>
      evaluate(`document.body.textContent.includes('Second synthetic record')`),
    "Second page",
  );
  checks++;
  await set("directory-search", "missing");
  await evaluate('document.querySelector("main form").requestSubmit()');
  await until(
    () =>
      evaluate(`document.body.textContent.includes('No matching records.')`),
    "Empty search",
  );
  checks++;
  await go(`/admin/users/${id}`);
  await until(
    () => evaluate(`!!document.querySelector('#support-reason')`),
    "Actions ready",
  );
  await set("support-reason", "Support investigation");
  await set("support-password", "password");
  await evaluate(
    'document.querySelector("[data-account-actions] form").requestSubmit()',
  );
  await until(
    () => evaluate(`!!document.querySelector('dialog[open]')`),
    "Confirmation",
  );
  assert.equal(
    await evaluate(
      `document.querySelector('dialog').textContent.includes('Support investigation')`,
    ),
    true,
  );
  await evaluate(`document.querySelector('dialog button').click()`);
  await until(
    () =>
      evaluate(
        `document.body.textContent.includes('Account action saved.') && document.body.textContent.includes('Suspended')`,
      ),
    "Suspend saved",
  );
  checks += 2;
  mode = "conflict";
  await until(
    () => evaluate(`!!document.querySelector('#support-reason')`),
    "Reloaded actions",
  );
  await set("support-reason", "Support reactivation");
  await set("support-password", "password");
  await evaluate(
    'document.querySelector("[data-account-actions] form").requestSubmit()',
  );
  await until(
    () => evaluate(`!!document.querySelector('dialog[open]')`),
    "Conflict confirmation",
  );
  await evaluate(`document.querySelector('dialog button').click()`);
  await until(
    () =>
      evaluate(`document.body.textContent.includes('This account changed.')`),
    "Conflict feedback persists",
  );
  mode = "ready";
  checks++;
  mode = "error";
  await go("/admin/users");
  await until(
    () => evaluate(`!!document.querySelector('main [role="alert"]')`),
    "Error state",
  );
  mode = "ready";
  await evaluate(
    `document.querySelector('main [role="alert"]').parentElement.querySelector('button').click()`,
  );
  await until(
    () => evaluate(`!!document.querySelector('[data-directory-row]')`),
    "Recovery",
  );
  checks++;
  for (const role of ["LEARNER", "FARMER", "BUYER", "VET"]) {
    await seed(role, "en");
    await go("/admin/users", "/account/profile");
    assert.equal(
      await evaluate(`!!document.querySelector('[data-admin-directory]')`),
      false,
    );
    checks++;
  }
  assert.equal(
    requests.filter((r) => r.route.startsWith("admin/directory/") && r.farmId)
      .length,
    0,
  );
  checks++;
  status = "ACTIVE";
  version = 2;
  console.log(`Passed ${checks} admin directory browser checks.`);
  return checks;
}
