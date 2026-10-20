// Only a task-owned, disposable Docker PostgreSQL instance is accepted.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import {
  mkdtemp,
  mkdir,
  cp,
  readdir,
  writeFile,
  readFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");
const apiDir = fileURLToPath(new URL("../", import.meta.url));
const container = process.env.ADM9_POSTGRES_CONTAINER;
assert.match(container ?? "", /^vet-adm9-[a-f0-9]{32}-pg$/);
const port = process.env.ADM9_POSTGRES_PORT ?? "55449";
assert.ok(
  ["55449", "55448"].includes(port),
  "Reserved ADM9 rehearsal port required",
);
const database = `postgresql://postgres:adm9_only@127.0.0.1:${port}/adm9_test`;
function command(executable, args, options = {}) {
  const r = spawnSync(executable, args, {
    encoding: "utf8",
    windowsHide: true,
    ...options,
  });
  assert.equal(
    r.status,
    0,
    `${path.basename(executable)} failed: ${(r.stderr || r.error || "").toString().slice(-2000)}`,
  );
  return r.stdout;
}
assert.equal(
  command("docker", [
    "inspect",
    "--format",
    '{{index .Config.Labels "vetralink.task"}}',
    container,
  ]).trim(),
  "adm9",
);
const ports = JSON.parse(
  command("docker", [
    "inspect",
    "--format",
    "{{json .NetworkSettings.Ports}}",
    container,
  ]),
);
assert.ok(
  ports["5432/tcp"].some(
    (p) => p.HostIp === "127.0.0.1" && p.HostPort === port,
  ),
);
const root = await mkdtemp(path.join(tmpdir(), "vet-adm9-migrations-"));
const baseline = path.join(root, "baseline");
const current = path.join(root, "current");
await mkdir(current);
await cp(
  path.join(apiDir, "prisma/schema.prisma"),
  path.join(current, "schema.prisma"),
);
await cp(
  path.join(apiDir, "prisma/migrations"),
  path.join(current, "migrations"),
  { recursive: true },
);
await mkdir(path.join(baseline, "migrations"), { recursive: true });
await cp(
  path.join(apiDir, "prisma/schema.prisma"),
  path.join(baseline, "schema.prisma"),
);
await writeFile(
  path.join(baseline, "migrations/migration_lock.toml"),
  'provider = "postgresql"\n',
);
const migrations = (
  await readdir(path.join(apiDir, "prisma/migrations"), { withFileTypes: true })
)
  .filter((x) => x.isDirectory())
  .map((x) => x.name)
  .sort();
assert.deepEqual(migrations.slice(-2), [
  "20261019100000_admin_communications",
  "20261019160000_admin_platform",
]);
for (const name of migrations.slice(0, -2))
  await cp(
    path.join(apiDir, "prisma/migrations", name),
    path.join(baseline, "migrations", name),
    { recursive: true },
  );
const env = {
  PATH: process.env.PATH,
  SystemRoot: process.env.SystemRoot,
  TEMP: process.env.TEMP,
  DATABASE_URL: database,
  PRISMA_HIDE_UPDATE_MESSAGE: "1",
};
const prisma = require.resolve("prisma/build/index.js");
const deploy = (schema) =>
  command(process.execPath, [prisma, "migrate", "deploy", "--schema", schema], {
    env,
    cwd: root,
  });
