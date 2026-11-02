// Real private BFF -> Nest guards/controller/service -> PostgreSQL + Redis.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import ts from "typescript";
const require = createRequire(import.meta.url),
  api = createRequire(new URL("../../api/package.json", import.meta.url));
const value = process.env.ENROLLMENTS_TEST_DATABASE_URL,
  redis = process.env.ENROLLMENTS_TEST_REDIS_URL;
if (!value || !redis)
  throw new Error("Explicit disposable PostgreSQL and Redis URLs required.");
const dbUrl = new URL(value),
  redisUrl = new URL(redis);
if (
  dbUrl.hostname !== "127.0.0.1" ||
  dbUrl.pathname !== "/course_enrollments_test" ||
  redisUrl.hostname !== "127.0.0.1" ||
  redisUrl.port !== "56479"
)
  throw new Error("Only task-owned loopback services allowed.");
api("reflect-metadata");
const { PrismaClient } = api("@prisma/client"),
  { Test } = api("@nestjs/testing"),
  { NextRequest } = require("next/server");
const { AdminCourseEnrollmentsController, AdminUserCoursesController } = api(
  "./dist/modules/courses/admin-course-enrollments.controller",
);
const { AdminCourseEnrollmentsService } = api(
  "./dist/modules/courses/admin-course-enrollments.service",
);
const { AdminCourseEnrollmentsRepository } = api(
  "./dist/modules/courses/admin-course-enrollments.repository",
);
const { CourseEnrollmentWriter } = api(
  "./dist/modules/courses/course-enrollment-writer.service",
);
const { UserRepository } = api(
  "./dist/modules/users/repositories/user.repository",
);
const { BcryptPasswordHasher } = api(
  "./dist/modules/auth/services/bcrypt-password-hasher.service",
);
const { CurrentIdentityService } = api(
  "./dist/modules/auth/services/current-identity.service",
);
const { TOKEN_SERVICE } = api(
  "./dist/modules/auth/services/token.service.interface",
);
const { TransactionManager } = api(
  "./dist/modules/prisma/transaction/transaction.manager",
);
const { AuditLogRepository } = api(
  "./dist/modules/audit/repositories/audit-log.repository",
);
const { WorkflowRateLimiter } = api(
  "./dist/common/security/workflow-rate-limiter",
);
const { GlobalExceptionFilter } = api(
  "./dist/common/filters/global-exception.filter",
);
const { ResponseInterceptor } = api(
  "./dist/common/interceptors/response.interceptor",
);
function compile(file, overrides = {}) {
  const { outputText } = ts.transpileModule(
    readFileSync(new URL(file, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2020,
      },
    },
  );
  const module = { exports: {} };
  new Function("require", "module", "exports", outputText)(
    (name) => overrides[name] ?? require(name),
    module,
    module.exports,
  );
  return module.exports;
}
const { handleWorkspace } = compile("../src/lib/workspace/server.ts", {
  "./contracts": compile("../src/lib/workspace/contracts.ts"),
  "./farm-contracts": compile("../src/lib/workspace/farm-contracts.ts"),
  "../api-diagnostics": compile("../src/lib/api-diagnostics.ts"),
});
const p = new PrismaClient({ datasources: { db: { url: value } } }),
  env = {
    adminCourseEnrollmentsEnabled: true,
    redisEnabled: true,
    redisUrl: redis,
    authLegacyClaimsUntil: 0,
  },
  limiter = new WorkflowRateLimiter(env),
  hasher = new BcryptPasswordHasher();
