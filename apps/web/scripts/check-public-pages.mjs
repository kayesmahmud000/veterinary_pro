import assert from "node:assert/strict";
const base = new URL(process.argv[2] ?? "http://localhost:3100");
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(base.hostname));
let checks = 0;
async function request(path, locale) {
  const response = await fetch(new URL(path, base), {
    headers: { Cookie: `vetralink-locale=${locale}` },
  });
  return { response, html: await response.text() };
}
const count = (html, attribute) =>
  (html.match(new RegExp(`<div[^>]*${attribute}(?:[ =])`, "g")) ?? []).length;
for (const locale of ["bn", "en"]) {
  for (const [path, expected] of [
    ["/blog", 3],
    ["/blog?topic=records", 1],
    ["/blog?topic=planning", 1],
    ["/blog?topic=care", 1],
    ["/blog?topic=unknown", 3],
    ["/blog?topic=records&topic=care", 3],
    ["/blog?q=unfindable-query", 0],
    ["/blog?q=a&q=b", 3],
  ]) {
    const { response, html } = await request(path, locale);
    assert.equal(response.status, 200);
    assert.equal(count(html, "data-blog-card"), expected, `${locale} ${path}`);
    checks++;
  }
  for (const [path, expected] of [
    ["/doctors", 2],
    ["/doctors?specialty=dairy", 1],
    ["/doctors?specialty=poultry", 1],
    ["/doctors?specialty=pets", 0],
    ["/doctors?specialty=unknown", 2],
    ["/doctors?specialty=dairy&specialty=poultry", 2],
    ["/doctors?q=unfindable-query", 0],
    ["/doctors?q=a&q=b", 2],
  ]) {
    const { response, html } = await request(path, locale);
    assert.equal(response.status, 200);
    assert.equal(
      count(html, "data-doctor-card"),
      expected,
      `${locale} ${path}`,
    );
    assert.ok(
      html.includes(
        locale === "bn" ? "কাল্পনিক পরিচিতি" : "fictional profiles",
      ),
    );
    checks++;
  }
  for (const path of [
    "/doctors/demo-rafiq-hasan",
    "/doctors/demo-nadia-rahman",
  ]) {
    const { response, html } = await request(path, locale);
    assert.equal(response.status, 200);
    assert.ok(
      html.includes(locale === "bn" ? "কাল্পনিক পরিচিতি" : "fictional profile"),
    );
    assert.match(html, /<meta name="robots" content="noindex, follow"/);
    assert.ok(!html.includes('href="/checkout'));
    checks++;
  }
  for (const path of [
    "/blog/%6fne-place-for-farm-notes",
    "/doctors/%64emo-rafiq-hasan",
  ]) {
    const { response, html } = await request(path, locale);
    assert.equal(
      response.status,
      200,
      `Encoded published ID: ${locale} ${path}`,
    );
    assert.ok(html.includes(`<html lang="${locale}"`));
    checks++;
  }
  for (const path of [
    "/blog/missing",
    "/doctors/missing",
    "/blog/constructor",
    "/doctors/constructor",
  ]) {
    const { response, html } = await request(path, locale);
    assert.equal(response.status, 404, `${locale} ${path}`);
    assert.ok(html.includes(`<html lang="${locale}"`));
    assert.equal((html.match(/<main(?: |>|\n)/g) ?? []).length, 1);
    assert.equal((html.match(/<h1(?: |>|\n)/g) ?? []).length, 1);
    assert.match(html, /<meta name="robots" content="noindex, follow"/);
    checks++;
  }
  const target = locale === "bn" ? "ডা. রফিক হাসান" : "Dr. Rafiq Hasan";
  const { html } = await request(
    `/doctors?q=${encodeURIComponent(target)}`,
    locale,
  );
  assert.equal(count(html, "data-doctor-card"), 1);
  checks++;
  const attack = '"><img src=x onerror=alert(1)>';
  const escaped = await request(
    `/blog?q=${encodeURIComponent(attack)}`,
    locale,
  );
  assert.ok(!escaped.html.includes("<img src=x onerror=alert(1)>"));
  checks++;
  for (const path of ["/about", "/help", "/blog", "/doctors"]) {
    const { html } = await request(path, locale);
    for (const href of [
      "/blog",
      "/about",
      "/help",
      "/doctors",
      "/#farm-demo",
      "/learning#guides",
    ])
      assert.ok(
        html.includes(`href="${href}"`),
        `${path}: working public links`,
      );
    assert.ok(html.includes("<noscript>"));
    checks++;
  }
}
console.log(
  `Passed: ${checks} public list/filter/detail/404/search/escaping/navigation checks in both locales.`,
);
