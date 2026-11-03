import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
export const courseId = "11111111-1111-4111-8111-111111111111",
  userId = "22222222-2222-4222-8222-222222222222";
const stamp = "2026-11-02T00:00:00Z";
const course = {
  id: courseId,
  title: "Synthetic managed course",
  slug: "managed-course",
  isPublished: true,
  deletedAt: null,
};
let rows = [];
const identity = {
  id: userId,
  name: "Synthetic existing learner",
  email: "existing@example.test",
  role: "LEARNER",
  status: "ACTIVE",
};
function membership(user = identity) {
  return {
    id: "33333333-3333-4333-8333-333333333333",
    productId: courseId,
    userId: user.id,
    user,
    status: "ACTIVE",
    version: 0,
    source: "ADMIN",
    createdAt: stamp,
    activatedAt: stamp,
    revokedAt: null,
  };
}
export function handleAdminEnrollmentsFixture(
  route,
  role,
  send,
  query,
  method,
  data,
) {
  if (route === `admin/directory/users/${userId}`) {
    send(200, {
      ...identity,
      authorizationVersion: 0,
      createdAt: stamp,
      farms: [],
      farmCount: 0,
      applications: [],
      applicationCount: 0,
      orderCount: 0,
    });
    return true;
  }
  if (route === `admin/directory/users/${userId}/courses`) {
    send(200, {
      user: identity,
      items: rows
        .filter((r) => r.userId === userId)
        .map(({ user, ...r }) => ({ ...r, course })),
      nextCursor: null,
    });
    return true;
  }
  if (!route.startsWith(`admin/courses/${courseId}/`)) return false;
  if (!["ADMIN", "SUPER_ADMIN"].includes(role)) {
    send(403, null);
    return true;
  }
  if (route.endsWith("/enrollment-candidates")) {
    send(200, {
      items: [
        {
          ...identity,
          enrollment: rows[0]
            ? { status: rows[0].status, version: rows[0].version }
            : null,
          canAdd: !rows.length,
          canRestore: rows[0]?.status === "REVOKED",
          denialCode: null,
        },
      ],
      nextCursor: null,
    });
    return true;
  }
  if (method === "GET") {
    send(200, {
      course,
      activeCount: rows.filter((r) => r.status === "ACTIVE").length,
      revokedCount: rows.filter((r) => r.status === "REVOKED").length,
      items: rows.filter(
        (r) =>
          !query.get("status") ||
          query.get("status") === "ALL" ||
          query.get("status") === r.status,
      ),
      nextCursor: null,
    });
    return true;
  }
  if (route.endsWith("/create-user")) {
    const user = {
      ...identity,
      id: "44444444-4444-4444-8444-444444444444",
      name: data.name,
      email: data.email,
    };
    const enrollment = { ...membership(user), id: user.id };
    rows.push(enrollment);
    send(200, { accountCreated: true, enrollment });
    return true;
  }
  if (route.endsWith("/actions")) {
    const user = route.split("/").at(-2),
      row = rows.find((r) => r.userId === user);
    row.status = data.action === "REMOVE" ? "REVOKED" : "ACTIVE";
    row.version++;
    row.revokedAt = data.action === "REMOVE" ? stamp : null;
    send(200, { enrollment: row, changed: true });
    return true;
  }
  const row = membership();
  rows = [row];
  send(200, { enrollment: row, changed: true });
  return true;
}
export async function checkAdminEnrollments({
  seed,
  go,
  call,
  evaluate,
  until,
  temp,
}) {
  let checks = 0;
  const set = async (id, value) =>
    evaluate(
      `(()=>{const e=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));})()`,
    );
  for (const role of ["ADMIN", "SUPER_ADMIN"])
    for (const locale of ["en", "bn"])
      for (const width of [320, 768, 1440]) {
        rows = [];
        await seed(role, locale);
        await call("Emulation.setDeviceMetricsOverride", {
          width,
          height: 1000,
          deviceScaleFactor: 1,
          mobile: width === 320,
        });
        await go(`/admin/courses/${courseId}/learners`);
        await until(
          () => evaluate(`!!document.querySelector('[data-add-learner]')`),
          "Learner manager mounted",
        );
        assert.equal(
          await evaluate(
            `document.querySelector('[data-enrollment-manager] h1')?.textContent`,
          ),
          "Synthetic managed course",
        );
        checks++;
        await evaluate(`document.querySelector('[data-add-learner]').click()`);
        await until(
          () => evaluate(`!!document.querySelector('[data-candidate-search]')`),
          "Candidate form",
        );
        await set("candidate-search", "existing");
        await evaluate(
          `document.querySelector('[data-candidate-search]').requestSubmit()`,
        );
        await until(
          () => evaluate(`!!document.querySelector('[data-select-learner]')`),
          "Candidates",
        );
        await evaluate(
          `document.querySelector('[data-select-learner]').click()`,
        );
        await until(
          () =>
            evaluate(`!!document.querySelector('[data-enrollment-action]')`),
          "Add confirmation",
        );
        await set("enrollment-reason", "Requested synthetic course access");
        await set("enrollment-password", "DemoPassword123!");
        await evaluate(
          `document.querySelector('[data-enrollment-action]').requestSubmit()`,
        );
        await until(
          () =>
            evaluate(
              `document.querySelectorAll('[data-membership-row]').length===1`,
            ),
          "Added membership",
        );
        checks++;
        const columns = await evaluate(
          `Array.from(document.querySelectorAll('[data-enrollment-manager] th')).map(e=>e.textContent)`,
        );
        assert.deepEqual(
          columns,
          locale === "bn"
            ? [
                "নাম",
                "ইমেইল",
                "এনরোলমেন্টের অবস্থা",
                "এনরোলমেন্টের তারিখ",
                "পদক্ষেপ",
              ]
            : [
                "Name",
                "Email",
                "Enrollment status",
                "Enrollment dates",
                "Actions",
              ],
        );
        assert.equal(
          await evaluate(
            `document.querySelector('[data-membership-row] td:nth-child(2)')?.textContent`,
          ),
          "existing@example.test",
        );
        assert.equal(
          await evaluate(
            `document.querySelector('[data-membership-row]')?.cells.length`,
          ),
          5,
        );
        assert.equal(
          await evaluate(
            `!!document.querySelector('[data-enrollment-manager] [role="region"][tabindex="0"]')`,
          ),
          true,
        );
        checks++;
        await evaluate(
          `document.querySelector('[data-membership-remove]').click()`,
        );
        await set("enrollment-reason", "Remove synthetic course access");
        await set("enrollment-password", "DemoPassword123!");
        await evaluate(
          `document.querySelector('[data-enrollment-action]').requestSubmit()`,
        );
        await until(
          () =>
            evaluate(
              `document.querySelectorAll('[data-membership-row]').length===0`,
            ),
          "Removed active row",
        );
        checks++;
        await evaluate(
          `(()=>{const e=document.querySelector('[data-enrollment-status]');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,'ALL');e.dispatchEvent(new Event('change',{bubbles:true}));})()`,
        );
        await until(
          () =>
            evaluate(`!!document.querySelector('[data-membership-restore]')`),
          "Revoked row",
        );
        await evaluate(
          `document.querySelector('[data-membership-restore]').click()`,
        );
        await set("enrollment-reason", "Restore synthetic course access");
        await set("enrollment-password", "DemoPassword123!");
        await evaluate(
          `document.querySelector('[data-enrollment-action]').requestSubmit()`,
        );
        await until(
          () =>
            evaluate(`!!document.querySelector('[data-membership-remove]')`),
          "Restored",
        );
        checks++;
        await evaluate(
          `document.querySelector('[data-create-learner]').click()`,
        );
        await until(
          () =>
            evaluate(`!!document.querySelector('[data-create-course-user]')`),
          "Creation form",
        );
        for (const [id, v] of Object.entries({
          "new-learner-name": "Created learner",
          "new-learner-email": "created@example.test",
          "new-learner-password": "DemoPassword123!",
          "new-learner-confirm": "DemoPassword123!",
          "new-learner-reason": "Create requested learner account",
          "new-learner-actor-password": "DemoPassword123!",
        }))
          await set(id, v);
        await evaluate(
          `document.querySelector('[data-create-course-user]').requestSubmit()`,
        );
        await until(
          () =>
            evaluate(
              `document.querySelectorAll('[data-membership-row]').length===2`,
            ),
          "Created and enrolled",
        );
        assert.equal(
          await evaluate(`document.querySelectorAll('dialog[open]').length`),
          0,
        );
        checks++;
        assert.equal(
          await evaluate(`document.documentElement.scrollWidth<=innerWidth`),
          true,
        );
        await writeFile(
          `${temp}/enrollments-${role}-${locale}-${width}.png`,
          Buffer.from(
            (await call("Page.captureScreenshot", { format: "png" })).data,
            "base64",
          ),
        );
        checks++;
        await go(`/admin/users/${userId}`);
        await until(
          () =>
            evaluate(
              `document.querySelectorAll('[data-enrollment-manager] [data-membership-row]').length===1`,
            ),
          "User-centric course membership",
        );
        checks++;
      }
  console.log(
    `Passed ${checks} enrollment browser checks. Screenshots: ${temp}`,
  );
  return checks;
}

export async function checkEnrollmentCountsRefresh({
  seed,
  go,
  evaluate,
  until,
  requests,
}) {
  await seed("ADMIN", "en");
  await go("/admin/courses");
  await until(
    async () =>
      (await evaluate(
        `!!document.querySelector('[data-admin-courses-list]')`,
      )) && requests.some((r) => r.route === "admin/products"),
    "Course list loaded",
  );
  const before = requests.filter((r) => r.route === "admin/products").length;
  await evaluate(`window.dispatchEvent(new Event('focus'))`);
  await until(
    () => requests.filter((r) => r.route === "admin/products").length > before,
    "Focus refreshes course enrollment counts",
  );
  const after = requests.filter((r) => r.route === "admin/products").length;
  await evaluate(
    `window.dispatchEvent(new Event('vetralink-enrollments-updated'))`,
  );
  await until(
    () => requests.filter((r) => r.route === "admin/products").length > after,
    "Membership mutation refreshes count list",
  );
  console.log("Passed 2 course-count refresh checks.");
  return 2;
}
