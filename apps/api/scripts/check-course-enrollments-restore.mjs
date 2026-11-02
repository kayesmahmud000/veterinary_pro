import { createRequire } from "node:module";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
const require = createRequire(import.meta.url),
  { PrismaClient } = require("@prisma/client");
const url = process.env.ENROLLMENTS_TEST_DATABASE_URL,
  bin = process.env.ENROLLMENTS_TEST_PG_BIN;
if (!url || !bin)
  throw new Error(
    "Explicit disposable DB and PG client binary directory required.",
  );
const source = new URL(url);
if (
  source.hostname !== "127.0.0.1" ||
  source.pathname !== "/course_enrollments_test"
)
  throw new Error("Task-owned loopback test database required.");
const target = new URL(url);
const restoreName = "course_enrollments_restore_" + randomUUID().replaceAll("-", "");
target.pathname = "/" + restoreName;
const adminUrl = new URL(url);
adminUrl.pathname = "/postgres";
const p = new PrismaClient({ datasources: { db: { url } } }),
  admin = new PrismaClient({ datasources: { db: { url: String(adminUrl) } } });
let restored;
const dir = mkdtempSync(path.join(tmpdir(), "enrollment-restore-")),
  dump = path.join(dir, "snapshot.dump");
const {
  AdminCourseEnrollmentsService,
} = require("../dist/modules/courses/admin-course-enrollments.service");
const {
  AdminCourseEnrollmentsRepository,
} = require("../dist/modules/courses/admin-course-enrollments.repository");
const {
  CourseEnrollmentWriter,
} = require("../dist/modules/courses/course-enrollment-writer.service");
const {
  UserRepository,
} = require("../dist/modules/users/repositories/user.repository");
const {
  BcryptPasswordHasher,
} = require("../dist/modules/auth/services/bcrypt-password-hasher.service");
const {
  TransactionManager,
} = require("../dist/modules/prisma/transaction/transaction.manager");
const {
  AuditLogRepository,
} = require("../dist/modules/audit/repositories/audit-log.repository");
function service(db) {
  return new AdminCourseEnrollmentsService(
    new AdminCourseEnrollmentsRepository(db),
    new CourseEnrollmentWriter(),
    new UserRepository(db, {}),
    new BcryptPasswordHasher(),
    new TransactionManager(db),
    new AuditLogRepository(db),
    { hit: async () => undefined },
    { adminCourseEnrollmentsEnabled: true, redisEnabled: true },
  );
}
function run(tool, args) {
  const result = spawnSync(path.join(bin, tool), args, {
    env: process.env,
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(`${tool} failed: ${result.stderr}`);
  return result.stdout;
}
try {
  const version = await p.$queryRawUnsafe("SELECT current_setting('server_version_num') AS version");
  const major = Math.floor(Number(version[0].version) / 10000);
  assert.equal(Number(/(\d+)\./.exec(run("pg_dump", ["--version"]))[1]), major, "Use matching-major PostgreSQL clients.");
  await admin.$executeRawUnsafe('CREATE DATABASE "' + restoreName + '"');
  const password = "synthetic-restore-admin-pass",
    hasher = new BcryptPasswordHasher();
  const actor = await p.user.create({
      data: {
        name: "Synthetic restore admin",
        email: `${randomUUID()}@restore.example.test`,
        passwordHash: await hasher.hash(password),
        role: "ADMIN",
      },
    }),
    claims = { sub: actor.id, role: "ADMIN", authorizationVersion: 0 };
  const course = await p.product.create({
    data: {
      title: "Restore verification",
      slug: `restore-${randomUUID()}`,
      description: "Synthetic restore course",
      type: "VIDEO_COURSE",
      contentProvider: "YOUTUBE",
      priceCents: 0,
      currency: "USD",
      contentS3Key: "",
      isPublished: true,
    },
  });
  const created = await service(p).createUserAndEnroll(claims, course.id, {
    name: "Synthetic restore learner",
    email: `${randomUUID()}@restore.example.test`,
    newUserPassword: "synthetic-restore-pass",
    actorPassword: password,
    reason: "Synthetic backup preservation test",
  });
  run("pg_dump", ["--format=custom", "--file", dump, "--dbname", url]);
  const removed = await service(p).act(
    claims,
    course.id,
    created.enrollment.userId,
    {
      action: "REMOVE",
      expectedVersion: 0,
      actorPassword: password,
      reason: "Synthetic post-backup revocation",
    },
  );
  const evidence = await p.auditLog.findFirstOrThrow({
    where: {
      entityId: created.enrollment.id,
      action: "COURSE_ENROLLMENT_REVOKED",
    },
  });
  assert.equal(removed.enrollment.status, "REVOKED");
  assert.equal(evidence.newValues.enrollmentStatus, "REVOKED");
  run("pg_restore", [
    "--exit-on-error",
    "--no-owner",
    "--dbname",
    String(target),
    dump,
  ]);
  restored = new PrismaClient({ datasources: { db: { url: String(target) } } });
  // The restore copy has no HTTP server. Protected access stays closed during reconciliation.
  assert.equal(
    (
      await restored.courseEnrollment.findUniqueOrThrow({
        where: { id: created.enrollment.id },
      })
    ).status,
    "ACTIVE",
  );
  const reconciled = await service(restored).act(
    claims,
    course.id,
    created.enrollment.userId,
    {
      action: "REMOVE",
      expectedVersion: 0,
      actorPassword: password,
      reason: "Reconcile independently retained revocation evidence",
    },
  );
  assert.equal(reconciled.enrollment.status, "REVOKED");
  assert.equal(reconciled.enrollment.id, created.enrollment.id);
  console.log(
    "PASS: PostgreSQL backup/restore preserves history; post-backup revocation requires and passes gated audited reconciliation.",
  );
} finally {
  await restored?.$disconnect();
  await p.$disconnect();
  await admin.$disconnect();
  rmSync(dir, { recursive: true, force: true });
}
