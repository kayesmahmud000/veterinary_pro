import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(file) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
  });
  const module = { exports: {} };
  vm.runInNewContext(
    outputText,
    { module, exports: module.exports, require },
    { filename: file },
  );
  return module.exports;
}
const content = load("../src/lib/public-content.ts");
const directory = load("../src/lib/doctor-directory.ts");
const records = JSON.parse(
  readFileSync(new URL("../src/content/doctors.json", import.meta.url), "utf8"),
);
const translations = load("../src/lib/i18n/public-pages.ts");

function keys(value, prefix = "") {
  return Object.entries(value)
    .flatMap(([key, item]) =>
      item && typeof item === "object"
        ? keys(item, `${prefix}${key}.`)
        : [`${prefix}${key}`],
    )
    .sort();
}

test("public copy and all editorial articles have complete bilingual structure", () => {
  assert.deepEqual(
    keys(translations.publicPagesBn),
    keys(translations.publicPagesEn),
  );
  assert.equal(content.blogPosts.length, 3);
  for (const post of content.blogPosts) {
    assert.ok(/^[a-z0-9-]+$/.test(post.slug));
    assert.ok(!Number.isNaN(Date.parse(post.publishedAt)));
    assert.equal(post.author.en, "Khamar School editorial team");
    assert.match(post.author.bn, /খামার স্কুল/);
    for (const locale of ["bn", "en"]) {
      assert.ok(post.content[locale].title && post.content[locale].summary);
      assert.ok(post.content[locale].sections.length >= 3);
    }
  }
});

test("blog search, topic filters and unknown slugs use real editorial content", () => {
  assert.equal(content.findBlogPost("missing"), undefined);
  assert.equal(content.findBlogPost("constructor"), undefined);
  const first = content.blogPosts[0];
  assert.equal(content.findBlogPost(first.slug).slug, first.slug);
  assert.equal(
    content.filterBlogPosts({ q: first.content.en.title, locale: "en" }).length,
    1,
  );
  assert.equal(
    content.filterBlogPosts({ q: first.content.bn.title, locale: "bn" }).length,
    1,
  );
  assert.ok(
    content.filterBlogPosts({ topic: first.topic, locale: "bn" }).length > 0,
  );
  assert.equal(
    content.filterBlogPosts({ q: "unfindable-query", locale: "en" }).length,
    0,
  );
  assert.equal(
    content.filterBlogPosts({ topic: "unknown", locale: "en" }).length,
    3,
  );
  assert.equal(
    content.filterBlogPosts({
      q: ["a", "b"],
      topic: ["records", "planning"],
      locale: "en",
    }).length,
    3,
  );
});

test("only published doctors are returned; published demo profiles remain clearly marked", () => {
  const valid = directory.validateDoctorProfiles(records);
  assert.equal(valid.length, 2);
  assert.ok(valid.every((p) => p.isDemo && p.published));
  const hidden = { ...valid[0], id: "unpublished-doctor", published: false };
  assert.equal(
    directory.listDoctors([...valid, hidden], { locale: "bn" }).length,
    2,
  );
  assert.equal(directory.findDoctor([...valid, hidden], hidden.id), undefined);
  assert.equal(directory.findDoctor(valid, "missing"), undefined);
  assert.equal(directory.findDoctor(valid, "constructor"), undefined);
  assert.equal(directory.findDoctor(valid, valid[0].id).id, valid[0].id);
  assert.equal(
    directory.listDoctors(valid, { locale: "en", q: valid[0].name.en }).length,
    1,
  );
  assert.equal(
    directory.listDoctors(valid, { locale: "bn", q: valid[0].name.bn }).length,
    1,
  );
  assert.equal(
    directory.listDoctors(valid, { locale: "en", specialty: "dairy" }).length,
    1,
  );
  assert.equal(
    directory.listDoctors(valid, { locale: "bn", q: "unfindable-query" })
      .length,
    0,
  );
  assert.equal(
    directory.listDoctors(valid, { locale: "bn", specialty: "invalid" }).length,
    2,
  );
  assert.equal(
    directory.listDoctors(valid, {
      locale: "bn",
      q: ["a", "b"],
      specialty: ["dairy", "poultry"],
    }).length,
    2,
  );
});

test("doctor publication rejects private fields, invalid identities, missing translations and remote portraits", () => {
  const profile = records[0];
  for (const change of [
    { email: "private@example.invalid" },
    { id: "../private" },
    { name: { bn: "", en: "Sample" } },
    { photo: "https://external.invalid/photo.jpg" },
    { yearsExperience: -1 },
  ]) {
    assert.throws(() =>
      directory.validateDoctorProfiles([{ ...profile, ...change }]),
    );
  }
  assert.throws(() => directory.validateDoctorProfiles([profile, profile]));
  assert.equal(directory.validateDoctorProfiles([]).length, 0);
});

const navigation = load("../src/lib/public-navigation.ts");
test("public navigation exposes real grouped routes and all direct footer destinations", () => {
  const names = Object.fromEntries(
    [
      "farm",
      "learning",
      "veterinary",
      "blog",
      "about",
      "help",
      "doctors",
      "demo",
      "guides",
      "courses",
    ].map((key) => [key, `label-${key}`]),
  );
  const groups = navigation.getPublicNavGroups({ navigation: names });
  assert.equal(groups.length, 7);
  assert.equal(groups[0].children[1].href, "/#farm-demo");
  assert.equal(groups[1].children[1].href, "/learning#guides");
  assert.equal(groups[2].href, "/learning#courses");
  assert.equal(groups[3].children[1].href, "/doctors");
  const links = navigation.getPublicNavItems({ navigation: names });
  const hrefs = Array.from(links, (item) => item.href);
  assert.deepEqual(hrefs, [
    "/farm-management",
    "/#farm-demo",
    "/learning",
    "/learning#guides",
    "/learning#courses",
    "/veterinary-care",
    "/doctors",
    "/blog",
    "/about",
    "/help",
  ]);
  assert.ok(!hrefs.includes("/pricing") && !hrefs.includes("/catalog"));
});

test("active navigation matches path boundaries, grouped details and exact sections", () => {
  assert.equal(
    navigation.isPublicNavItemActive(
      "/blog",
      "/blog/one-place-for-farm-notes",
      "",
    ),
    true,
  );
  assert.equal(
    navigation.isPublicNavItemActive("/blog", "/blogger", ""),
    false,
  );
  assert.equal(
    navigation.isPublicNavItemActive(
      "/learning#courses",
      "/learning",
      "#courses",
    ),
    true,
  );
  assert.equal(
    navigation.isPublicNavItemActive(
      "/learning#courses",
      "/learning",
      "#guides",
    ),
    false,
  );
  assert.equal(
    navigation.isPublicNavItemActive("/learning", "/learning", "#courses"),
    false,
  );
  assert.equal(
    navigation.isPublicNavItemActive(
      "/learning",
      "/learning/animal-records",
      "",
    ),
    true,
  );
  assert.equal(navigation.isPublicNavItemActive("/#farm-demo", "/", ""), false);
  assert.equal(
    navigation.isPublicNavItemActive("/#farm-demo", "/", "#farm-demo"),
    true,
  );
  assert.equal(
    navigation.isPublicNavGroupActive(
      { href: "/veterinary-care", children: [{ href: "/doctors" }] },
      "/doctors/demo-rafiq-hasan",
      "",
    ),
    true,
  );
  assert.equal(
    navigation.isPublicNavGroupActive(
      {
        href: "/learning",
        children: [{ href: "/learning" }, { href: "/learning#guides" }],
      },
      "/learning",
      "#courses",
    ),
    false,
  );
});