let app;
try {
  const actor = await p.user.create({
    data: {
      name: "Synthetic BFF admin",
      email: `${randomUUID()}@integration.example.test`,
      passwordHash: await hasher.hash("synthetic-actor-pass"),
      role: "ADMIN",
    },
  });
  const course = await p.product.create({
    data: {
      title: "Synthetic integration course",
      slug: `bff-${randomUUID()}`,
      description: "Synthetic course",
      type: "VIDEO_COURSE",
      contentProvider: "YOUTUBE",
      priceCents: 0,
      currency: "USD",
      contentS3Key: "",
      isPublished: true,
    },
  });
  const users = new UserRepository(p, {}),
    claims = { sub: actor.id, role: "ADMIN", authorizationVersion: 0 },
    identity = new CurrentIdentityService(users, env);
  const service = new AdminCourseEnrollmentsService(
    new AdminCourseEnrollmentsRepository(p),
    new CourseEnrollmentWriter(),
    users,
    hasher,
    new TransactionManager(p),
    new AuditLogRepository(p),
    limiter,
    env,
  );
  const mod = await Test.createTestingModule({
    controllers: [AdminCourseEnrollmentsController, AdminUserCoursesController],
    providers: [
      { provide: AdminCourseEnrollmentsService, useValue: service },
      {
        provide: TOKEN_SERVICE,
        useValue: {
          verifyAccessToken: async (token) => {
            assert.equal(token, "synthetic-admin-token");
            return claims;
          },
        },
      },
      { provide: CurrentIdentityService, useValue: identity },
    ],
  }).compile();
  app = mod.createNestApplication();
  app.setGlobalPrefix("api/v1");
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.use("/api/v1/auth/me", async (_req, res) => {
    const { toAuthUserSummary } = api("./dist/modules/users/auth-user-summary");
    res.json({
      success: true,
      data: toAuthUserSummary(await users.findById(actor.id)),
    });
  });
  await app.listen(0, "127.0.0.1");
  process.env.API_BASE_URL = (await app.getUrl()) + "/api/v1";
  async function call(path, method = "GET", body) {
    const req = new NextRequest("http://localhost/api/workspace/" + path, {
      method,
      headers: {
        Cookie: "vetralink_access=synthetic-admin-token",
        Origin: "http://localhost",
        "Content-Type": "application/json",
        "X-Workspace-Actor": `${actor.id}:ADMIN:0`,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const response = await handleWorkspace(req, path.split("/"));
    assert.equal(response.headers.get("set-cookie"), null);
    return { response, body: await response.json() };
  }
  const input = {
    name: "Synthetic integrated learner",
    email: `${randomUUID()}@integration.example.test`,
    newUserPassword: "synthetic-learner-pass",
    actorPassword: "synthetic-actor-pass",
    reason: "Requested synthetic course access",
  };
  const created = await call(
    `admin/courses/${course.id}/enrollments/create-user`,
    "POST",
    input,
  );
  assert.equal(created.response.status, 200);
  assert.equal(created.body.data.accountCreated, true);
  assert.doesNotMatch(
    JSON.stringify(created.body),
    /password|synthetic-learner-pass|refreshToken/,
  );
  const enrollment = created.body.data.enrollment,
    userId = enrollment.userId;
  assert.equal(await p.refreshToken.count({ where: { userId } }), 0);
  const duplicate = await call(
    `admin/courses/${course.id}/enrollments/create-user`,
    "POST",
    input,
  );
  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.body.code, "ACCOUNT_EXISTS");
  const removed = await call(
    `admin/courses/${course.id}/enrollments/${userId}/actions`,
    "POST",
    {
      action: "REMOVE",
      expectedVersion: 0,
      reason: "Remove synthetic course access",
      actorPassword: input.actorPassword,
    },
  );
  assert.equal(removed.response.status, 200);
  assert.equal(removed.body.data.enrollment.status, "REVOKED");
  const restored = await call(
    `admin/courses/${course.id}/enrollments/${userId}/actions`,
    "POST",
    {
      action: "RESTORE",
      expectedVersion: 1,
      reason: "Restore synthetic course access",
      actorPassword: input.actorPassword,
    },
  );
  assert.equal(restored.response.status, 200);
  assert.equal(restored.body.data.enrollment.id, enrollment.id);
  const directory = await call(`admin/directory/users/${userId}/courses`);
  assert.equal(directory.response.status, 200);
  assert.equal(directory.body.data.items[0].status, "ACTIVE");
  console.log(
    "PASS: real BFF/Nest/PostgreSQL/Redis create, duplicate, revoke, restore, user directory and admin-cookie privacy.",
  );
} finally {
  await app?.close();
  limiter.onModuleDestroy();
  await p.$disconnect();
}
