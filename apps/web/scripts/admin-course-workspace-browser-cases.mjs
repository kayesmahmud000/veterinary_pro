import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export async function checkAdminCourseWorkspace({ seed, go, call, evaluate, until, temp, requests, products, curricula, state }) {
  let checks = 0;
  const set = (id, value) => evaluate(`(()=>{const e=document.getElementById(${JSON.stringify(id)});Object.getOwnPropertyDescriptor(e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const fillLesson = async (index, suffix, value) => set(await evaluate(`document.querySelectorAll('[data-course-lesson]')[${index}].querySelector('[id$="-${suffix}"]').id`), value);
  const shot = async name => {
    const image = await call("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
    await writeFile(path.join(temp, name), Buffer.from(image.data, "base64"));
  };
  let firstCourse;
  for (const role of ["ADMIN", "SUPER_ADMIN"])
    for (const locale of ["bn", "en"])
      for (const width of [320, 1440]) {
        await seed(role, locale);
        await call("Emulation.setDeviceMetricsOverride", { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
        await go("/admin/dashboard");
        await until(() => evaluate(`!!document.querySelector('[data-admin-course-shortcut] a[href="/admin/courses"]')`), "Dashboard course shortcut");
        await evaluate(`document.querySelector('[data-admin-course-shortcut] a').click()`);
        await until(() => evaluate(`!!document.querySelector('[data-admin-course-form]')`), "Dedicated course inputs");
        assert.equal(await evaluate(`document.querySelector('[data-workspace-nav="desktop"] a[href="/admin/courses"]').getAttribute('aria-current')`), "page");
        assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('[data-admin-course-form] input,[data-admin-course-form] textarea')).map(e=>e.id)`), ["product-title", "product-slug", "product-description"]);
        assert.equal(await evaluate("document.documentElement.scrollWidth>innerWidth"), false);
        checks += 3;
        const slug = `admin-course-${role.toLowerCase().replaceAll("_", "-")}-${locale}-${width}`;
        const title = locale === "bn" ? `পশুর যত্নের কোর্স ${role} ${width}` : `Animal care course ${role} ${width}`;
        await set("product-title", title);
        await set("product-description", "Synthetic course created using the administrative course workspace.");
        await set("product-slug", "bad slug");
        assert.equal(await evaluate(`document.querySelector('[data-admin-course-form]').checkValidity()`), false);
        await set("product-slug", slug);
        await shot(`admin-course-form-${role}-${locale}-${width}.png`);
        if (role === "ADMIN" && locale === "en" && width === 320) {
          state.createFailure = true;
          await evaluate(`document.querySelector('[data-admin-course-form]').requestSubmit()`);
          await until(() => evaluate(`!!document.querySelector('[data-admin-course-form] [role="alert"]')`), "Create failure feedback");
          assert.equal(await evaluate(`document.getElementById('product-title').value`), title);
          assert.equal([...products.values()].some(p => p.slug === slug), false);
          state.createFailure = false;
          checks += 2;
        }
        await evaluate(`document.querySelector('[data-admin-course-form]').requestSubmit()`);
        await until(() => evaluate(`!!document.querySelector('[data-admin-course-workspace] [data-course-editor]')`), "Created course opens video editor");
        const course = [...products.values()].find(p => p.slug === slug);
        assert.ok(course);
        firstCourse ??= course;
        assert.equal(await evaluate("location.pathname"), `/admin/courses/${course.id}`);
        assert.equal(await evaluate(`document.querySelector('[data-course-editor] h2').textContent`), title);
        assert.equal(course.type, "VIDEO_COURSE");
        assert.equal(course.contentProvider, "YOUTUBE");
        assert.equal(course.priceCents, 0);
        assert.equal(course.discountPriceCents, null);
        assert.ok(requests.some(r => r.route === "admin/products" && r.method === "POST" && r.body.slug === slug && r.body.contentProvider === "YOUTUBE"));
        assert.equal([...products.values()].filter(p => p.slug === slug).length, 1);
        checks += 9;
        await evaluate(`document.querySelector('[data-add-lesson]').click()`);
        await until(() => evaluate(`document.querySelectorAll('[data-course-lesson]').length===1`), "Main video inputs");
        await fillLesson(0, "title", "Main animal care lesson");
        await fillLesson(0, "url", "https://youtu.be/M7lc1UVf-VE");
        await evaluate(`document.querySelector('[data-add-lesson]').click()`);
        await until(() => evaluate(`document.querySelectorAll('[data-course-lesson]').length===2`), "Demo video inputs");
        await fillLesson(1, "title", "Public course introduction");
        await fillLesson(1, "url", "https://www.youtube.com/watch?v=M7lc1UVf-VE");
        await evaluate(`(()=>{const e=document.querySelectorAll('[data-course-lesson]')[1].querySelector('select');e.value='PUBLIC_DEMO';e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
        await evaluate(`document.querySelector('[data-save-lessons]').click()`);
        await until(() => evaluate(`document.querySelector('[data-save-lessons]')?.disabled===true&&document.querySelector('[data-save-lessons]').closest('form').getAttribute('aria-busy')==='false'`), "Video lessons saved");
        assert.equal(curricula.get(course.id).length, 2);
        assert.equal(curricula.get(course.id)[0].access, "ENROLLED");
        assert.equal(curricula.get(course.id)[1].access, "PUBLIC_DEMO");
        assert.equal(await evaluate("document.documentElement.scrollWidth>innerWidth"), false);
        await shot(`admin-course-videos-${role}-${locale}-${width}.png`);
        checks += 4;
        await go(`/admin/courses/${course.id}`);
        await until(() => evaluate(`document.querySelectorAll('[data-course-lesson]').length===2`), "Saved videos survive reload");
        await evaluate(`document.querySelector('[data-course-editor] > a[href="/admin/courses"]').click()`);
        await until(() => evaluate(`!!document.querySelector('[data-admin-courses-list] a[href="/admin/courses/${course.id}"]')`), "Saved course appears in course list");
        assert.equal(await evaluate(`document.querySelector('[data-admin-courses-list]').textContent.includes('Synthetic catalog guide')`), false);
        await evaluate(`document.querySelector('[data-admin-courses-list] a[href="/admin/courses/${course.id}"]').click()`);
        await until(() => evaluate(`document.querySelectorAll('[data-course-lesson]').length===2`), "Reopen course videos from list");
        checks += 3;
      }
  await seed("ADMIN", "en");
  await go("/admin/courses");
  await until(() => evaluate(`!!document.getElementById('catalog-search')`), "Course search form");
  await set("catalog-search", firstCourse.slug);
  await evaluate(`document.getElementById('catalog-search').closest('form').requestSubmit()`);
  await until(() => evaluate(`document.querySelectorAll('[data-admin-courses-list] [data-product-row]').length===1`), "Search courses by slug");
  assert.ok(requests.some(r => r.route === "admin/products" && r.method === "GET"));
  checks++;
  await go(`/admin/courses/${firstCourse.id}`);
  await until(() => evaluate(`!!document.querySelector('[data-course-editor] a[href="/admin/products/${firstCourse.id}"]')`), "Course publication link");
  await evaluate(`document.querySelector('[data-course-editor] a[href="/admin/products/${firstCourse.id}"]').click()`);
  await until(() => evaluate(`!!document.getElementById('product-reason')`), "Existing publication form");
  await set("product-reason", "Publish reviewed course videos");
  await evaluate(`document.querySelector('[data-product-action]').requestSubmit()`);
  await until(() => evaluate(`!!document.querySelector('dialog[open]')`), "Course publication requires confirmation");
  await evaluate(`document.querySelector('dialog button').click()`);
  await until(() => evaluate(`document.body.textContent.includes('Changes saved.')`), "Course published");
  assert.equal(firstCourse.isPublished, true);
  await go(`/admin/courses/${firstCourse.id}`);
  await until(() => evaluate(`document.querySelector('[data-add-lesson]')?.disabled===true`), "Published videos read only");
  checks += 2;
  for (const role of ["LEARNER", "VET", "FARMER", "BUYER"]) {
    await seed(role, "en");
    for (const route of ["/admin/courses", `/admin/courses/${firstCourse.id}`]) {
      await go(route, "/account/profile");
      assert.equal(await evaluate(`!!document.querySelector('[data-admin-course-form],[data-course-editor]')`), false);
      checks++;
    }
  }
  console.log(`Passed ${checks} admin course workspace checks. Screenshots: ${temp}`);
  return checks;
}
