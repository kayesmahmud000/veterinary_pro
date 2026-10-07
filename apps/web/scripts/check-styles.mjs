import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

export async function checkStyles(root) {
  const errors = [];
  const sourceRoot = path.join(root, "src");
  async function visit(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(file);
        continue;
      }
      const relative = path.relative(root, file);
      const source = await readFile(file, "utf8");
      if (/\.(css|scss|sass|less|styl)$/.test(file)) {
        const directives = source.replace(/\/\*[\s\S]*?\*\//g, "").trim();
        if (
          relative !== path.join("src", "app", "globals.css") ||
          directives !==
            "@tailwind base;\n@tailwind components;\n@tailwind utilities;"
        ) {
          errors.push(
            `${relative}: use Tailwind utilities; custom stylesheets are prohibited`,
          );
        }
        continue;
      }
      if (!/\.[cm]?[jt]sx?$/.test(file)) continue;
      const ast = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
        file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
      );
      function report(node, message) {
        const { line } = ast.getLineAndCharacterOfPosition(node.getStart(ast));
        errors.push(`${relative}:${line + 1}: ${message}`);
      }
      function inspect(node) {
        if (ts.isJsxAttribute(node) && node.name.getText(ast) === "style")
          report(node, "replace inline styles with Tailwind utilities");
        if (
          (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
          node.tagName.getText(ast) === "style"
        )
          report(node, "style tags/styled-jsx are prohibited");
        if (
          ts.isTaggedTemplateExpression(node) &&
          /^(css|styled)(\b|\.)/.test(node.tag.getText(ast))
        )
          report(node, "CSS-in-JS is prohibited");
        if (ts.isPropertyAccessExpression(node) && node.name.text === "style")
          report(node, "use Tailwind classes instead of DOM inline styles");
        if (
          ts.isPropertyAssignment(node) &&
          !ts.isStringLiteral(node.initializer) &&
          node.name.getText(ast).replace(/["']/g, "") === "style"
        )
          report(
            node,
            "replace inline styles in prop objects with Tailwind utilities",
          );
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          node.expression.name.text === "setAttribute" &&
          node.arguments[0] &&
          ts.isStringLiteral(node.arguments[0]) &&
          node.arguments[0].text === "style"
        )
          report(node, "use Tailwind classes instead of DOM inline styles");
        if (
          ts.isImportDeclaration(node) &&
          ts.isStringLiteral(node.moduleSpecifier)
        ) {
          const imported = node.moduleSpecifier.text;
          if (
            /\.(css|scss|sass|less|styl)$/.test(imported) &&
            !(
              relative === path.join("src", "app", "layout.tsx") &&
              imported === "./globals.css"
            )
          )
            report(
              node,
              "only the root Tailwind entry stylesheet may be imported",
            );
          if (/^(styled-components|@emotion\/|styled-jsx)/.test(imported))
            report(node, "CSS-in-JS dependencies are prohibited");
        }
        ts.forEachChild(node, inspect);
      }
      inspect(ast);
    }
  }
  await visit(sourceRoot);
  for (const file of ["tailwind.config.ts", "postcss.config.js"]) {
    try {
      await readFile(path.join(root, file), "utf8");
    } catch {
      errors.push(`${file}: Tailwind build configuration is required`);
    }
  }
  return errors;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const errors = await checkStyles(root);
  if (errors.length) {
    console.error(errors.join("\n"));
    process.exitCode = 1;
  } else
    console.log(
      "Tailwind styling policy passed: no custom CSS or inline styles.",
    );
}
