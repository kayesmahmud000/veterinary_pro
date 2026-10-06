import assert from "node:assert/strict";

// Run against a local production server: node scripts/check-localization.mjs http://localhost:3100
const base = new URL(process.argv[2] ?? "http://localhost:3100");
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname),
  "Use a local test server",
);
const routes = [
  ["/", "আপনার খামারের পূর্ণ চিত্র।", "A clearer picture of your farm."],
  [
    "/farm-management",
    "প্রতিটি প্রাণী। প্রতিটি দিন।",
    "Every animal. Every day.",
  ],
  ["/learning", "ব্যবহারিক জ্ঞান।", "Practical knowledge."],
  ["/veterinary-care", "পুরো ইতিহাস বোঝা", "Care starts with understanding"],
  ["/localization-test-missing", "পাতাটি পাওয়া যায়নি।", "Page not found."],
];

async function request(path, cookie) {
  const response = await fetch(new URL(path, base), {
    headers: {
      "Accept-Language": "en-US",
      ...(cookie ? { Cookie: cookie } : {}),
    },
  });
  return { response, html: await response.text() };
}

for (const [path, bangla, english] of routes) {
  for (const preference of [undefined, "invalid", "bn", "en"]) {
    const locale = preference === "en" ? "en" : "bn";
    const { response, html } = await request(
      path,
      preference && `vetralink-locale=${preference}`,
    );
    assert.equal(
      response.status,
      path.includes("missing") ? 404 : 200,
      `${path}: HTTP status`,
    );
    assert.match(
      html,
      new RegExp(`<html[^>]*lang="${locale}"`),
      `${path}: document language`,
    );
    assert.ok(
      html.includes(locale === "bn" ? bangla : english),
      `${path}: translated body`,
    );
    const title = html.match(/<title>([^<]*)<\/title>/)?.[1];
    const description = html.match(
      /<meta name="description" content="([^"]*)"/,
    )?.[1];
    assert.ok(title && description, `${path}: server-rendered metadata`);
    assert.equal(
      /[\u0980-\u09ff]/u.test(title),
      locale === "bn",
      `${path}: localized title`,
    );
    assert.equal(
      /[\u0980-\u09ff]/u.test(description),
      locale === "bn",
      `${path}: localized description`,
    );
    assert.equal((html.match(/<h1[ >]/g) ?? []).length, 1, `${path}: one H1`);
    assert.equal(
      (html.match(/<main[ >]/g) ?? []).length,
      1,
      `${path}: one main`,
    );
    assert.ok(!html.includes('href="#"'), `${path}: no dead links`);
    assert.match(
      response.headers.get("cache-control") ?? "",
      /private|no-store/,
      "Locale response cannot enter a shared cache",
    );
  }
}

// Exercise real Server Action forms without JavaScript, including input rejection and both directions.
for (const [path] of routes) {
  for (const locale of ["en", "bn", "unsupported"]) {
    const initialCookie =
      locale === "en" ? "vetralink-locale=bn" : "vetralink-locale=en";
    const { html } = await request(path, initialCookie);
    const form = html.match(
      /<form[^>]*class="language-switcher"[^>]*>([\s\S]*?)<\/form>/,
    )?.[1];
    assert.ok(form, "Language form must be server-rendered");
    const action = form.match(/name="(\$ACTION_ID_[^"]+)"/)?.[1];
    assert.ok(action, "Native form must include a Server Action");
    const data = new FormData();
    data.set(action, "");
    data.set("locale", locale);
    const returnTo = form.match(/name="returnTo" value="([^"]*)"/)?.[1];
    assert.equal(returnTo, path, "Form retains its actual route");
    data.set("returnTo", returnTo);
    const response = await fetch(new URL(path, base), {
      method: "POST",
      headers: {
        Origin: base.origin,
        Cookie: initialCookie,
        Accept: "text/html",
      },
      body: data,
      redirect: "manual",
    });
    const rendered = await response.text();
    assert.equal(
      new URL(response.url).pathname,
      path,
      "Selection preserves the current URL",
    );
    const cookie = response.headers.get("set-cookie");
    if (locale === "unsupported") {
      assert.ok(
        rendered.includes('<html lang="en">'),
        "Invalid selection retains the locale",
      );
      assert.equal(
        cookie,
        null,
        "Invalid selections must not set a preference",
      );
    } else {
      assert.equal(
        response.status,
        303,
        "Native action redirects after setting preference",
      );
      assert.equal(
        response.headers.get("location"),
        path,
        "Selection returns to the same route",
      );
      assert.match(cookie ?? "", new RegExp(`vetralink-locale=${locale}`));
      assert.match(cookie, /HttpOnly/i);
      assert.match(cookie, /SameSite=lax/i);
      assert.match(cookie, /Path=\//i);
      assert.match(cookie, /Max-Age=31536000/i);
      assert.match(cookie, /Secure/i, "Production preference cookie is secure");
      const refreshed = await request(path, cookie.split(";")[0]);
      assert.ok(
        refreshed.html.includes(`<html lang="${locale}">`),
        "Redirect/reload reads the selected locale",
      );
    }
  }
}

const isolated = await Promise.all([
  request("/learning", "vetralink-locale=en"),
  request("/learning", "vetralink-locale=bn"),
]);
assert.match(isolated[0].html, /<html[^>]*lang="en"/);
assert.match(isolated[1].html, /<html[^>]*lang="bn"/);

// Hidden fields are editable: unsafe return targets must stay on this website.
const action = isolated[0].html.match(/name="(\$ACTION_ID_[^"]+)"/)?.[1];
assert.ok(action);
for (const returnTo of [
  "https://example.invalid",
  "//example.invalid",
  "/\\example.invalid",
  "/\r\ninvalid",
  "relative-path",
]) {
  const data = new FormData();
  data.set(action, "");
  data.set("locale", "en");
  data.set("returnTo", returnTo);
  const response = await fetch(new URL("/learning", base), {
    method: "POST",
    headers: { Origin: base.origin },
    body: data,
    redirect: "manual",
  });
  assert.equal(response.status, 303);
  assert.equal(
    response.headers.get("location"),
    "/",
    "Unsafe return URLs fall back to home",
  );
}
console.log(
  "Passed: 20 localized GETs, 15 native language-form submissions, reload persistence, concurrent locale isolation and 5 unsafe return-URL checks.",
);
