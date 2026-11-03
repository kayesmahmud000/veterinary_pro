import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";

export async function checkIconActions({
  seed,
  go,
  call,
  evaluate,
  until,
  temp,
}) {
  let checks = 0;
  for (const role of ["ADMIN", "SUPER_ADMIN"])
    for (const locale of ["bn", "en"])
      for (const width of [320, 1440]) {
        await seed(role, locale);
        await call("Emulation.setDeviceMetricsOverride", {
          width,
          height: 1000,
          deviceScaleFactor: 1,
          mobile: width === 320,
        });
        for (const route of [
          "/admin/dashboard",
          "/admin/users",
          "/admin/products",
          "/admin/orders",
          "/admin/triage",
          "/admin/media",
          "/courses",
          "/blog",
        ]) {
          await go(route);
          await until(
            () =>
              evaluate(`!!document.querySelector('main [data-icon-action]')`),
            `Icon controls on ${route}`,
          );
          const result = await evaluate(
            `(()=>({overflow:document.documentElement.scrollWidth>innerWidth,icons:Array.from(document.querySelectorAll('main [data-icon-action]')).filter(e=>e.getClientRects().length).map(e=>({name:e.getAttribute('aria-label'),title:e.getAttribute('title'),text:e.textContent.trim(),width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height,decorative:!!e.querySelector('svg[aria-hidden="true"]')}))}))()`,
          );
          assert.equal(
            result.overflow,
            false,
            `${route} must not overflow the viewport`,
          );
          assert.ok(result.icons.length, `${route} should expose icon actions`);
          for (const icon of result.icons) {
            assert.ok(
              icon.name && icon.title,
              `${route}: localized action name/title required`,
            );
            assert.equal(
              icon.text,
              "",
              `${route}: icon action should be compact`,
            );
            assert.equal(
              icon.decorative,
              true,
              `${route}: labelled control owns the accessible name`,
            );
            assert.ok(
              icon.width >= 44 && icon.width <= 52 && icon.height >= 44,
              `${route}: target must stay compact and at least44px, got ${icon.width}x${icon.height}`,
            );
          }
          checks++;
          if (route === "/admin/dashboard" || route === "/courses") {
            await writeFile(
              `${temp}/icons-${route.includes("dashboard") ? "dashboard" : "courses"}-${role}-${locale}-${width}.png`,
              Buffer.from(
                (await call("Page.captureScreenshot", { format: "png" })).data,
                "base64",
              ),
            );
          }
        }
      }
  console.log(
    `Passed ${checks} icon action layout/accessibility browser checks. Screenshots: ${temp}`,
  );
  return checks;
}
