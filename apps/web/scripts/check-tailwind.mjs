import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import postcss from "postcss";
import tailwindcss from "tailwindcss";
import loadConfig from "tailwindcss/loadConfig.js";
import postcssConfig from "../postcss.config.js";

const configPath = fileURLToPath(
  new URL("../tailwind.config.ts", import.meta.url),
);
test("Tailwind emits standard utilities, theme tokens, state and locale variants from actual source", async () => {
  const config = loadConfig(configPath);
  const files = [
    "src/lib/ui/site.styles.ts",
    "src/components/marketing/interactive.styles.ts",
    "src/components/auth/auth.styles.ts",
  ];
  const raw = (
    await Promise.all(
      files.map((file) =>
        readFile(new URL(`../${file}`, import.meta.url), "utf8"),
      ),
    )
  ).join("\n");
  const result = await postcss([
    tailwindcss({
      ...config,
      content: [{ raw: raw + ' "w-11/12 flex text-ink"', extension: "tsx" }],
    }),
  ]).process("@tailwind utilities;", { from: undefined });
  const rules = [];
  result.root.walkRules((rule) => rules.push(rule));
  const has = (selector, property, value) =>
    rules.some(
      (rule) =>
        selector.test(rule.selector) &&
        rule.nodes.some((d) => d.prop === property && d.value === value),
    );
  assert(
    has(/w-11/, "width", "91.666667%"),
    "standard Tailwind width utility must compile",
  );
  assert(has(/\.flex$/, "display", "flex"));
  assert(
    has(/input/, "font-size", "inherit"),
    "form controls must inherit font size rather than color",
  );
  assert(
    has(/\[aria-hidden=false\]/, "opacity", "1"),
    "active hero image state must compile",
  );
  assert(
    rules.some(
      (rule) =>
        rule.selector.includes("[aria-pressed=true]") &&
        rule.nodes.some((d) => d.prop === "background-color"),
    ),
    "selected controls must be styled",
  );
  assert(
    rules.some(
      (rule) =>
        rule.selector.includes("[lang=bn]") &&
        rule.nodes.some(
          (d) => d.prop === "font-family" && d.value.startsWith("Nirmala UI"),
        ),
    ),
    "Bangla font must compile from source strings",
  );
  assert(
    rules.some((rule) => rule.selector.includes("::backdrop")),
    "native dialog backdrop must compile",
  );
  assert(
    result.css.includes("(max-width: 799.01px)"),
    "existing narrow layout breakpoint must compile",
  );
  assert(!result.css.includes("@tailwind"));
});

test("PostCSS resolves the project theme and content independently of working directory", async () => {
  const entry = await readFile(
    new URL("../src/app/globals.css", import.meta.url),
    "utf8",
  );
  const result = await postcss([
    tailwindcss(postcssConfig.plugins.tailwindcss),
  ]).process(entry, { from: undefined });
  assert(
    result.css.includes("91.666667%"),
    "actual project utilities must compile",
  );
  assert(result.css.includes(".text-ink"), "configured theme must load");
  assert(
    !result.css.includes("border-style: solid; /*"),
    "default Preflight must stay disabled",
  );
});
