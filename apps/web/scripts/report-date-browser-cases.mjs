import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import path from "node:path";

export async function checkReportDates({
  evaluate,
  call,
  until,
  requests,
  set,
  role,
  locale,
  width,
  temp,
}) {
  let checks = 0;
  const check = (actual, expected, message) => {
    assert.deepEqual(actual, expected, message);
    checks++;
  };
  const snapshot = () =>
    evaluate(`document.querySelector('[data-platform-report]').textContent`);
  const baseline = await snapshot();
  const reads = () =>
    requests.filter(
      (r) => r.method === "GET" && r.route === "admin/platform/reports",
    ).length;
  const before = reads();
  const submit = () =>
    evaluate(`document.getElementById('from').closest('form').requestSubmit()`);
  const messages =
    locale === "bn"
      ? {
          order: "শেষের তারিখ শুরুর তারিখের পরে হতে হবে।",
          required: "একটি তারিখ দিন।",
          length: "সর্বোচ্চ ৩৬৬ দিনের সীমা বেছে নিন।",
          future: "নির্বাচিত সময় অঞ্চলে শেষের তারিখ আগামীকালের পরে হতে পারবে না।",
        }
      : {
          order: "End date must be after start date.",
          required: "Enter a date.",
          length: "Choose a range of at most 366 days.",
          future: "End date cannot be later than tomorrow in the selected timezone.",
        };
  const future = await evaluate(`({from:new Date().toISOString().slice(0,10),to:new Date(Date.now()+2*86400000).toISOString().slice(0,10)})`);
  for (const [from, to, field, error] of [
    ["2026-10-20", "2026-10-01", "to", "order"],
    ["2026-10-01", "2026-10-01", "to", "order"],
    ["2024-01-01", "2025-01-02", "to", "length"],
    [future.from, future.to, "to", "future"],
    ["", "", "from", "required"],
  ]) {
    await set("from", from);
    await set("to", to);
    await submit();
    check(
      await evaluate(
        `document.getElementById('${field}').getAttribute('aria-invalid')`,
      ),
      "true",
      "Invalid date is marked",
    );
    check(
      await evaluate(
        `document.getElementById('${field}').getAttribute('aria-describedby')`,
      ),
      `${field}-error`,
      "Error is associated with field",
    );
    check(
      await evaluate(`document.getElementById('${field}-error').textContent`),
      messages[error],
      "Specific translated date error",
    );
    await until(
      () => evaluate(`document.activeElement.id==='${field}'`),
      "First invalid date focused",
    );
    check(await snapshot(), baseline, "Rejected dates preserve prior report");
    check(reads(), before, "Rejected dates do not request another report");
    check(
      await evaluate(`!!document.querySelector('[data-report-unapplied]')`),
      true,
      "Unapplied edits are explained",
    );
    check(
      await evaluate(
        `Array.from(document.querySelectorAll('[data-platform-action] fieldset')).every(e=>e.disabled)`,
      ),
      true,
      "Exports stay disabled for unapplied edits",
    );
    check(
      await evaluate(
        `!/password|reason|পাসওয়ার্ড|কারণ/i.test(document.querySelector('[data-report-date-errors]').textContent)`,
      ),
      true,
      "Date feedback excludes password/reason",
    );
  }
  check(
    await evaluate(
      `document.getElementById('to').getAttribute('aria-invalid')`,
    ),
    "true",
    "Both missing dates are marked",
  );
  await writeFile(
    path.join(temp, `date-errors-${role}-${locale}-${width}.png`),
    Buffer.from((await call("Page.captureScreenshot")).data, "base64"),
  );
  await set("from", "2026-09-01");
  await set("to", "2026-09-02");
  await set("timezone", "Asia/Dhaka");
  check(
    await evaluate(`!!document.querySelector('[data-report-date-errors]')`),
    false,
    "Correction clears stale errors",
  );
  check(
    await evaluate(
      `document.getElementById('from').getAttribute('aria-invalid')`,
    ),
    "false",
    "Corrected date clears invalid state",
  );
  await evaluate(
    `document.getElementById('from').closest('form').querySelector('button[type=submit]').focus()`,
  );
  for (const type of ["keyDown", "keyUp"])
    await call("Input.dispatchKeyEvent", {
      type,
      key: "Enter",
      code: "Enter",
      windowsVirtualKeyCode: 13,
      ...(type === "keyDown" ? { text: "\r", unmodifiedText: "\r" } : {}),
    });
  await until(
    () =>
      evaluate(
        `document.querySelector('[data-platform-report]')?.textContent.includes('2026-08-31T18:00:00.000Z')`,
      ),
    "Keyboard applies Dhaka half-open range",
  );
  check(
    await evaluate(`!!document.querySelector('[data-report-unapplied]')`),
    false,
    "Applied dates clear notice",
  );
  check(
    requests.filter(
      (r) => r.route === "admin/platform/reports" && r.method === "GET",
    ).length,
    before + 1,
    "One corrected report request",
  );
  // Restore the original UTC selection for existing export assertions.
  await set("from", "2026-10-01");
  await set("to", "2026-10-02");
  await set("timezone", "UTC");
  await submit();
  await until(
    () =>
      evaluate(
        `document.querySelector('[data-platform-report]')?.textContent.includes('2026-10-01T00:00:00.000Z')`,
      ),
    "UTC report restored",
  );
  return checks;
}