deploy(path.join(baseline, "schema.prisma"));
let db = new PrismaClient({ datasources: { db: { url: database } } });
const seed = {
  user: "d9000000-0000-4000-8000-000000000001",
  order: "d9000000-0000-4000-8000-000000000002",
  outbox: "d9000000-0000-4000-8000-000000000003",
  delivery: "d9000000-0000-4000-8000-000000000004",
};
try {
  await db.user.create({
    data: {
      id: seed.user,
      name: "Synthetic pre-ADM9 baseline",
      email: "adm9-baseline@example.test",
      passwordHash: "synthetic-disabled-login",
      role: "LEARNER",
    },
  });
  await db.order.create({
    data: {
      id: seed.order,
      userId: seed.user,
      totalCents: 777,
      currency: "BDT",
      paymentGateway: "SYNTHETIC",
    },
  });
  await db.product.create({
    data: {
      title: "Existing pre-migration product",
      slug: "adm3-populated-rehearsal",
      type: "EBOOK",
      description: "Synthetic retained product",
      priceCents: 1000,
      currency: "USD",
      minSubscriptionTier: "STARTER",
      contentS3Key: "legacy/guide.pdf",
    },
  });
  await db.roleNotificationOutbox.create({
    data: {
      id: seed.outbox,
      eventKey: "adm9-migration-baseline",
      eventType: "PRIVILEGED_ROLE_CHANGED",
      targetUserId: seed.user,
      availableAt: new Date("2100-01-01"),
    },
  });
  // The current client expects retryGeneration; raw SQL deliberately exercises the old schema.
  await db.$executeRaw`INSERT INTO role_notification_deliveries (id, outbox_id, recipient_user_id, status, attempts) VALUES (${seed.delivery}::uuid, ${seed.outbox}::uuid, ${seed.user}::uuid, 'FAILED', 5)`;
} finally {
  await db.$disconnect();
}
const dump = command("docker", [
  "exec",
  container,
  "pg_dump",
  "-U",
  "postgres",
  "--no-owner",
  "--no-acl",
  "adm9_test",
]);
await writeFile(path.join(root, "pre-adm7.sql"), dump);
deploy(path.join(current, "schema.prisma"));
command("docker", [
  "exec",
  container,
  "createdb",
  "-U",
  "postgres",
  "adm9_restore",
]);
command(
  "docker",
  [
    "exec",
    "-i",
    container,
    "psql",
    "-U",
    "postgres",
    "-d",
    "adm9_restore",
    "-v",
    "ON_ERROR_STOP=1",
  ],
  { input: await readFile(path.join(root, "pre-adm7.sql"), "utf8") },
);
env.DATABASE_URL = database.replace("/adm9_test", "/adm9_restore");
deploy(path.join(current, "schema.prisma"));
for (const name of ["adm9_test", "adm9_restore"]) {
  const url = database.replace("/adm9_test", "/" + name);
  db = new PrismaClient({ datasources: { db: { url } } });
  try {
    assert.equal(
      (await db.user.findUniqueOrThrow({ where: { id: seed.user } })).name,
      "Synthetic pre-ADM9 baseline",
    );
    const order = await db.order.findUniqueOrThrow({
      where: { id: seed.order },
    });
    assert.equal(order.totalCents, 777);
    assert.equal(order.currency, "BDT");
    const product = await db.product.findUniqueOrThrow({
      where: { slug: "adm3-populated-rehearsal" },
    });
    assert.equal(product.version, 0);
    assert.equal(product.contentProvider, "INTERNAL");
    assert.equal(product.contentS3Key, "legacy/guide.pdf");
    const delivery = await db.roleNotificationDelivery.findUniqueOrThrow({
      where: { id: seed.delivery },
    });
    assert.equal(delivery.status, "FAILED");
    assert.equal(delivery.attempts, 5);
    assert.equal(delivery.retryGeneration, 0);
    assert.equal(
      Number(
        (
          await db.$queryRaw`SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL`
        )[0].count,
      ),
      migrations.length,
    );
    const diff = command(
      process.execPath,
      [
        prisma,
        "migrate",
        "diff",
        "--from-url",
        url,
        "--to-schema-datamodel",
        path.join(current, "schema.prisma"),
        "--exit-code",
        "--script",
      ],
      { cwd: root, env },
    );
    assert.match(diff, /empty migration/);
  } finally {
    await db.$disconnect();
  }
}
// Each existing opt-in suite retains its own database-name safety guard.
command("docker", [
  "exec",
  container,
  "psql",
  "-U",
  "postgres",
  "-c",
  "CREATE ROLE role_test LOGIN PASSWORD 'role_test_only' SUPERUSER",
]);
for (const name of [
  "adm3_test",
  "adm4_test",
  "adm5_test",
  "adm6_test",
  "adm7_test",
  "adm8_test",
  "role_test",
]) {
  command("docker", [
    "exec",
    container,
    "createdb",
    "-U",
    "postgres",
    "--template",
    "adm9_test",
    name,
  ]);
}
console.log(
  JSON.stringify({
    result: "PASS",
    migrations: migrations.length,
    baselineMigrations: migrations.length - 2,
    restored: true,
    seedPreserved: true,
    schemaDiffs: "empty",
    evidence: root,
  }),
);
