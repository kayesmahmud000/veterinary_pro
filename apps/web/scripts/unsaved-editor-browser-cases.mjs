import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { platformState } from "./admin-platform-browser-cases.mjs";
import { communicationsState } from "./admin-communications-browser-cases.mjs";

// Real production components/router, synthetic HTTP upstreams. No live mutations.
export async function checkUnsavedEditors({
  seed,
  go,
  call,
  evaluate,
  until,
  temp,
  requests,
  setDialogHandler,
}) {
  let checks = 0;
  const check = (actual, expected, message) => {
    assert.deepEqual(actual, expected, message);
    checks++;
  };
  const set = (id, value) =>
    evaluate(
      `(()=>{const e=document.getElementById(${JSON.stringify(id)});const p=e.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`,
    );
  const value = (id) =>
    evaluate(`document.getElementById(${JSON.stringify(id)})?.value`);
  const confirm = (answer) =>
    evaluate(
      `window.__prompts=[];window.confirm=(text)=>{window.__prompts.push(text);return ${answer}}`,
    );
  const prompts = () => evaluate(`window.__prompts.length`);
  const sidebar = () =>
    evaluate(
      `document.querySelector('[data-workspace-nav="desktop"] a[href="/admin/dashboard"]').click()`,
    );
  const waitField = (id) =>
    until(
      () =>
        evaluate(
          `!!document.getElementById(${JSON.stringify(id)}) && !document.getElementById(${JSON.stringify(id)}).matches(':disabled')`,
        ),
      "Editor loaded " + id,
    );
  const waitDashboard = () =>
    until(
      () =>
        evaluate(
          `location.pathname==='/admin/dashboard' && !document.getElementById('organizationEn') && !document.getElementById('en-body')`,
        ),
      "Dashboard navigation",
    );
  const editors = [
    {
      kind: "settings",
      route: "/admin/settings",
      id: "organizationEn",
      state: platformState,
      conflict: "conflict",
    },
    {
      kind: "content",
      route: "/admin/content/d7000000-0000-4000-8000-000000000201",
      id: "en-body",
      state: communicationsState,
      conflict: "conflict",
    },
  ].filter((e) => !process.env.UXR_EDITOR || process.env.UXR_EDITOR === e.kind);
  for (const editor of editors)
    for (const locale of ["bn", "en"])
      for (const width of [320, 1440]) {
        await seed("SUPER_ADMIN", locale);
        await call("Emulation.setDeviceMetricsOverride", {
          width,
          height: 1000,
          deviceScaleFactor: 1,
          mobile: width < 600,
        });
        await go("/admin/dashboard");
        const entry =
          editor.kind === "settings" ? editor.route : "/admin/content";
        await until(
          () =>
            evaluate(
              `!!document.querySelector('[data-workspace-nav="desktop"] a[href="${entry}"]')`,
            ),
          "Workspace navigation ready",
        );
        await evaluate(
          `document.querySelector('[data-workspace-nav="desktop"] a[href="${entry}"]').click()`,
        );
        if (editor.kind === "content") {
          await until(
            () =>
              evaluate(
                `!!document.querySelector('main a[href="${editor.route}"]')`,
              ),
            "Content list loaded",
          );
          await evaluate(
            `document.querySelector('main a[href="${editor.route}"]').click()`,
          );
        }
        await until(
          () =>
            evaluate(
              `location.pathname===${JSON.stringify(editor.route)} && !document.getElementById('create-slug')`,
            ),
          "Detail navigation complete",
        );
        await waitField(editor.id);
        if (width === 320)
          await evaluate(
            `Object.defineProperty(window,'navigation',{value:undefined,configurable:true});void 0`,
          );
        const baseline = await value(editor.id),
          draft = baseline + " UXR-1 " + locale;
        const writes = () =>
          requests.filter(
            (r) =>
              r.method === "POST" &&
              (r.route === "admin/platform/settings" ||
                r.route.endsWith("/save")),
          ).length;
        const before = writes();
        await set(editor.id, draft);
        await confirm(false);
        await sidebar();
        check(
          await prompts(),
          1,
          `${editor.kind}: sidebar must ask before discarding`,
        );
        check(
          await value(editor.id),
          draft,
          "Cancelled sidebar retains exact draft",
        );
        check(
          await evaluate(`location.pathname`),
          editor.route,
          "Cancelled sidebar retains route",
        );

        // The active language and same-page anchors must leave edits alone.
        await evaluate(
          `document.querySelector('form[data-locale-switcher] button[value="${locale}"]').click()`,
        );
        check(await prompts(), 1, "Active language does not prompt");
        check(await value(editor.id), draft, "Active language retains draft");
        await evaluate(
          `(()=>{const a=document.createElement('a');a.href='#main-content';a.textContent='Anchor';document.body.append(a);a.click();a.remove()})()`,
        );
        check(await prompts(), 1, "Same-page anchor does not prompt");
        await until(
          () => evaluate(`!!history.state?.__vetralinkEntryIndex`),
          "Native anchor numbered",
        );
        check(
          await evaluate(`history.state?.__NA`),
          true,
          "Native anchor retains Next router state",
        );
        await evaluate(`history.back()`);
        await until(
          () => evaluate(`!location.hash`),
          "Same-page history restored",
        );
        await evaluate(`history.forward()`);
        await until(() => evaluate(`location.hash==='#main-content'`), "Forward to native anchor");
        check(await value(editor.id), draft, "Anchor Forward keeps the live editor");
        check(await prompts(), 1, "Anchor Forward does not prompt or reload");
        await evaluate(`history.back()`);
        await until(() => evaluate(`!location.hash`), "Anchor Back restored");
        await evaluate(
          `document.querySelector('form[data-locale-switcher] button[value="${locale === "bn" ? "en" : "bn"}"]').click()`,
        );
        check(await prompts(), 2, "Language change asks before submission");
        check(
          await evaluate(`document.documentElement.lang`),
          locale,
          "Cancelled language stays selected",
        );
        check(
          await value(editor.id),
          draft,
          "Cancelled language retains draft",
        );

        // Cancel both directions in real browser history, including the no-Navigation-API fallback.
        await evaluate(
          `history.replaceState(history.state,'',location.pathname)`,
        );
        const historyLength = await evaluate(`history.length`);
        await evaluate(`history.back()`);
        await until(
          () =>
            evaluate(
              `window.__prompts.length===3 && location.pathname===${JSON.stringify(editor.route)}`,
            ),
          "Cancelled Back restores route",
        );
        check(await value(editor.id), draft, "Cancelled Back retains draft");
        check(
          await evaluate(`history.length`),
          historyLength,
          "Cancelled Back preserves history entries",
        );
        await evaluate(
          `history.pushState(history.state,'', '/admin/dashboard');history.back()`,
        );
        // Back above returns to the source URL and does not leave. Forward now would leave.
        await until(
          () => evaluate(`location.pathname===${JSON.stringify(editor.route)}`),
          "History prepared",
        );
        await evaluate(`history.forward()`);
        await until(
          () =>
            evaluate(
              `window.__prompts.length===4 && location.pathname===${JSON.stringify(editor.route)}`,
            ),
          "Cancelled Forward restores route",
        );
        check(await value(editor.id), draft, "Cancelled Forward retains draft");

        const reload =
          editor.kind === "settings"
            ? `document.querySelector('[data-settings-reload]').click()`
            : `document.querySelector('[data-content-reload]').click()`;
        await evaluate(reload);
        check(
          await prompts(),
          5,
          "Explicit reload requires discard confirmation",
        );
        check(await value(editor.id), draft, "Cancelled reload retains draft");
        check(writes(), before, "Cancelled exits never save");

        // Check the actual browser unload warning; CDP clicks give sticky user activation.
        const box = await evaluate(
          `(()=>{const e=document.getElementById(${JSON.stringify(editor.id)});e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return {x:r.x+5,y:r.y+5}})()`,
        );
        await call("Input.dispatchMouseEvent", {
          type: "mousePressed",
          button: "left",
          clickCount: 1,
          ...box,
        });
        await call("Input.dispatchMouseEvent", {
          type: "mouseReleased",
          button: "left",
          clickCount: 1,
          ...box,
        });
        let unload = null;
        setDialogHandler(async (dialog) => {
          unload = dialog;
          await call("Page.handleJavaScriptDialog", { accept: false });
        });
        await call("Page.reload");
        await until(() => !!unload, "Native unload dialog");
        check(
          unload.type,
          "beforeunload",
          "Reload invokes native browser warning",
        );
        await until(
          async () => (await value(editor.id)) === draft,
          "Cancelled native reload retains draft",
        );
        unload = null;
        await call("Page.close");
        await until(() => !!unload, "Native close dialog");
        check(unload.type, "beforeunload", "Close invokes native browser warning");
        await until(async () => (await value(editor.id)) === draft, "Cancelled native close retains draft");
        setDialogHandler(null);

        await writeFile(
          path.join(temp, `uxr1-${editor.kind}-${locale}-${width}.png`),
          Buffer.from((await call("Page.captureScreenshot")).data, "base64"),
        );
        check(
          await evaluate(`document.documentElement.scrollWidth<=innerWidth+1`),
          true,
          "No horizontal overflow",
        );
        // An acknowledged save must remove all exit warnings.
        if (editor.kind === "settings") {
          const fields = await evaluate(
            `(()=>{const s=document.querySelector('[data-platform-action="admin/platform/settings"]');return {reason:s.querySelector('textarea').id,password:s.querySelector('input[type=password]').id}})()`,
          );
          await set(fields.reason, "Reviewed synthetic unsaved settings");
          await set(fields.password, "DemoPassword123!");
          await evaluate(
            `document.querySelector('[data-platform-action] form').requestSubmit()`,
          );
          await until(
            () => evaluate(`!!document.querySelector('dialog[open]')`),
            "Settings save confirmation",
          );
          await evaluate(
            `document.querySelector('dialog[open] button').click()`,
          );
        } else
          await evaluate(
            `document.getElementById('en-body').closest('form').requestSubmit()`,
          );
        await until(
          () =>
            evaluate(
              `document.querySelector('main').textContent.includes(${JSON.stringify(locale === "bn" ? (editor.kind === "settings" ? "সংরক্ষিত হয়েছে" : "সফলভাবে সংরক্ষিত") : editor.kind === "settings" ? "Saved." : "Saved successfully")})`,
            ),
          "Acknowledged save",
        );
        await waitField(editor.id);
        await confirm(false);
        await sidebar();
        await waitDashboard();
        check(
          await prompts(),
          0,
          "Acknowledged save clears navigation warning",
        );
        await go(editor.route);
        await waitField(editor.id);
        check(await value(editor.id), draft, "Saved draft survives reload");

        // Failed/conflicting writes must retain edits and the exit guard.
        await set(editor.id, draft + " rejected");
        editor.state[editor.conflict] = true;
        if (editor.kind === "settings") {
          const fields = await evaluate(
            `(()=>{const s=document.querySelector('[data-platform-action]');return {reason:s.querySelector('textarea').id,password:s.querySelector('input[type=password]').id}})()`,
          );
          await set(fields.reason, "Reviewed synthetic conflict recovery");
          await set(fields.password, "DemoPassword123!");
          await evaluate(
            `document.querySelector('[data-platform-action] form').requestSubmit()`,
          );
          await until(
            () => evaluate(`!!document.querySelector('dialog[open]')`),
            "Conflict confirmation",
          );
          await evaluate(
            `document.querySelector('dialog[open] button').click()`,
          );
        } else
          await evaluate(
            `document.getElementById('en-body').closest('form').requestSubmit()`,
          );
        await until(
          () =>
            evaluate(
              `!!document.querySelector('main [role=alert]') && !document.querySelector('dialog[open]')`,
            ),
          "Save rejected",
        );
        editor.state[editor.conflict] = false;
        check(
          await value(editor.id),
          draft + " rejected",
          "Rejected save retains draft",
        );
        await confirm(false);
        await sidebar();
        check(await prompts(), 1, "Rejected save remains guarded");
        await confirm(true);
        await sidebar();
        await waitDashboard();
        check(await prompts(), 1, "Explicit discard allows navigation");
        await go(editor.route);
        await waitField(editor.id);
        check(
          await value(editor.id),
          draft,
          "Discarded edits were never saved",
        );

        // Confirmed locale exit must discard even if the server action preserves component state.
        await set(editor.id, draft + " locale discard");
        await confirm(true);
        await evaluate(
          `document.querySelector('form[data-locale-switcher] button[value="${locale === "bn" ? "en" : "bn"}"]').click()`,
        );
        await until(
          () =>
            evaluate(
              `document.documentElement.lang===${JSON.stringify(locale === "bn" ? "en" : "bn")}`,
            ),
          "Confirmed language change",
        );
        await waitField(editor.id);
        check(
          await value(editor.id),
          draft,
          "Confirmed language change discards edits",
        );
        await confirm(false);
        await sidebar();
        await waitDashboard();
        check(await prompts(), 0, "Discarded draft no longer warns");
      }
  if (!process.env.UXR_EDITOR || process.env.UXR_EDITOR === "curriculum") {
    await seed("ADMIN", "en");
    await go("/admin/courses");
    await until(
      () => evaluate(`!!document.querySelector('[data-admin-course-form]')`),
      "Course form",
    );
    await set("product-title", "Unsaved curriculum regression");
    await set("product-slug", "unsaved-curriculum-regression");
    await set(
      "product-description",
      "Synthetic course for unsaved edit acceptance",
    );
    await evaluate(
      `document.querySelector('[data-admin-course-form]').requestSubmit()`,
    );
    await until(
      () => evaluate(`!!document.querySelector('[data-add-lesson]')`),
      "Course editor",
    );
    await evaluate(`document.querySelector('[data-add-lesson]').click()`);
    const lesson = await evaluate(
      `document.querySelector('[data-course-lesson] [id$="-title"]').id`,
    );
    const video = await evaluate(
      `document.querySelector('[data-course-lesson] [id$="-url"]').id`,
    );
    await set(lesson, "Acknowledged lesson");
    await set(video, "https://youtu.be/M7lc1UVf-VE");
    await evaluate(`document.querySelector('[data-save-lessons]').click()`);
    await until(
      () =>
        evaluate(
          `document.querySelector('[data-save-lessons]').disabled && document.querySelector('[data-save-lessons]').closest('form').getAttribute('aria-busy')==='false'`,
        ),
      "Curriculum saved",
    );
    const savedLesson = await evaluate(
      `document.querySelector('[data-course-lesson] [id$="-title"]').id`,
    );
    await set(savedLesson, "Unsaved lesson");
    await confirm(false);
    await sidebar();
    check(await prompts(), 1, "Curriculum sidebar remains guarded");
    check(
      await value(savedLesson),
      "Unsaved lesson",
      "Curriculum cancel retains edits",
    );
    await confirm(true);
    await evaluate(
      `document.querySelector('form[data-locale-switcher] button[value=bn]').click()`,
    );
    await until(
      () => evaluate(`document.documentElement.lang==='bn'`),
      "Curriculum locale changed",
    );
    check(
      await evaluate(
        `document.querySelector('[data-course-lesson] [id$="-title"]')?.value`,
      ),
      "Acknowledged lesson",
      "Curriculum locale discard restores acknowledged rows",
    );
    await confirm(false);
    await sidebar();
    await waitDashboard();
    check(await prompts(), 0, "Curriculum discarded draft does not warn");
  }
  if (!process.env.UXR_EDITOR || process.env.UXR_EDITOR === "reload") {
    await seed("ADMIN", "en");
    await go("/admin/content/d7000000-0000-4000-8000-000000000201");
    await waitField("en-body");
    const section = `Array.from(document.querySelectorAll('[data-communications] section')).find(s=>s.querySelector('h3')?.textContent==='Publish saved draft')`;
    const fields = await evaluate(
      `(()=>{const s=${section};return {reason:s.querySelector('textarea').id,password:s.querySelector('input[type=password]').id}})()`,
    );
    await set(fields.reason, "Reviewed synthetic publication failure");
    await set(fields.password, "DemoPassword123!");
    communicationsState.conflict = true;
    await evaluate(`(${section}).querySelector('form').requestSubmit()`);
    await until(
      () => evaluate(`!!document.querySelector('dialog[open]')`),
      "Publication confirmation",
    );
    await evaluate(`document.querySelector('dialog[open] button').click()`);
    await until(
      () =>
        evaluate(
          `!!(${section}).querySelector('[role=alert]') && !document.querySelector('dialog[open]')`,
        ),
      "Publication rejected",
    );
    communicationsState.conflict = false;
    await set("en-body", "Keep this draft after cancelled recovery reload");
    await confirm(false);
    await evaluate(
      `Array.from((${section}).querySelectorAll('button')).find(b=>b.textContent==='Reload latest record').click()`,
    );
    check(
      await prompts(),
      1,
      "Publication recovery reload must confirm discard",
    );
    check(
      await value("en-body"),
      "Keep this draft after cancelled recovery reload",
      "Cancelled action reload retains draft",
    );
    check(
      await evaluate(`(${section}).querySelector('fieldset').disabled`),
      true,
      "Cancelled reload keeps uncertain action blocked",
    );
    await confirm(true);
    await sidebar();
    await waitDashboard();
  }
  console.log(
    `UXR-1 unsaved editors: ${checks} checks passed. Screenshots: ${temp}`,
  );
  return checks;
}
