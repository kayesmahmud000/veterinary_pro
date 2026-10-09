import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url);
function compile(file, overrides = {}) {
  const url = new URL(file, import.meta.url);
  if (!existsSync(url)) return {};
  const source = readFileSync(url, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  }).outputText;
  const mod = { exports: {} };
  new Function("require", "module", "exports", output)(
    (name) => overrides[name] ?? require(name),
    mod,
    mod.exports,
  );
  return mod.exports;
}
const copy = compile("../src/lib/i18n/workspace-shell.ts");
const nav = compile("../src/lib/workspace/navigation.ts", {
  "../i18n/workspace-shell": copy,
});
const user = (role, required = false) => ({
  id: "550e8400-e29b-41d4-a716-446655440000",
  name: "Synthetic User",
  email: "synthetic@example.test",
  role,
  status: "ACTIVE",
  isEmailVerified: false,
  maskedPhone: null,
  avatarUrl: null,
  createdAt: "2026-10-08T00:00:00Z",
  roleVersion: 0,
  farmerOnboardingRequired: required,
});
test("learners land on home, other ready identities on dashboard; mandatory setup wins", () => {
  assert.equal(typeof nav.getPostLoginDestination, "function");
  assert.equal(nav.getPostLoginDestination(user("LEARNER")), "/");
  assert.equal(nav.getPostLoginDestination(user("LEARNER"), "/dashboard"), "/");
  assert.equal(
    nav.getPostLoginDestination(user("LEARNER"), "/dashboard?bad=1"),
    "/",
  );
  assert.equal(
    nav.getPostLoginDestination(user("LEARNER"), "https://evil.test"),
    "/",
  );
  assert.equal(
    nav.getPostLoginDestination(
      user("LEARNER"),
      "/account/profile?section=access",
    ),
    "/account/profile?section=access",
  );
  for (const role of ["FARMER", "BUYER", "VET", "ADMIN", "SUPER_ADMIN"])
    assert.equal(nav.getPostLoginDestination(user(role)), "/dashboard");
  assert.equal(
    nav.getPostLoginDestination(user("FARMER", true), "/account/profile"),
    "/account/farm-onboarding",
  );
  assert.equal(
    nav.getPostLoginDestination(
      user("BUYER"),
      "/account/profile?section=access",
    ),
    "/account/profile?section=access",
  );
});
test("return URLs reject external, ambiguous, API and unreleased routes", () => {
  assert.equal(typeof nav.validateWorkspaceReturnTo, "function");
  for (const value of [
    undefined,
    "",
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "/%5cevil.test",
    "/%255cevil.test",
    "/api/auth/logout",
    "/vet",
    "/dashboard/unknown",
    "/account/role-requests/not-an-id",
    "/dashboard\n",
    "/account/profile?returnTo=https://evil.test",
  ])
    assert.equal(nav.validateWorkspaceReturnTo(value), null, String(value));
  for (const path of [
    "/dashboard",
    "/farm",
    "/account/farm-onboarding",
    "/account/profile?section=access",
    "/admin/role-requests?status=PENDING",
    "/account/role-requests/550e8400-e29b-41d4-a716-446655440000",
  ])
    assert.equal(nav.validateWorkspaceReturnTo(path), path);
});
test("navigation follows exact platform roles without inventing operational pages", () => {
  assert.equal(typeof nav.getWorkspaceNav, "function");
  for (const role of [
    "LEARNER",
    "FARMER",
    "BUYER",
    "VET",
    "ADMIN",
    "SUPER_ADMIN",
  ]) {
    const items = nav.getWorkspaceNav(user(role), "en");
    const hrefs = items.map((item) => item.href);
    assert.equal(hrefs.includes("/dashboard"), role !== "LEARNER");
    assert.equal(
      hrefs[0],
      role === "LEARNER" ? "/account/profile" : "/dashboard",
    );
    assert.ok(hrefs.includes("/account/profile"));
    assert.equal(
      hrefs.includes("/account/role-requests/new"),
      role === "LEARNER",
    );
    assert.equal(
      hrefs.includes("/admin/role-requests"),
      ["ADMIN", "SUPER_ADMIN"].includes(role),
    );
    assert.equal(
      hrefs.includes("/admin/administrative-access"),
      role === "SUPER_ADMIN",
    );
    assert.equal(hrefs.includes("/farm"), role === "FARMER");
    assert.ok(
      !hrefs.some((href) =>
        ["/vet", "/account/library", "/admin/metrics"].includes(href),
      ),
    );
    assert.ok(items.every((item) => item.label && item.href));
  }
  assert.ok(
    nav
      .getWorkspaceNav(user("FARMER", true), "bn")
      .some((item) => item.href === "/account/farm-onboarding"),
  );
  assert.notEqual(
    nav.getWorkspaceNav(user("LEARNER"), "bn")[0].label,
    nav.getWorkspaceNav(user("LEARNER"), "en")[0].label,
  );
});
test("malformed or inactive identities never receive privileged navigation", () => {
  assert.equal(typeof nav.getWorkspaceNav, "function");
  for (const identity of [
    null,
    { ...user("ADMIN"), role: "UNKNOWN" },
    { ...user("ADMIN"), status: "SUSPENDED" },
  ]) {
    assert.deepEqual(nav.getWorkspaceNav(identity, "en"), []);
    assert.throws(() => nav.getPostLoginDestination(identity));
  }
});
