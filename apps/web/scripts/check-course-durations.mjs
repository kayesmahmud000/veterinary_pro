import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
function compile(file, overrides = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(file, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
        jsx: ts.JsxEmit.ReactJSX,
      },
    },
  );
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name) => overrides[name] ?? require(name),
    module,
    module.exports,
  );
  return module.exports;
}
const { formatLessonDuration } = compile("../src/lib/courses/duration.ts");
for (const [locale, seconds, expected] of [
  ["en", 1, "0:01"],
  ["en", 755, "12:35"],
  ["en", 3723, "1:02:03"],
  ["en", 93784, "26:03:04"],
  ["bn", 1, "০:০১"],
  ["bn", 755, "১২:৩৫"],
  ["bn", 3723, "১:০২:০৩"],
  ["bn", 93784, "২৬:০৩:০৪"],
])
  test(`${locale} formats ${seconds} seconds`, () =>
    assert.equal(formatLessonDuration(seconds, locale), expected));
const { getCourseMessages } = compile("../src/lib/i18n/courses.ts");
const { renderToStaticMarkup } = require("react-dom/server");
const { createElement } = require("react");
for (const locale of ["bn", "en"]) {
  const { LessonDuration } = compile(
    "../src/components/courses/lesson-duration.tsx",
    {
      "@/components/auth/auth-provider": { useAuth: () => ({ locale }) },
      "@/lib/i18n/courses": { getCourseMessages },
      "@/lib/courses/duration": { formatLessonDuration },
    },
  );
  test(`${locale} omits unknown and invalid times without rendering a clock or zero`, () => {
    for (const seconds of [
      undefined,
      null,
      0,
      -1,
      NaN,
      Infinity,
      1.5,
      2147483648,
    ])
      assert.equal(
        renderToStaticMarkup(createElement(LessonDuration, { seconds })),
        "",
      );
  });
  test(`${locale} renders real time with localized accessible units`, () => {
    const html = renderToStaticMarkup(
      createElement(LessonDuration, { seconds: 3723 }),
    );
    assert.ok(html.includes(formatLessonDuration(3723, locale)));
    assert.ok(html.includes(locale === "bn" ? "ঘণ্টা" : "hour"));
    assert.ok(html.includes(locale === "bn" ? "মিনিট" : "minutes"));
    assert.ok(html.includes(locale === "bn" ? "সেকেন্ড" : "seconds"));
    assert.ok(html.includes('aria-hidden="true"'));
  });
}
