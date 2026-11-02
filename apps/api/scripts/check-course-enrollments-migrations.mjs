import { mkdtempSync, cpSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import assert from "node:assert/strict";
import { PrismaClient } from "@prisma/client";
const value = process.env.ENROLLMENTS_TEST_DATABASE_URL;
if (!value)
  throw new Error(
    "Explicit disposable ENROLLMENTS_TEST_DATABASE_URL required.",
  );
const parsed = new URL(value);
if (
  !["127.0.0.1", "localhost"].includes(parsed.hostname) ||
  parsed.pathname !== "/course_enrollments_test"
)
  throw new Error(
    "Only task-owned loopback course_enrollments_test is permitted.",
  );
const temp = mkdtempSync(path.join(tmpdir(), "enrollment-migration-")),
  p = new PrismaClient({ datasources: { db: { url: value } } });
const run = (schema) => {
  const r = spawnSync(
    "pnpm",
    ["exec", "prisma", "migrate", "deploy", "--schema", schema],
    { env: { ...process.env, DATABASE_URL: value }, encoding: "utf8" },
  );
  if (r.status !== 0)
    throw new Error("Disposable migration failed: " + r.stderr);
};
try {
  const tables = await p.$queryRawUnsafe(
    "SELECT tablename FROM pg_tables WHERE schemaname='public'",
  );
  assert.equal(tables.length, 0, "Use a fresh empty disposable database.");
  cpSync("prisma/schema.prisma", path.join(temp, "schema.prisma"));
  cpSync("prisma/migrations", path.join(temp, "migrations"), {
    recursive: true,
  });
  const migration = "20261102090000_admin_course_enrollments";
  assert.ok(readdirSync(path.join(temp, "migrations")).includes(migration));
  rmSync(path.join(temp, "migrations", migration), { recursive: true });
  run(path.join(temp, "schema.prisma"));
  const user = await p.user.create({
    data: {
      name: "Legacy learner",
      email: "legacy-migration@example.test",
      passwordHash: "synthetic-legacy",
    },
  });
  const product = await p.product.create({
    data: {
      title: "Legacy course",
      slug: "legacy-migration",
      description: "Synthetic course",
      type: "VIDEO_COURSE",
      contentProvider: "YOUTUBE",
      priceCents: 0,
      currency: "USD",
      contentS3Key: "",
      isPublished: true,
    },
  });
  const id = "33333333-3333-4333-8333-333333333333";
  await p.$executeRaw`INSERT INTO course_enrollments(id,user_id,product_id,created_at) VALUES (${id}::uuid,${user.id}::uuid,${product.id}::uuid,'2026-10-01T00:00:00Z')`;
  run("prisma/schema.prisma");
  const row = await p.courseEnrollment.findUniqueOrThrow({ where: { id } });
  assert.equal(row.status, "ACTIVE");
  assert.equal(row.source, "SELF");
  assert.equal(row.version, 0);
  assert.equal(row.createdAt.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(row.activatedAt.toISOString(), row.createdAt.toISOString());
  assert.equal(row.updatedAt.toISOString(), row.createdAt.toISOString());
  await assert.rejects(
    p.courseEnrollment.update({ where: { id }, data: { status: "REVOKED" } }),
  );
  assert.equal(
    (await p.user.findUniqueOrThrow({ where: { id: user.id } })).passwordHash,
    "synthetic-legacy",
  );
  console.log(
    "PASS: populated PostgreSQL migration preserves identities/dates/credentials and enforces revocation CHECK.",
  );
} finally {
  await p.$disconnect();
  rmSync(temp, { recursive: true, force: true });
}
