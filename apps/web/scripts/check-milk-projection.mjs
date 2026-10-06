import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Compile the actual utility in memory so this check also works on Node 20.
const source = readFileSync(
  new URL("../src/lib/milk-projection.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
});
const { parsePlannerNumber, projectMilk } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);

test("supports Bangla and ASCII decimal amounts, including zero", () => {
  for (const [input, expected] of [
    ["১৮.৫", 18.5],
    [" 60 ", 60],
    ["০", 0],
    [".5", 0.5],
    ["10000", 10000],
  ]) {
    assert.equal(parsePlannerNumber(input), expected);
  }
});

test("rejects empty, malformed, negative, nonfinite and excessive figures", () => {
  for (const input of [
    "",
    "  ",
    "-1",
    "1,000",
    "1.2.3",
    "18 liters",
    "1e3",
    "Infinity",
    "NaN",
    "১০০০০.১",
    "10001",
  ]) {
    assert.equal(parsePlannerNumber(input), null, input);
  }
});

test("projects seven and thirty days without rounding intermediate values", () => {
  assert.deepEqual(projectMilk(18.5, 60, 7), { liters: 129.5, value: 7770 });
  assert.deepEqual(projectMilk(18.5, 60, 30), { liters: 555, value: 33300 });
  assert.deepEqual(projectMilk(0, 60, 30), { liters: 0, value: 0 });
  assert.deepEqual(projectMilk(18, 0, 7), { liters: 126, value: 0 });
});
