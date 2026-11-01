import { PrismaClient } from "@prisma/client";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { EnvSchema, EnvConfig } from "../../../config/env.schema";
import { EnvService } from "../../../config/env.service";
import { PiiCryptoService } from "../../../common/crypto/pii-crypto.service";
import { PrismaService } from "../../prisma/prisma.service";
import { TransactionManager } from "../../prisma/transaction/transaction.manager";
import { UserRepository } from "../../users/repositories/user.repository";
import { RefreshTokenRepository } from "../repositories/refresh-token.repository";
import { AuditLogRepository } from "../../audit/repositories/audit-log.repository";
import { BcryptPasswordHasher } from "../services/bcrypt-password-hasher.service";
import { TokenService } from "../services/token.service";
import { AuthService } from "../services/auth.service";
import { AccountRecoveryRepository } from "./account-recovery.repository";
import { AccountRecoveryLifecycleService } from "./account-recovery.lifecycle";
import { AccountRecoverySecrets } from "./account-recovery.secrets";

const enabled = process.env["RECOVERY_TEST_RESTORE"] === "true";
const url = process.env["RECOVERY_TEST_DATABASE_URL"];
const binaries = process.env["RECOVERY_TEST_PG_BIN"];
const baseline = process.env["RECOVERY_TEST_BASELINE_DUMP"];
if (enabled) {
  if (!url || !binaries || !baseline) throw new Error("Explicit disposable recovery URL, PostgreSQL tools and baseline dump required");
  const target = new URL(url);
  if (!["127.0.0.1", "localhost"].includes(target.hostname) || target.pathname !== "/recovery_test" || target.searchParams.has("schema"))
    throw new Error("Restore requires an explicitly disposable loopback /recovery_test database");
}

