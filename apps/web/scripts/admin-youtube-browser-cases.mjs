import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";
export async function checkAdminYouTube({
  seed,
  go,
  call,
  evaluate,
  until,
  temp,
  set,
  products,
  curricula,
  state,
}) {
  let checks = 0;
  const select = async (id, value) =>
    evaluate(
      `(()=>{const e=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('change',{bubbles:true}));})()`,
    );
  const fill = async (index, suffix, value) =>
    set(
      await evaluate(
        `document.querySelectorAll('[data-course-lesson]')[${index}].querySelector('[id$="-${suffix}"]').id`,
      ),
      value,
    );
  for (const role of ["ADMIN", "SUPER_ADMIN"])
    for (const locale of ["bn", "en"])
      for (const width of [320, 1440]) {
        await seed(role, locale);
        await call("Emulation.setDeviceMetricsOverride", {
          width,
          height: 1000,
          deviceScaleFactor: 1,
          mobile: width < 600,
        });
        await go("/admin/products/new");
        await until(
          () => evaluate(`!!document.getElementById('product-type')`),
          "YouTube new course",
        );
        await select("product-type", "VIDEO_COURSE");
        await until(
          () => evaluate(`!!document.getElementById('product-provider')`),
          "Source selector",
        );
        await select("product-provider", "YOUTUBE");
        assert.equal(
          await evaluate(`document.getElementById('product-priceCents').value`),
          "0",
        );
        assert.equal(
          await evaluate(
            `document.getElementById('product-priceCents').disabled`,
          ),
          true,
        );
        checks += 2;
        const slug = `youtube-${role.toLowerCase().replaceAll("_", "-")}-${locale}-${width}`;
        await set("product-title", `Synthetic YouTube ${locale} ${width}`);
        await set("product-slug", slug);
        await set(
          "product-description",
          "Synthetic YouTube course prepared through the browser.",
        );
        await evaluate(
          `document.querySelector('[data-product-form]').requestSubmit()`,
        );
        try {
          await until(()=>evaluate(`!!document.querySelector('[data-product-detail]')`), "Saved YouTube course");
        } catch (error) {
          console.error(await evaluate(`JSON.stringify(Array.from(document.querySelectorAll('[data-product-form] input,[data-product-form] select,[data-product-form] textarea')).map(e=>({id:e.id,value:e.value})))`));
          throw error;
        }
        const course = [...products.values()].find((p) => p.slug === slug);
        assert.equal(course.contentProvider, "YOUTUBE");
        assert.equal(course.priceCents, 0);
        checks += 2;
        assert.equal(
          await evaluate(
            `!!document.querySelector('a[href="/admin/media?productId=${course.id}"]')`,
          ),
          false,
        );
        checks++;
        await go(`/admin/products/${course.id}/curriculum`);
        await until(
          () => evaluate(`!!document.querySelector('[data-course-editor]')`),
          "Curriculum editor",
        );
        await evaluate(`document.querySelector('[data-add-lesson]').click()`);
        await until(
          () =>
            evaluate(
              `document.querySelectorAll('[data-course-lesson]').length===1`,
            ),
          "First lesson",
        );
        await fill(0, "title", "Synthetic main lesson");
        await fill(0, "url", "https://youtu.be/M7lc1UVf-VE");
        await evaluate(`document.querySelector('[data-add-lesson]').click()`);
        await until(
          () =>
            evaluate(
              `document.querySelectorAll('[data-course-lesson]').length===2`,
            ),
          "Second lesson",
        );
        await fill(1, "title", "Synthetic public demo");
        await fill(1, "url", "https://www.youtube.com/watch?v=M7lc1UVf-VE");
        await select(
          await evaluate(
            `document.querySelectorAll('[data-course-lesson]')[1].querySelector('select').id`,
          ),
          "PUBLIC_DEMO",
        );
        await evaluate(`document.querySelector('[data-save-lessons]').click()`);
        await until(
          () =>
            evaluate(
              `document.querySelector('[data-save-lessons]')?.disabled===true&&document.querySelector('[data-save-lessons]').closest('form').getAttribute('aria-busy')==='false'`,
            ),
          "Saved lesson rows",
        );
        assert.equal(curricula.get(course.id).length, 2);
        assert.equal(curricula.get(course.id)[1].access, "PUBLIC_DEMO");
        checks += 2;
        const mainId = curricula.get(course.id)[0].id;
        await evaluate(
          `document.querySelector('[data-course-editor] section button').click()`,
        );
        await until(
          () => evaluate(`!!document.querySelector('[data-youtube-preview]')`),
          "Inline preview",
        );
        assert.equal(
          await evaluate(`document.querySelector('iframe').referrerPolicy`),
          "strict-origin-when-cross-origin",
        );
        assert.equal(
          await evaluate(
            `document.querySelector('iframe').src.startsWith('https://www.youtube-nocookie.com/embed/M7lc1UVf-VE?')`,
          ),
          true,
        );
        assert.equal(
          await evaluate(
            `document.querySelector('iframe').getBoundingClientRect().height>=200`,
          ),
          true,
        );
        assert.equal(
          await evaluate(`document.documentElement.scrollWidth>innerWidth`),
          false,
        );
        checks += 4;
        const shot = await call("Page.captureScreenshot", {
          format: "png",
          captureBeyondViewport: true,
        });
        await writeFile(
          path.join(temp, `youtube-${role}-${locale}-${width}.png`),
          Buffer.from(shot.data, "base64"),
        );
        await evaluate(
          `document.querySelectorAll('[data-course-lesson]')[0].querySelectorAll('button')[1].click()`,
        );
        await evaluate(`document.querySelector('[data-save-lessons]').click()`);
        await until(
          () =>
            evaluate(
              `document.querySelector('[data-save-lessons]')?.disabled===true&&document.querySelector('[data-save-lessons]').closest('form').getAttribute('aria-busy')==='false'`,
            ),
          "Saved reordered lessons",
        );
        assert.equal(curricula.get(course.id)[1].id, mainId);
        checks++;
        if (role === "ADMIN" && locale === "en" && width === 1440) {
          // Enter through client navigation so browser Back exercises popstate.
          await evaluate(
            `document.querySelector('[data-course-editor] > a').click()`,
          );
          await until(
            () => evaluate(`!!document.querySelector('[data-product-detail]')`),
            "Client detail navigation",
          );
          await evaluate(
            `document.querySelector('a[href="/admin/products/${course.id}/curriculum"]').click()`,
          );
          await until(
            () => evaluate(`!!document.querySelector('[data-course-editor]')`),
            "Client curriculum navigation",
          );
          await fill(0, "title", "Unsaved navigation draft");
          await evaluate(
            `window.confirm=()=>false;document.querySelector('a[href="/admin/products"]').click()`,
          );
          await evaluate(`new Promise(resolve=>setTimeout(resolve,500))`);
          assert.equal(
            await evaluate(`!!document.querySelector('[data-course-editor]')`),
            true,
            "Sidebar navigation must preserve an unsaved curriculum",
          );
          await evaluate(`history.back()`);
          await evaluate(`new Promise(resolve=>setTimeout(resolve,500))`);
          assert.equal(
            await evaluate(
              `location.pathname.endsWith('/curriculum')&&!!document.querySelector('[data-course-editor]')`,
            ),
            true,
            "Browser Back must preserve an unsaved curriculum",
          );
          assert.equal(
            await evaluate(
              `document.querySelector('[data-course-lesson] input').value`,
            ),
            "Unsaved navigation draft",
          );
          checks += 3;
          state.conflict = true;
          await fill(0, "title", "Unsaved conflict draft");
          await evaluate(
            `document.querySelector('[data-save-lessons]').click()`,
          );
          await until(
            () => evaluate(`!!document.querySelector('[role="alert"]')`),
            "Stale lesson conflict",
          );
          assert.equal(
            await evaluate(
              `document.querySelector('[data-course-lesson] input').value`,
            ),
            "Unsaved conflict draft",
          );
          checks++;
          state.conflict = false;
          await evaluate(
            `window.confirm=()=>true;Array.from(document.querySelectorAll('[data-course-editor] form button')).at(-1).click()`,
          );
          await until(
            () =>
              evaluate(
                `document.querySelector('[data-course-lesson] input')?.value==='Synthetic public demo'`,
              ),
            "Explicit saved lesson reload",
          );
          checks++;
          await evaluate(
            `document.querySelectorAll('[data-course-lesson]')[0].querySelectorAll('button')[2].click()`,
          );
          await evaluate(
            `document.querySelector('[data-save-lessons]').click()`,
          );
          await until(
            () =>
              evaluate(
                `document.querySelector('[data-save-lessons]')?.disabled===true&&document.querySelector('[data-save-lessons]').closest('form').getAttribute('aria-busy')==='false'`,
              ),
            "Removed demo saved",
          );
          assert.equal(curricula.get(course.id).length, 1);
          checks++;
        }
        await go(`/admin/products/${course.id}`);
        await until(
          () => evaluate(`!!document.getElementById('product-reason')`),
          "YouTube publication",
        );
        await set("product-reason", "Reviewed synthetic YouTube course");
        await evaluate(
          `document.querySelector('[data-product-action]').requestSubmit()`,
        );
        await until(
          () => evaluate(`!!document.querySelector('dialog[open]')`),
          "Confirm YouTube publish",
        );
        await evaluate(`document.querySelector('dialog button').click()`);
        await until(
          () => Promise.resolve(products.get(course.id).isPublished),
          "Published YouTube course",
        );
        checks++;
        await go(`/admin/products/${course.id}/curriculum`);
        await until(
          () => evaluate(`!!document.querySelector('[data-course-editor]')`),
          "Published read-only curriculum",
        );
        assert.equal(
          await evaluate(
            `document.querySelector('[data-add-lesson]').disabled`,
          ),
          true,
        );
        checks++;
      }
  console.log(`Passed ${checks} YouTube admin checks.`);
  return checks;
}
