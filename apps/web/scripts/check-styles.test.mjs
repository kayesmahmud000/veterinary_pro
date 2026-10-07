import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { checkStyles } from "./check-styles.mjs";

async function fixture(t, source, extraFile) {
  const root = await mkdtemp(path.join(tmpdir(), "vetralink-style-policy-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "src/app"), { recursive: true });
  await writeFile(
    path.join(root, "src/app/globals.css"),
    "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n",
  );
  await writeFile(path.join(root, "src/app/layout.tsx"), source);
  await writeFile(path.join(root, "tailwind.config.ts"), "export default {};");
  await writeFile(path.join(root, "postcss.config.js"), "module.exports = {};");
  if (extraFile)
    await writeFile(
      path.join(root, "src/app", extraFile.name),
      extraFile.content,
    );
  return checkStyles(root);
}

test("accepts utilities, static class maps and native SVG attributes", async (t) => {
  assert.deepEqual(
    await fixture(
      t,
      'import "./globals.css"; const styles = { card: "grid gap-4 max-[799px]:block" }; export default () => <svg className={styles.card} fill="none"><path stroke="currentColor" /></svg>;',
    ),
    [],
  );
});
for (const [name, source, message] of [
  [
    "inline styles",
    "export default () => <div style={{ width: 100 }} />;",
    /inline styles/,
  ],
  [
    "styled JSX",
    "export default () => <style jsx>{`div { color: red; }`}</style>;",
    /style tags/,
  ],
  [
    "DOM style mutation",
    'document.body.style.overflow = "hidden";',
    /DOM inline styles/,
  ],
  [
    "inline styles through spread props",
    'const props = { style: { color: "red" } }; export default () => <div {...props} />;',
    /inline styles/,
  ],
  [
    "DOM style attributes",
    'el.setAttribute("style", "color:red");',
    /DOM inline styles/,
  ],
  ["CSS in JS", "const thing = styled.div`color: red;`;", /CSS-in-JS/],
  [
    "CSS imports",
    'import styles from "./card.module.css";',
    /stylesheet may be imported/,
  ],
])
  test(`rejects ${name}`, async (t) =>
    assert((await fixture(t, source)).some((error) => message.test(error))));
test("rejects CSS modules even when not imported", async (t) => {
  assert(
    (
      await fixture(t, 'export default () => <div className="p-4" />;', {
        name: "card.module.css",
        content: ".card { padding: 16px; }",
      })
    ).some((error) => error.includes("custom stylesheets")),
  );
});
test("rejects custom selectors in the global Tailwind entry", async (t) => {
  assert(
    (
      await fixture(t, "", {
        name: "globals.css",
        content: "@tailwind utilities;\n.card { color: red; }",
      })
    ).some((error) => error.includes("custom stylesheets")),
  );
});
