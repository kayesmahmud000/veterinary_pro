import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
export async function checkAdminCourseManagement({
  seed,
  go,
  call,
  evaluate,
  until,
  temp,
  requests,
  products,
  curricula,
  state,
}) {
  let checks = 0,
    first;
  const script = await call("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.__adminPlayers=[];window.YT={Player:class{constructor(frame,options){this.frame=frame;window.__adminPlayers.push({frame,events:options.events});setTimeout(()=>options.events.onReady(),0);}destroy(){this.frame.remove();}}};`,
  });
  await call("Network.setBlockedURLs", {
    urls: [
      "*youtube-nocookie.com/*",
      "*youtube.com/iframe_api*",
      "https://images.example.test/*",
    ],
  });
  const set = async (id, value) =>
    evaluate(
      `(()=>{const e=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));return new Promise(resolve=>requestAnimationFrame(resolve));})()`,
    );
  const select = async (id, value) =>
    evaluate(
      `(()=>{const e=document.getElementById(${JSON.stringify(id)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`,
    );
  const fillLesson = async (index, key, value) => {
    const id = await evaluate(
      `document.querySelectorAll('[data-course-lesson]')[${index}].querySelector('${key === "url" ? "input[type=url]" : "input"}').id`,
    );
    await set(id, value);
  };
  const confirm = async () => {
    await until(
      () =>
        evaluate(
          `!!document.querySelector('dialog[open] #course-action-reason')`,
        ),
      "Action dialog",
    );
    await set("course-action-reason", "Reviewed course management change");
    await evaluate(
      `document.querySelector('[data-admin-course-action]').requestSubmit()`,
    );
    await until(
      () => evaluate(`!document.querySelector('dialog[open]')`),
      "Confirmed course action",
    );
  };
  const shot = async (name) => {
    const s = await call("Page.captureScreenshot", {
      format: "png",
      captureBeyondViewport: true,
    });
    await writeFile(path.join(temp, name), Buffer.from(s.data, "base64"));
  };
  try {
    // A committed create with a lost response cannot become a second draft after editing its slug.
    await seed("ADMIN", "en");
    await go("/admin/courses/new");
    await until(
      () => evaluate(`!!document.querySelector('[data-admin-course-form]')`),
      "Lost acknowledgement entry",
    );
    await set("course-title", "Recover original draft");
    await set("course-slug", "recover-original-draft");
    await set(
      "course-description",
      "Recover a committed course when its response is lost.",
    );
    state.createLostAck = true;
    await evaluate(
      `document.querySelector('[data-admin-course-form]').requestSubmit()`,
    );
    await until(
      () =>
        evaluate(
          `!!document.querySelector('[data-admin-course-wizard] [role=alert]')`,
        ),
      "Lost acknowledgement reported",
    );
    const original = [...products.values()].find(
      (p) => p.slug === "recover-original-draft",
    );
    assert.ok(original);
    await set("course-slug", "must-not-create-second-draft");
    const beforeRetry = requests.filter(
      (r) => r.route === "admin/products" && r.method === "POST",
    ).length;
    await evaluate(
      `document.querySelector('[data-admin-course-form]').requestSubmit()`,
    );
    await evaluate(`new Promise(resolve=>setTimeout(resolve,150))`);
    assert.equal(
      requests.filter(
        (r) => r.route === "admin/products" && r.method === "POST",
      ).length,
      beforeRetry,
      "Uncertain create blocks changed-slug retry",
    );
    checks++;
    await evaluate(
      `document.querySelector('[data-find-course-draft]').click()`,
    );
    await until(
      () =>
        evaluate(
          `!!document.querySelector('a[href="/admin/courses/${original.id}"]')`,
        ),
      "Find original submitted slug",
    );
    checks++;
    // A definitive first-attempt duplicate permits correcting the slug in place.
    await go("/admin/courses/new");
    await until(
      () => evaluate(`!!document.querySelector('[data-admin-course-form]')`),
      "Duplicate correction entry",
    );
    await set("course-title", "Keep entered course information");
    await set("course-slug", "recover-original-draft");
    await set(
      "course-description",
      "Retain information while correcting an ordinary duplicate slug.",
    );
    await evaluate(
      `document.querySelector('[data-admin-course-form]').requestSubmit()`,
    );
    await until(
      () =>
        evaluate(
          `!!document.querySelector('[data-admin-course-wizard] [role=alert]')`,
        ),
      "Duplicate slug rejected",
    );
    assert.equal(
      await evaluate(`document.getElementById('course-slug').readOnly`),
      false,
    );
    await set("course-slug", "corrected-unique-course");
    await evaluate(
      `document.querySelector('[data-admin-course-form]').requestSubmit()`,
    );
    await until(
      () => evaluate(`!!document.querySelector('[data-course-editor]')`),
      "Corrected slug creates draft",
    );
    assert.equal(
      [...products.values()].find((p) => p.slug === "corrected-unique-course")
        .title,
      "Keep entered course information",
    );
    checks += 2;
    for (const role of ["ADMIN", "SUPER_ADMIN"])
      for (const locale of ["bn", "en"])
        for (const width of [320, 768, 1440]) {
          await seed(role, locale);
          await call("Emulation.setDeviceMetricsOverride", {
            width,
            height: 1000,
            deviceScaleFactor: 1,
            mobile: width < 600,
          });
          await go("/admin/courses");
          await until(
            () => evaluate(`!!document.querySelector('[data-add-course]')`),
            "List-first management",
          );
          assert.equal(
            await evaluate(
              `!!document.querySelector('[data-admin-course-form]')`,
            ),
            false,
          );
          checks++;
          await until(
            () =>
              evaluate(
                `!!document.querySelector('[data-admin-courses-list] table tbody tr')`,
              ),
            "Course table loaded",
          );
          assert.equal(
            await evaluate(
              `document.querySelectorAll('[data-admin-courses-list] table thead th[scope=col]').length`,
            ),
            7,
          );
          assert.equal(
            await evaluate(
              `document.querySelector('[data-product-row]').tagName`,
            ),
            "TR",
          );
          assert.equal(
            await evaluate(`document.documentElement.scrollWidth>innerWidth`),
            false,
            "Course table scroll stays inside viewport",
          );
          await shot(`admin-course-table-start-${role}-${locale}-${width}.png`);
          assert.equal(
            await evaluate(
              `document.querySelector('[data-admin-courses-list] table').parentElement.scrollWidth<=document.querySelector('[data-admin-courses-list] table').parentElement.clientWidth`,
            ),
            true,
            "Table needs no horizontal scrolling",
          );
          assert.equal(
            await evaluate(
              `!document.querySelector('[data-admin-courses]').classList.contains('w-11/12')`,
            ),
            true,
            "Admin list uses full workspace width",
          );
          assert.equal(
            await evaluate(
              `[...document.querySelectorAll('[data-product-row] [data-course-details],[data-product-row] [data-course-edit],[data-product-row] [data-course-publication],[data-product-row] [data-course-delete]')].every(e=>e.textContent.trim()==='' && !!e.getAttribute('aria-label') && e.getBoundingClientRect().left>=0 && e.getBoundingClientRect().right<=innerWidth)`,
            ),
            true,
            "Icon-only actions have accessible labels and fit viewport",
          );
          await shot(`admin-course-table-${role}-${locale}-${width}.png`);
          checks += 6;
          await evaluate(`document.querySelector('[data-add-course]').click()`);
          await until(
            () =>
              evaluate(
                `location.pathname==='/admin/courses/new' && !!document.querySelector('[data-admin-course-form]')`,
              ),
            "Course wizard opens",
          );
          checks++;
          const slug = `wizard-${role.toLowerCase().replaceAll("_", "-")}-${locale}-${width}`,
            title = `Course ${role} ${locale} ${width}`;
          await set("course-title", title);
          await set("course-slug", "Invalid Slug");
          await set(
            "course-description",
            "A practical course description for complete course management.",
          );
          await evaluate(
            `document.querySelector('[data-admin-course-form]').requestSubmit()`,
          );
          await until(
            () =>
              evaluate(
                `!!document.querySelector('[data-admin-course-form] [aria-invalid=true]')`,
              ),
            "Slug validation",
          );
          checks++;
          await set("course-slug", slug);
          await set(
            "course-thumbnailUrl",
            "https://images.example.test/course.jpg",
          );
          if (role === "ADMIN" && locale === "en" && width === 320) {
            state.createFailure = true;
            await evaluate(
              `document.querySelector('[data-admin-course-form]').requestSubmit()`,
            );
            await until(
              () =>
                evaluate(
                  `!!document.querySelector('[data-admin-course-wizard] [role=alert]')`,
                ),
              "Create failure retains draft",
            );
            assert.equal(
              await evaluate(`document.getElementById('course-title').value`),
              title,
            );
            state.createFailure = false;
            await set("course-slug", "must-keep-original-retry-slug");
            await evaluate(
              `document.querySelector('[data-find-course-draft]').click()`,
            );
            await until(
              () =>
                evaluate(
                  `!document.querySelector('[data-course-next-info]').disabled`,
                ),
              "Confirmed absent draft allows retry",
            );
            checks++;
          }
          const creates = requests.filter(
            (r) => r.route === "admin/products" && r.method === "POST",
          ).length;
          await evaluate(
            `document.querySelector('[data-course-next-info]').click();document.querySelector('[data-course-next-info]').click()`,
          );
          await until(
            () =>
              evaluate(
                `!document.querySelector('[data-admin-course-form]').hidden && false || document.querySelector('[data-course-editor]') && !document.querySelector('[data-course-editor]').closest('section[hidden]')`,
              ),
            "Lessons step visible",
          );
          const p = [...products.values()].find((p) => p.slug === slug);
          assert.ok(p);
          first ??= p;
          assert.equal(
            await evaluate("location.pathname"),
            "/admin/courses/new",
            "All steps stay on creation route",
          );
          assert.equal(
            requests.filter(
              (r) => r.route === "admin/products" && r.method === "POST",
            ).length,
            creates + 1,
          );
          assert.equal(
            [...products.values()].filter((p) => p.slug === slug).length,
            1,
          );
          checks += 3;
          if (role === "ADMIN" && locale === "bn" && width === 320) {
            p.title = "Concurrent saved title";
            p.version++;
            await evaluate(
              `document.querySelector('[data-course-review]').parentElement.querySelector('button').click()`,
            );
            await set("course-title", "Local unsaved information");
            await evaluate(
              `document.querySelector('[data-admin-course-form]').requestSubmit()`,
            );
            await until(
              () =>
                evaluate(`!!document.querySelector('[data-course-refresh]')`),
              "Conflict recovery offered",
            );
            await evaluate(
              `window.confirm=()=>true;document.querySelector('[data-course-refresh]').click()`,
            );
            await until(
              () =>
                evaluate(
                  `document.getElementById('course-title')?.value==='Concurrent saved title'`,
                ),
              "Creation route reload reconciles saved product",
            );
            assert.equal(
              await evaluate("location.pathname"),
              "/admin/courses/new",
            );
            await set("course-title", title);
            await evaluate(
              `document.querySelector('[data-admin-course-form]').requestSubmit()`,
            );
            await until(
              () =>
                evaluate(
                  `document.querySelector('[data-admin-course-form]').hidden`,
                ),
              "Continue after reload",
            );
            checks++;
          }
          if (role === "ADMIN" && locale === "bn" && width === 320) {
            state.courseReadDelay = 650;
            await evaluate(
              `document.querySelector('[data-reload-lessons]').click()`,
            );
            await until(
              () =>
                evaluate(
                  `document.querySelector('[data-add-lesson]').disabled`,
                ),
              "Reload locks lesson edits",
            );
            assert.equal(
              await evaluate(
                `document.querySelector('[data-course-review]').disabled`,
              ),
              true,
            );
            await until(
              () =>
                evaluate(
                  `!document.querySelector('[data-add-lesson]').disabled`,
                ),
              "Reload completes",
            );
            state.courseReadDelay = 0;
            checks += 2;
          }
          assert.equal(
            await evaluate(`!!document.querySelector('[data-youtube-player]')`),
            false,
            "No eager video preview",
          );
          checks++;
          await evaluate(`document.querySelector('[data-add-lesson]').click()`);
          await until(
            () =>
              evaluate(
                `document.querySelectorAll('[data-course-lesson]').length===1`,
              ),
            "Add first lesson",
          );
          await fillLesson(0, "title", "Main practical lesson");
          await fillLesson(0, "url", "https://evil.test/watch?v=M7lc1UVf-VE");
          await evaluate(
            `document.querySelector('[data-save-lessons]').click()`,
          );
          await until(
            () =>
              evaluate(
                `!!document.querySelector('[data-course-editor] [role=alert]')`,
              ),
            "Invalid video rejected",
          );
          assert.equal(
            await evaluate(
              `document.querySelector('[data-course-review]').disabled`,
            ),
            true,
          );
          checks += 2;
          await fillLesson(0, "url", "https://youtu.be/M7lc1UVf-VE");
          // Moving back preserves the unsaved lesson row while information is saved again.
          await evaluate(
            `document.querySelector('[data-course-review]').parentElement.querySelector('button').click()`,
          );
          await until(
            () =>
              evaluate(
                `!document.querySelector('[data-admin-course-form]').hidden`,
              ),
            "Back to information",
          );
          await set("course-title", `${title} edited`);
          await evaluate(
            `document.querySelector('[data-admin-course-form]').requestSubmit()`,
          );
          await until(
            () =>
              evaluate(
                `!document.querySelector('[data-course-editor]').closest('section[hidden]')`,
              ),
            "Return to retained lessons",
          );
          assert.equal(
            await evaluate(
              `document.querySelector('[data-course-lesson] input').value`,
            ),
            "Main practical lesson",
          );
          checks++;
          await evaluate(`document.querySelector('[data-add-lesson]').click()`);
          await until(
            () =>
              evaluate(
                `document.querySelectorAll('[data-course-lesson]').length===2`,
              ),
            "Add demo",
          );
          await fillLesson(1, "title", "Public introduction");
          await fillLesson(
            1,
            "url",
            "https://www.youtube.com/watch?v=M7lc1UVf-VE",
          );
          const accessId = await evaluate(
            `document.querySelectorAll('[data-course-lesson]')[1].querySelector('select').id`,
          );
          await select(accessId, "PUBLIC_DEMO");
          await evaluate(
            `document.querySelector('[data-save-lessons]').click()`,
          );
          await until(
            () =>
              evaluate(
                `document.querySelector('[data-save-lessons]').disabled && !document.querySelector('[data-course-review]').disabled`,
              ),
            "Lessons saved",
          );
          assert.equal(curricula.get(p.id).length, 2);
          checks++;
          if (role === "ADMIN" && locale === "bn" && width === 320) {
            const ids = curricula.get(p.id).map((l) => l.id);
            await evaluate(
              `window.confirm=()=>true;document.querySelector('[data-add-lesson]').click()`,
            );
            await until(
              () =>
                evaluate(
                  `document.querySelectorAll('[data-course-lesson]').length===3`,
                ),
              "Add removable lesson",
            );
            await evaluate(
              `document.querySelectorAll('[data-course-lesson]')[2].querySelectorAll('button')[2].click()`,
            );
            await until(
              () =>
                evaluate(
                  `document.querySelectorAll('[data-course-lesson]').length===2`,
                ),
              "Confirm lesson removal",
            );
            await evaluate(
              `document.querySelectorAll('[data-course-lesson]')[1].querySelectorAll('button')[0].click()`,
            );
            await until(
              () =>
                evaluate(
                  `document.querySelector('[data-course-lesson] input').value==='Public introduction'`,
                ),
              "Reorder rendered",
            );
            await evaluate(
              `document.querySelector('[data-save-lessons]').click()`,
            );
            await until(
              () =>
                evaluate(
                  `document.querySelector('[data-save-lessons]').disabled && !document.querySelector('[data-course-review]').disabled`,
                ),
              "Reordered lessons saved",
            );
            assert.deepEqual(
              curricula.get(p.id).map((l) => l.id),
              [ids[1], ids[0]],
            );
            checks += 2;
          }
          await evaluate(
            `document.querySelector('[data-course-editor] section button').click()`,
          );
          await until(
            () =>
              evaluate(
                `!!document.querySelector('[data-admin-video-preview] [data-youtube-player]')`,
              ),
            "On-demand preview",
          );
          assert.equal(
            await evaluate(
              `document.querySelectorAll('[data-youtube-player]').length`,
            ),
            1,
          );
          checks++;
          await evaluate(
            `document.querySelector('[data-course-review]').click()`,
          );
          await until(
            () =>
              evaluate(
                `!document.querySelector('[data-course-review-panel]').hidden`,
              ),
            "Review step",
          );
          assert.equal(
            await evaluate(
              `document.querySelectorAll('[data-youtube-player]').length`,
            ),
            0,
            "Step change destroys preview",
          );
          assert.equal(
            await evaluate(
              `document.querySelector('[data-course-review-panel]').textContent.includes('Main practical lesson')`,
            ),
            true,
          );
          checks += 2;
          assert.equal(
            await evaluate(`document.documentElement.scrollWidth>innerWidth`),
            false,
            "Review fits viewport",
          );
          assert.equal(
            await evaluate(
              `document.querySelector('[data-admin-course-workspace]').classList.contains('w-11/12')`,
            ),
            true,
          );
          checks += 2;
          await shot(`admin-course-review-${role}-${locale}-${width}.png`);
          await evaluate(
            `document.querySelector('[data-wizard-publish]').click()`,
          );
          await confirm();
          assert.equal(p.isPublished, true);
          assert.equal(
            await evaluate("location.pathname"),
            "/admin/courses/new",
          );
          checks += 2;
          await go(`/admin/courses/${p.id}`);
          await until(
            () =>
              evaluate(`!!document.querySelector('[data-admin-course-form]')`),
            "Existing course edit",
          );
          assert.equal(
            await evaluate(`document.getElementById('course-title').value`),
            `${title} edited`,
          );
          await set("course-title", `${title} updated while published`);
          await evaluate(
            `document.querySelector('[data-admin-course-form]').requestSubmit()`,
          );
          await until(
            () =>
              evaluate(
                `!!document.querySelector('[data-wizard-unpublish]') && document.querySelector('[data-admin-course-form]').hidden`,
              ),
            "Published lesson restrictions",
          );
          assert.equal(p.isPublished, true);
          assert.equal(
            await evaluate(
              `document.querySelector('[data-add-lesson]').disabled`,
            ),
            true,
          );
          checks += 3;
          await evaluate(
            `document.querySelector('[data-wizard-unpublish]').click()`,
          );
          await confirm();
          assert.equal(p.isPublished, false);
          await until(
            () =>
              evaluate(
                `document.querySelector('[data-add-lesson]')?.disabled===false`,
              ),
            "Unpublished lesson editor",
          );
          checks++;
          p.enrollmentCount = 7;
          await go("/admin/courses");
          await until(
            () =>
              evaluate(
                `!!document.querySelector('a[href="/admin/courses/${p.id}"]')`,
              ),
            "Saved course list",
          );
          const target = `[...document.querySelectorAll('[data-product-row]')].find(row=>row.querySelector('a[href="/admin/courses/${p.id}"]'))`;
          await evaluate(
            `${target}.querySelector('[data-course-details]').click()`,
          );
          await until(
            () =>
              evaluate(
                `!!document.querySelector('[data-admin-course-details]')`,
              ),
            "Course details modal",
          );
          assert.equal(
            await evaluate(
              `document.querySelector('[data-admin-course-details] dl > div:last-child dd').textContent.trim()===${JSON.stringify(locale === "bn" ? "৭" : "7")}`,
            ),
            true,
          );
          checks++;
          assert.equal(
            await evaluate(`document.documentElement.scrollWidth>innerWidth`),
            false,
          );
          checks++;
          await shot(`admin-course-details-${role}-${locale}-${width}.png`);
          await evaluate(
            `document.querySelector('dialog[open] button[aria-label]').click()`,
          );
          if (role === "ADMIN" && locale === "bn" && width === 320) {
            await evaluate(
              `${target}.querySelector('[data-course-publication]').click()`,
            );
            await confirm();
            assert.equal(p.isPublished, true);
            // Wait for the version-bearing refreshed card before its next action.
            await until(
              () =>
                evaluate(
                  `(${target})?.querySelector('[data-course-publication]')?.getAttribute('aria-label').includes('অপ্রকাশিত')===true`,
                ),
              "List unpublish action",
            );
            await evaluate(
              `${target}.querySelector('[data-course-publication]').click()`,
            );
            await confirm();
            assert.equal(p.isPublished, false);
            await until(
              () =>
                evaluate(
                  `(${target})?.querySelector('[data-course-publication]')?.getAttribute('aria-label')==='কোর্স প্রকাশ করুন'`,
                ),
              "List refresh after unpublish",
            );
            checks += 2;
          }
          await evaluate(
            `${target}.querySelector('[data-course-delete]').click()`,
          );
          await until(
            () =>
              evaluate(
                `!!document.querySelector('[data-admin-course-action]')`,
              ),
            "Delete title confirmation",
          );
          assert.equal(
            await evaluate(
              `document.querySelector('[data-admin-course-action]').textContent.includes(${JSON.stringify(`${title} updated while published`)})`,
            ),
            true,
          );
          checks++;
          await confirm();
          assert.ok(p.deletedAt);
          assert.equal(
            curricula.get(p.id).length,
            2,
            "Soft delete retains lessons",
          );
          assert.equal(
            p.enrollmentCount,
            7,
            "Soft delete retains membership evidence",
          );
          checks += 3;
        }
    await seed("ADMIN", "en");
    await go("/admin/courses/new");
    await until(
      () => evaluate(`!!document.querySelector('[data-admin-course-form]')`),
      "Paid draft entry",
    );
    await set("course-title", "Future paid course");
    await set("course-slug", "future-paid-course");
    await set(
      "course-description",
      "Future paid pricing configuration with no current payment integration.",
    );
    await select("course-mode", "PAID");
    await until(
      () => evaluate(`!!document.getElementById('course-priceCents')`),
      "Paid pricing controls",
    );
    await set("course-priceCents", "150000");
    await evaluate(
      `document.querySelector('[data-admin-course-form]').requestSubmit()`,
    );
    await until(
      () => evaluate(`!!document.querySelector('[data-course-review]')`),
      "Paid draft saved",
    );
    await evaluate(`document.querySelector('[data-course-review]').click()`);
    await until(
      () =>
        evaluate(
          `!document.querySelector('[data-course-review-panel]').hidden`,
        ),
      "Paid review",
    );
    assert.equal(
      await evaluate(
        `document.querySelector('[data-wizard-publish]').disabled`,
      ),
      true,
    );
    assert.equal(
      [...products.values()].find((p) => p.slug === "future-paid-course")
        .priceCents,
      150000,
    );
    checks += 2;
    // Public administrative actions use guarded management routes, without enrollment.
    for (const role of ["ADMIN", "SUPER_ADMIN"]) {
      await seed(role, "en");
      await go("/courses/synthetic-free-course");
      await until(
        () => evaluate(`!!document.querySelector('[data-course-management]')`),
        "Public admin management action",
      );
      assert.equal(
        await evaluate(`!!document.querySelector('[data-course-enroll]')`),
        false,
      );
      await evaluate(
        `document.querySelector('[data-public-account] > button').click()`,
      );
      await until(
        () =>
          evaluate(`!!document.querySelector('[data-public-account-panel]')`),
        "Admin account menu",
      );
      assert.equal(
        await evaluate(`!!document.querySelector('[data-my-courses]')`),
        false,
      );
      checks += 2;
    }
    for (const role of ["LEARNER", "FARMER", "BUYER", "VET"]) {
      await seed(role, "en");
      await go("/admin/courses", "/account/profile");
      assert.equal(
        await evaluate(`!!document.querySelector('[data-admin-courses-list]')`),
        false,
      );
      checks++;
      await go("/admin/courses/new", "/account/profile");
      checks++;
    }
  } catch (error) {
    console.log(
      "Course form diagnostic:",
      await evaluate(
        `JSON.stringify([...document.querySelectorAll('[data-admin-course-form] input,[data-admin-course-form] select')].map(e=>({id:e.id,value:e.value})))`,
      ),
    );
    throw error;
  } finally {
    await call("Page.removeScriptToEvaluateOnNewDocument", {
      identifier: script.identifier,
    });
    await call("Network.setBlockedURLs", { urls: [] });
    state.createFailure = false;
    state.createLostAck = false;
    state.courseReadDelay = 0;
    state.conflict = false;
  }
  console.log(
    `Passed ${checks} connected admin course checks. Screenshots: ${temp}`,
  );
  return checks;
}
