import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
const require = createRequire(import.meta.url),
  { NextRequest } = require("next/server");
function compile(file, overrides = {}) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name) => overrides[name] ?? require(name),
    module,
    module.exports,
  );
  return module.exports;
}
const farmContracts = compile("../src/lib/workspace/farm-contracts.ts");
const contracts = compile("../src/lib/workspace/contracts.ts"),
  { handleWorkspace, resolveEndpoint } = compile(
    "../src/lib/workspace/server.ts",
    { "./contracts": contracts, "./farm-contracts": farmContracts, "../api-diagnostics": compile("../src/lib/api-diagnostics.ts") },
  );
const shared = require("@vetralink/shared-types");
const id = "550e8400-e29b-41d4-a716-446655440000",
  targetId = "550e8400-e29b-41d4-a716-446655440001";
const user = {
  id: targetId,
  name: "Synthetic User",
  email: "synthetic@example.test",
  role: "LEARNER",
  status: "ACTIVE",
  isEmailVerified: false,
  maskedPhone: null,
  avatarUrl: null,
  createdAt: "2026-10-07T00:00:00Z",
  roleVersion: 0,
  farmerOnboardingRequired: false,
};
const farm = {
  mode: "create",
  submissionKey: id,
  name: "Test Farm",
  farmType: "DAIRY",
  country: "Bangladesh",
  district: "Dhaka",
  upazila: "Savar",
  address: "Test farm road",
  species: ["COW"],
  animalCount: 4,
  experienceYears: 2,
};
const answers = {
  use: "PERSONAL",
  district: "Dhaka",
  interests: "Animal care products",
  reason: "I need care products for my household.",
  consent: true,
};
const application = {
  targetRole: "BUYER",
  questionnaireVersion: 1,
  locale: "en",
  submissionKey: id,
  answers,
};
const requestSummary = {
  id,
  applicantUserId: targetId,
  targetRole: "BUYER",
  status: "PENDING",
  questionnaireVersion: 1,
  answers,
  locale: "en",
  requestVersion: 1,
  submittedAt: "2026-10-07T00:00:00Z",
  decidedAt: null,
  publicDecisionReason: null,
};
function request(path, method = "GET", body, options = {}) {
  return new NextRequest(`http://localhost:3100/api/workspace/${path}`, {
    method,
    headers: {
      Cookie: "vetralink_access=synthetic-token",
      ...(method === "GET"
        ? {}
        : {
            Origin: "http://localhost:3100",
            "Content-Type": "application/json",
          }),
      ...options.headers,
    },
    ...(method === "GET" ? {} : { body: JSON.stringify(body ?? {}) }),
  });
}
const ok = (data) => Response.json({ success: true, data });
const fail = (status, title) =>
  Response.json(
    {
      success: false,
      data: null,
      errorDetails: {
        title,
        detail: "never forward this private error",
        status,
      },
    },
    { status },
  );