(enabled ? describe : describe.skip)("Account recovery populated migration / offline restore", () => {
  it("preserves populated baseline rows, restores a pre-consumption backup and fences revived grants/sessions", async () => {
    const target = new URL(url!);
    const connection = ["-h", target.hostname, "-p", target.port || "5432", "-U", decodeURIComponent(target.username), "-d", "recovery_test"];
    const commandEnv = { ...process.env, DATABASE_URL: url!, PGPASSWORD: decodeURIComponent(target.password) };
    const tools = (name: string, args: string[]) => execFileSync(join(binaries!, name), args, { env: commandEnv, stdio: "pipe", timeout: 60000 });
    const sql = (statement: string) => tools("psql", [...connection, "-v", "ON_ERROR_STOP=1", "-c", statement]);
    const cli = join(dirname(require.resolve("prisma/package.json")), "build/index.js");
    const schema = resolve(__dirname, "../../../../prisma/schema.prisma");
    const prisma = (args: string[]) => execFileSync(process.execPath, [cli, ...args], { env: commandEnv, stdio: "pipe", timeout: 60000 });
    let db = new PrismaClient({ datasources: { db: { url } } });
    const scratch = mkdtempSync(join(tmpdir(), "vetralink-recovery-restore-"));
    try {
      // Restore the provided populated pre-feature snapshot first, making this
      // rehearsal repeatable even after a prior fence changed runtime versions.
      await db.$disconnect();
      sql("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
      tools("pg_restore", [...connection, "--no-owner", "--no-acl", baseline!]);
      db = new PrismaClient({ datasources: { db: { url } } });
      const fixture = await db.user.findUniqueOrThrow({ where: { email: "restore-fixture@recovery.example.test" } });
      const snapshot = {
        user: fixture,
        orders: await db.order.findMany({ where: { userId: fixture.id }, orderBy: { id: "asc" } }),
        refresh: await db.refreshToken.findMany({ where: { userId: fixture.id }, orderBy: { id: "asc" } }),
        audit: await db.auditLog.findMany({ where: { userId: fixture.id }, orderBy: { id: "asc" } }),
      };
      expect(snapshot.orders.length).toBeGreaterThan(0);
      expect(snapshot.refresh.length).toBeGreaterThan(0);
      expect(snapshot.audit.length).toBeGreaterThan(0);
      prisma(["migrate", "deploy", "--schema", schema]);
      prisma(["migrate", "diff", "--from-schema-datasource", schema, "--to-schema-datamodel", schema, "--exit-code"]);
      expect(await db.user.findUniqueOrThrow({ where: { id: fixture.id } })).toEqual(snapshot.user);
      expect(await db.order.findMany({ where: { userId: fixture.id }, orderBy: { id: "asc" } })).toEqual(snapshot.orders);
      expect(await db.refreshToken.findMany({ where: { userId: fixture.id }, orderBy: { id: "asc" } })).toEqual(snapshot.refresh);
      expect(await db.auditLog.findMany({ where: { userId: fixture.id }, orderBy: { id: "asc" } })).toEqual(snapshot.audit);

      const envConfig = EnvSchema.parse({ DATABASE_URL: url, NODE_ENV: "test", WEB_BASE_URL: "http://127.0.0.1:3000", ACCOUNT_RECOVERY_TEST_TRANSPORT: true });
      const env = new EnvService(new ConfigService<EnvConfig, true>(envConfig));
      const pii = new PiiCryptoService(env), secrets = new AccountRecoverySecrets(pii, env);
      const adapter = db as unknown as PrismaService;
      const users = new UserRepository(adapter, pii), refresh = new RefreshTokenRepository(adapter);
      const audit = new AuditLogRepository(adapter), tx = new TransactionManager(adapter), hasher = new BcryptPasswordHasher();
      const tokens = new TokenService(new JwtService(), env);
      const auth = new AuthService(users, refresh, hasher, tokens, tx, pii, audit);
      const repo = new AccountRecoveryRepository(adapter, users, refresh, audit, secrets);
      const lifecycle = new AccountRecoveryLifecycleService(repo, tx, hasher, secrets);
      const login = await auth.login({ email: fixture.email, password: "Synthetic original password!" });
      await lifecycle.acceptRequest({ email: fixture.email, locale: "en" });
      const job = await db.accountRecoveryJob.findFirstOrThrow({ where: { kind: "RESET_REQUEST" } });
      const fence = randomUUID();
      await db.$executeRaw`UPDATE account_recovery_jobs SET lease_id=${fence}::uuid,lease_until=clock_timestamp()+interval '60 seconds' WHERE id=${job.id}::uuid`;
      const issued = await lifecycle.issueForRequest(job.id, fence);
      if (!issued) throw new Error("Expected synthetic issued credential");
      const payload = secrets.openPayload(issued);
      if (payload.kind !== "RESET_LINK") throw new Error("Expected reset payload");
      const backup = join(scratch, "pre-consumption.dump");
      tools("pg_dump", [...connection, "-Fc", "-f", backup]);
      await lifecycle.complete({ token: payload.token, newPassword: "Synthetic replacement password!" });
      const afterReset = await auth.login({ email: fixture.email, password: "Synthetic replacement password!" });
      const afterClaims = await tokens.verifyAccessToken(afterReset.tokens.accessToken);
      const { authorizationVersion: _version, ...legacyClaims } = await tokens.verifyAccessToken(login.tokens.accessToken);
      const legacyToken = await new JwtService().signAsync(legacyClaims, { secret: env.jwtAccessSecret });
      expect(await db.passwordResetCredential.findUniqueOrThrow({ where: { id: issued.credentialId! } })).toMatchObject({ consumedAt: expect.any(Date) });
      await db.$disconnect();
      sql("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
      tools("pg_restore", [...connection, "--no-owner", "--no-acl", backup]);
      await db.$connect();
      // A pre-consumption restore revives a link unless the offline fence runs.
      expect(await db.passwordResetCredential.findUniqueOrThrow({ where: { id: issued.credentialId! } })).toMatchObject({ consumedAt: null, invalidatedAt: null });
      const fenceFile = resolve(__dirname, "../../../../../../docs/features/account-recovery/offline-restore-fence.sql");
      // Explicit confirmation is required; the failing transaction leaves rows intact.
      expect(() => tools("psql", [...connection, "-v", "ON_ERROR_STOP=1", "-f", fenceFile])).toThrow();
      tools("psql", [...connection, "-v", "ON_ERROR_STOP=1", "-c", "SET vetralink.recovery_restore_confirmed='yes'", "-f", fenceFile]);
      expect(await db.passwordResetCredential.findUniqueOrThrow({ where: { id: issued.credentialId! } })).toMatchObject({ invalidatedAt: expect.any(Date) });
      expect(await db.accountRecoveryJob.count({ where: { payload: { not: null } } })).toBe(0);
      expect(await db.refreshToken.count({ where: { revokedAt: null } })).toBe(0);
      const restored = await db.user.findUniqueOrThrow({ where: { id: fixture.id } });
      expect(restored.authorizationVersion).toBe(afterClaims.authorizationVersion);
      // The version collision above is why access-signing key rotation is mandatory.
      const rotated = new TokenService(new JwtService(), new EnvService(new ConfigService<EnvConfig, true>({
        ...envConfig, JWT_ACCESS_SECRET: "synthetic_rotated_restore_signing_secret_32_chars",
      })));
      for (const access of [login.tokens.accessToken, afterReset.tokens.accessToken, legacyToken])
        await expect(rotated.verifyAccessToken(access)).rejects.toThrow();
      await expect(lifecycle.complete({ token: payload.token, newPassword: "Synthetic replacement password!" })).rejects.toMatchObject({ errorCode: "RESET_LINK_INVALID" });
      await expect(auth.refreshToken(login.tokens.refreshToken)).rejects.toThrow();
      expect(await db.order.findMany({ where: { userId: fixture.id }, orderBy: { id: "asc" } })).toEqual(snapshot.orders);
      prisma(["migrate", "deploy", "--schema", schema]);
      prisma(["migrate", "diff", "--from-schema-datasource", schema, "--to-schema-datamodel", schema, "--exit-code"]);
      expect(restored.passwordHash).toBe(snapshot.user.passwordHash); // Lost post-snapshot password changes need incident reconciliation.
    } finally {
      await db.$disconnect();
      rmSync(scratch, { recursive: true, force: true });
    }
  }, 120000);
});