test("fixed route and method allowlist rejects arbitrary proxy paths", () => {
  for (const path of [
    ["auth", "register"],
    ["admin", "users", "../../users"],
    ["farms", "not-uuid", "members"],
    ["questionnaires", "SUPER_ADMIN"],
    ["questionnaires", "LEARNER"],
  ])
    assert.equal(resolveEndpoint(path, "GET"), null);
  assert.equal(resolveEndpoint(["admin", "users", id], "POST"), null);
  assert.equal(resolveEndpoint(["farms", id, "members"], "DELETE"), null);
});
test("shared Zod validates farm, profession, membership and admin forms", () => {
  assert.ok(shared.farmOnboardingSchema.safeParse(farm).success);
  for (const bad of [
    { ...farm, ownerId: targetId },
    { ...farm, role: "OWNER" },
    { ...farm, gpsLat: 20 },
    { ...farm, species: [] },
    { ...farm, animalCount: -1 },
  ])
    assert.equal(shared.farmOnboardingSchema.safeParse(bad).success, false);
  assert.ok(
    shared.addFarmMemberSchema.safeParse({
      email: " Member@example.test ",
      role: "OWNER",
    }).success,
  );
  for (const bad of [
    { email: "member@example.test", userId: id },
    { role: "OWNER" },
    { userId: id, role: "SUPER_ADMIN" },
  ])
    assert.equal(shared.addFarmMemberSchema.safeParse(bad).success, false);
  assert.ok(shared.submitRoleRequestSchema.safeParse(application).success);
  for (const bad of [
    { ...application, targetRole: "ADMIN" },
    { ...application, targetRole: "LEARNER" },
    { ...application, questionnaireVersion: 2 },
    { ...application, answers: { ...answers, consent: false } },
    { ...application, answers: { ...answers, role: "ADMIN" } },
  ])
    assert.equal(shared.submitRoleRequestSchema.safeParse(bad).success, false);
  assert.equal(
    shared.roleDecisionSchema.safeParse({
      decision: "REJECTED",
      expectedRequestVersion: 1,
      expectedApplicantRoleVersion: 0,
    }).success,
    false,
  );
  assert.equal(
    shared.privilegedRoleSchema.safeParse({
      action: "SET_ROLE",
      expectedRoleVersion: 0,
      reason: "Test change reason.",
      actorPassword: "pass",
    }).success,
    false,
  );
});
test("workspace boundary validation, privacy and upstream methods", async (t) => {
  const original = globalThis.fetch;
  let calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    return ok({ required: true, farms: [] });
  };
  try {
    await t.test(
      "rejects cross origin, missing session and oversized JSON before upstream",
      async () => {
        for (const req of [
          request("farm/onboarding", "POST", farm, {
            headers: { Origin: "https://foreign.example" },
          }),
          request("farm/onboarding", "POST", farm, { headers: { Cookie: "" } }),
          request("farm/onboarding", "POST", {
            ...farm,
            name: "x".repeat(40000),
          }),
        ]) {
          const res = await handleWorkspace(req, ["farm", "onboarding"]);
          assert.ok([401, 403, 413].includes(res.status));
        }
        assert.equal(calls.length, 0);
      },
    );
    await t.test(
      "rejects mismatched questionnaires and caller-selected farm ownership",
      async () => {
        for (const [path, body] of [
          [
            ["me", "role-requests"],
            { ...application, answers: { ...answers, role: "ADMIN" } },
          ],
          [["farm", "onboarding"], { ...farm, ownerId: targetId }],
        ])
          assert.equal(
            (await handleWorkspace(request(path.join("/"), "POST", body), path))
              .status,
            422,
          );
        assert.equal(calls.length, 0);
      },
    );
    await t.test(
      "uses only server cookies as bearer and marks every response no-store",
      async () => {
        const response = await handleWorkspace(request("farm/onboarding"), [
          "farm",
          "onboarding",
        ]);
        assert.equal(response.status, 200);
        assert.equal(
          calls.at(-1).options.headers.Authorization,
          "Bearer synthetic-token",
        );
        assert.match(response.headers.get("cache-control"), /no-store/);
        assert.equal(response.headers.get("set-cookie"), null);
      },
    );
    await t.test(
      "farm member email input uses tenant header and hides extra response fields",
      async () => {
        globalThis.fetch = async (url, options) => {
          calls.push({ url: String(url), options });
          if (new URL(url).pathname.endsWith("/farms/my"))
            return ok({
              required: false,
              farms: [
                {
                  id,
                  name: "Test farm",
                  farmType: "DAIRY",
                  country: "Bangladesh",
                  address: null,
                  role: "OWNER",
                  ownerId: targetId,
                },
              ],
            });
          if (new URL(url).pathname.endsWith("/access-status"))
            return ok({
              subscriptionId: "",
              farmId: id,
              status: "ACTIVE",
              accessMode: "FULL_ACCESS",
              canRead: true,
              canWrite: true,
              daysPastDue: 0,
              gracePeriodDaysRemaining: 0,
              gracePeriodEnd: null,
              suspensionDate: null,
            });
          return ok({
            id,
            userId: targetId,
            farmId: id,
            role: "HERDSMAN",
            createdAt: "2026-10-07T00:00:00Z",
            passwordHash: "must-not-leak",
            tokens: { accessToken: "must-not-leak" },
          });
        };
        const response = await handleWorkspace(
          request(`farms/${id}/members`, "POST", {
            email: " MEMBER@example.test ",
            role: "HERDSMAN",
          }),
          ["farms", id, "members"],
        );
        assert.equal(response.status, 200);
        assert.equal(calls.at(-1).options.headers["x-farm-id"], id);
        assert.deepEqual(JSON.parse(calls.at(-1).options.body), {
          email: "member@example.test",
          role: "HERDSMAN",
        });
        assert.doesNotMatch(
          await response.text(),
          /must-not-leak|passwordHash/,
        );
      },
    );
    await t.test(
      "own applications omit reviewer notes and identity secrets",
      async () => {
        globalThis.fetch = async () =>
          ok({
            requests: [
              {
                ...requestSummary,
                privateReviewNote: "private note",
                qualificationVerificationNote: "private qualification",
              },
            ],
            nextCursor: null,
            providerSecret: "secret",
          });
        const response = await handleWorkspace(request("me/role-requests"), [
          "me",
          "role-requests",
        ]);
        assert.equal(response.status, 200);
        assert.doesNotMatch(
          await response.text(),
          /private note|private qualification|providerSecret/,
        );
      },
    );
    await t.test(
      "forwards approval versions, maps stale decisions and does not expose backend errors",
      async () => {
        globalThis.fetch = async (url, options) => {
          calls.push({ url: String(url), options });
          return fail(409, "ROLE_REQUEST_ALREADY_DECIDED");
        };
        const body = {
          decision: "APPROVED",
          expectedRequestVersion: 1,
          expectedApplicantRoleVersion: 0,
        };
        const response = await handleWorkspace(
          request(`admin/role-requests/${id}/decision`, "POST", body),
          ["admin", "role-requests", id, "decision"],
        );
        assert.equal(response.status, 409);
        assert.deepEqual(await response.json(), {
          code: "ROLE_REQUEST_ALREADY_DECIDED",
        });
        assert.deepEqual(JSON.parse(calls.at(-1).options.body), body);
      },
    );
    await t.test(
      "validates administrative target lookup and response projection",
      async () => {
        globalThis.fetch = async (url) => {
          calls.push({ url: String(url) });
          return ok({
            ...user,
            fallbackRole: "LEARNER",
            passwordHash: "secret",
            authorizationVersion: 5,
          });
        };
        const response = await handleWorkspace(
          request("admin/users/lookup?email=synthetic%40example.test"),
          ["admin", "users", "lookup"],
        );
        assert.equal(response.status, 200);
        assert.ok(calls.at(-1).url.includes("admin/users/role-access?email="));
        assert.doesNotMatch(
          await response.text(),
          /passwordHash|authorizationVersion/,
        );
      },
    );
    await t.test(
      "rejects malformed upstream records and unbounded filters",
      async () => {
        globalThis.fetch = async () =>
          ok({ requests: [{ id: "wrong" }], nextCursor: null });
        assert.equal(
          (
            await handleWorkspace(request("admin/role-requests"), [
              "admin",
              "role-requests",
            ])
          ).status,
          502,
        );
        assert.equal(
          (
            await handleWorkspace(request("admin/role-requests?limit=1000"), [
              "admin",
              "role-requests",
            ])
          ).status,
          422,
        );
        assert.equal(
          (
            await handleWorkspace(
              request("farm/onboarding?url=https://other.example"),
              ["farm", "onboarding"],
            )
          ).status,
          422,
        );
      },
    );
  } finally {
    globalThis.fetch = original;
  }
});
