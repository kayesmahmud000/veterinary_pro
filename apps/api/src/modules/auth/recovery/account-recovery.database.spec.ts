import { PrismaClient, UserRole, UserStatus } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Logger } from "@nestjs/common";
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
import { CurrentIdentityService } from "../services/current-identity.service";
import { AccountRecoveryRepository } from "./account-recovery.repository";
import { AccountRecoveryLifecycleService } from "./account-recovery.lifecycle";
import { AccountRecoverySecrets } from "./account-recovery.secrets";
import { ConsultationChatGateway } from "../../consultations/gateways/consultation-chat.gateway";
import { ConsultationEntity } from "../../consultations/entities/consultation.entity";
import { IConsultationChatService } from "../../consultations/services/consultation-chat.service.interface";
import { IConsultationRepository } from "../../consultations/repositories/consultation.repository.interface";
import { IFarmMemberRepository } from "../../farms/repositories/farm-member.repository.interface";
import { Server, Socket } from "socket.io";
import { JwtPayload } from "@vetralink/shared-types";

function signal() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => { release = resolve; });
  return { promise, release };
}

const oldPassword = "Synthetic original password!";
const newPassword = "Synthetic replacement password!";

const url = process.env["RECOVERY_TEST_DATABASE_URL"];
if (url) {
  const target = new URL(url);
  if (!["127.0.0.1", "localhost"].includes(target.hostname) ||
    target.pathname !== "/recovery_test" || target.searchParams.has("schema"))
    throw new Error("Explicit disposable loopback /recovery_test required");
}

(url ? describe : describe.skip)("Account recovery real PostgreSQL persistence", () => {
  let db: PrismaClient;
  let repo: AccountRecoveryRepository, lifecycle: AccountRecoveryLifecycleService;
  let secrets: AccountRecoverySecrets, transactions: TransactionManager;
  let users: UserRepository, sessions: RefreshTokenRepository, audit: AuditLogRepository;
  let auth: AuthService, identities: CurrentIdentityService, tokens: TokenService, env: EnvService;
  let oldHash: string;
  const hasher = new BcryptPasswordHasher();
  const userIds: string[] = [];
  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url } } });
    await db.$connect();
    const adapter = db as unknown as PrismaService;
    const config = EnvSchema.parse({ DATABASE_URL: url, NODE_ENV: "test",
      WEB_BASE_URL: "http://127.0.0.1:3000", ACCOUNT_RECOVERY_TEST_TRANSPORT: true,
      AUTH_LEGACY_CLAIMS_UNTIL: new Date(Date.now() + 600000).toISOString() });
    env = new EnvService(new ConfigService<EnvConfig, true>(config));
    const pii = new PiiCryptoService(env);
    secrets = new AccountRecoverySecrets(pii, env);
    users = new UserRepository(adapter, pii);
    sessions = new RefreshTokenRepository(adapter);
    audit = new AuditLogRepository(adapter);
    transactions = new TransactionManager(adapter);
    repo = new AccountRecoveryRepository(adapter, users, sessions, audit, secrets);
    lifecycle = new AccountRecoveryLifecycleService(repo, transactions, hasher, secrets);
    tokens = new TokenService(new JwtService(), env);
    identities = new CurrentIdentityService(users, env);
    auth = new AuthService(users, sessions, hasher, tokens, transactions, pii, audit);
    oldHash = await hasher.hash(oldPassword);
  });
  afterAll(async () => { await db?.$disconnect(); });
  afterEach(async () => {
    jest.restoreAllMocks();
    await db.accountRecoveryJob.deleteMany();
    await db.passwordResetCredential.deleteMany();
    await db.auditLog.deleteMany({ where: { userId: { in: userIds } } });
    await db.refreshToken.deleteMany({ where: { userId: { in: userIds } } });
    await db.user.deleteMany({ where: { id: { in: userIds } } });
    userIds.length = 0;
  });

  async function user(role: UserRole = "LEARNER", status: UserStatus = "ACTIVE") {
    const result = await db.user.create({ data: {
      email: `${randomUUID()}@recovery.example.test`, name: "Synthetic recovery user", passwordHash: oldHash,
      role, status, roleVersion: 3, isEmailVerified: false, farmerOnboardingRequired: role === "FARMER",
    } });
    userIds.push(result.id);
    return result;
  }
  async function requestJob(email: string, locale: "bn" | "en" = "bn") {
    const existing = await db.accountRecoveryJob.findMany({ select: { id: true } });
    await expect(lifecycle.acceptRequest({ email, locale })).resolves.toEqual({ accepted: true });
    return db.accountRecoveryJob.findFirstOrThrow({ where: { id: { notIn: existing.map((job) => job.id) } } });
  }
  async function lease(id: string) {
    const fence = randomUUID();
    await db.$executeRaw`UPDATE account_recovery_jobs SET lease_id=${fence}::uuid, lease_until=clock_timestamp()+interval '60 seconds' WHERE id=${id}::uuid`;
    return fence;
  }
  async function issue(email: string, locale: "bn" | "en" = "bn") {
    const job = await requestJob(email, locale);
    const fence = await lease(job.id);
    const issued = await lifecycle.issueForRequest(job.id, fence);
    if (!issued) throw new Error("Expected issued synthetic credential");
    const payload = secrets.openPayload(issued);
    if (payload.kind !== "RESET_LINK") throw new Error("Expected reset payload");
    return { job: issued, token: payload.token, fence };
  }
  async function complete(token: string) {
    return lifecycle.complete({ token, newPassword });
  }

  it("persists a hashed credential with expiry and binding without a plaintext-token column", async () => {
    const user = await db.user.create({ data: {
      email: `${randomUUID()}@recovery.example.test`, name: "Synthetic recovery user", passwordHash: "synthetic-hash",
    } });
    try {
      const id = randomUUID();
      await db.$executeRaw`WITH c AS (SELECT clock_timestamp() AS t) INSERT INTO password_reset_credentials
        (id,user_id,token_hash,email_hmac,authorization_version,created_at,expires_at)
        SELECT ${id}::uuid,${user.id}::uuid,${"a".repeat(64)},${"b".repeat(64)},0,t,t+interval '30 minutes' FROM c`;
      const rows = await db.$queryRaw<Array<Record<string, unknown>>>`SELECT * FROM password_reset_credentials WHERE id=${id}::uuid`;
      expect(rows[0]).toMatchObject({ token_hash: "a".repeat(64), email_hmac: "b".repeat(64), authorization_version: 0 });
      expect(rows[0]).not.toHaveProperty("token");
      await db.$executeRaw`DELETE FROM password_reset_credentials WHERE id=${id}::uuid`;
    } finally {
      await db.user.delete({ where: { id: user.id } });
    }
  });

  it.each(Object.values(UserRole).flatMap((role) => ["ACTIVE", "PENDING_VERIFICATION"].map((status) => [role, status] as const)))(
    "recovers %s/%s without changing role, verification or onboarding", async (role, status) => {
      const target = await user(role, status as UserStatus);
      const session = await auth.login({ email: target.email, password: oldPassword });
      const oldClaims = await tokens.verifyAccessToken(session.tokens.accessToken);
      await expect(identities.resolve(oldClaims)).resolves.toMatchObject({ sub: target.id });
      const link = await issue(target.email);
      const credential = await db.passwordResetCredential.findUniqueOrThrow({ where: { id: link.job.credentialId! } });
      expect(credential.tokenHash).toBe(createHash("sha256").update(`password-reset:${link.token}`).digest("hex"));
      expect(credential.expiresAt.getTime() - credential.createdAt.getTime()).toBe(1800000);
      expect(link.token).toMatch(/^[0-9a-f]{64}$/);
      expect(JSON.stringify(link.job)).not.toContain(link.token);
      await expect(complete(link.token)).resolves.toEqual({ reset: true });
      const after = await db.user.findUniqueOrThrow({ where: { id: target.id } });
      expect(after).toMatchObject({ role, roleVersion: 3, status, email: target.email,
        isEmailVerified: false, farmerOnboardingRequired: role === "FARMER", authorizationVersion: 1 });
      expect(await hasher.compare(newPassword, after.passwordHash)).toBe(true);
      await expect(auth.login({ email: target.email, password: oldPassword })).rejects.toThrow();
      await expect(auth.refreshToken(session.tokens.refreshToken)).rejects.toThrow();
      await expect(identities.resolve(oldClaims)).rejects.toThrow();
      const nextSession = await auth.login({ email: target.email, password: newPassword });
      await expect(identities.resolve(await tokens.verifyAccessToken(nextSession.tokens.accessToken))).resolves.toMatchObject({ sub: target.id });
      const events = await db.auditLog.findMany({ where: { userId: target.id, action: "PASSWORD_RESET_COMPLETED" } });
      expect(events).toHaveLength(1);
      expect(events[0].newValues).toEqual({ purpose: "ACCOUNT_RECOVERY", authorizationVersion: 1 });
      const notices = await db.accountRecoveryJob.findMany({ where: { userId: target.id, kind: "PASSWORD_CHANGED" } });
      expect(notices).toHaveLength(1);
      expect(notices[0].deadlineAt.getTime() - notices[0].createdAt.getTime()).toBe(86400000);
      expect(JSON.stringify(events)).not.toContain(target.email);
      expect(JSON.stringify(events)).not.toContain(link.token);
      expect(JSON.stringify(events)).not.toContain(after.passwordHash);
    },
  );

  it("admits unknown/ineligible addresses identically and never changes sessions or grants on request", async () => {
    const active = await user(), suspended = await user("VET", "SUSPENDED"), deleted = await user();
    await db.user.update({ where: { id: deleted.id }, data: { deletedAt: new Date() } });
    const usable = await issue(active.email);
    const current = await db.user.findUniqueOrThrow({ where: { id: active.id } });
    const lookup = jest.spyOn(repo, "findUserByEmail");
    for (const email of [active.email, suspended.email, deleted.email, "absent@recovery.example.test"]) {
      const job = await requestJob(email);
      expect(job).toMatchObject({ userId: null, credentialId: null, status: "PENDING", attempts: 0 });
      expect(JSON.stringify(job)).not.toContain(email);
    }
    expect(lookup).not.toHaveBeenCalled();
    expect(await db.user.findUniqueOrThrow({ where: { id: active.id } })).toEqual(current);
    expect(await db.passwordResetCredential.findUniqueOrThrow({ where: { id: usable.job.credentialId! } })).toMatchObject({ consumedAt: null, invalidatedAt: null });
    for (const email of [suspended.email, deleted.email, "absent@recovery.example.test"]) {
      const job = await requestJob(email);
      await expect(lifecycle.issueForRequest(job.id, await lease(job.id))).resolves.toBeNull();
      expect(await db.accountRecoveryJob.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({ status: "SKIPPED", payload: null, userId: null, credentialId: null });
    }
  });

  it("caps six usable links under concurrent issuance without Redis and preserves previously usable links", async () => {
    const target = await user();
    const first = await issue(target.email);
    const pending = [];
    for (let i = 0; i < 11; i++) {
      const job = await requestJob(target.email);
      pending.push({ job, fence: await lease(job.id) });
    }
    const results = await Promise.all(pending.map(({ job, fence }) => lifecycle.issueForRequest(job.id, fence)));
    expect(results.filter(Boolean)).toHaveLength(5);
    expect(await db.passwordResetCredential.count({ where: { userId: target.id } })).toBe(6);
    await expect(complete(first.token)).resolves.toEqual({ reset: true });
    expect(await db.passwordResetCredential.count({ where: { userId: target.id, consumedAt: null, invalidatedAt: null } })).toBe(0);
  });

  it("replays issuance after a crash using the same encrypted credential and rejects a stale fence", async () => {
    const target = await user(), link = await issue(target.email);
    const newFence = await lease(link.job.id);
    await expect(lifecycle.issueForRequest(link.job.id, link.fence)).resolves.toBeNull();
    const replayed = await lifecycle.issueForRequest(link.job.id, newFence);
    expect(replayed).toMatchObject({ credentialId: link.job.credentialId, payload: link.job.payload });
    expect(await db.passwordResetCredential.count({ where: { userId: target.id } })).toBe(1);
  });

  it("reuses the committed grant when two issuers read the same unissued job and fence", async () => {
    const target = await user(), job = await requestJob(target.email), fence = await lease(job.id);
    const read = repo.findJob.bind(repo), bothRead = signal();
    let reads = 0;
    jest.spyOn(repo, "findJob").mockImplementation(async (id) => {
      const result = await read(id);
      if (++reads === 2) bothRead.release();
      await bothRead.promise;
      return result;
    });
    const results = await Promise.all([lifecycle.issueForRequest(job.id, fence), lifecycle.issueForRequest(job.id, fence)]);
    expect(results[0]).not.toBeNull();
    expect(results[1]).not.toBeNull();
    expect(results[0]!.credentialId).toBe(results[1]!.credentialId);
    expect(results[0]!.payload).toBe(results[1]!.payload);
    expect(await db.passwordResetCredential.count({ where: { userId: target.id, consumedAt: null, invalidatedAt: null } })).toBe(1);
    const payload = secrets.openPayload(results[0]!);
    if (payload.kind !== "RESET_LINK") throw new Error("Expected reset payload");
    await expect(complete(payload.token)).resolves.toEqual({ reset: true });
  });

  it("preserves the original request locale on the password-changed intent", async () => {
    const target = await user(), link = await issue(target.email, "en");
    await complete(link.token);
    const notice = await db.accountRecoveryJob.findFirstOrThrow({ where: { kind: "PASSWORD_CHANGED" } });
    expect(notice.locale).toBe("en");
    expect(secrets.openPayload(notice)).toMatchObject({ kind: "PASSWORD_CHANGED", locale: "en" });
  });

  it("does not retarget an issued job when its original email is reassigned", async () => {
    const original = await user(), link = await issue(original.email), replacement = await user();
    await db.user.update({ where: { id: original.id }, data: { email: `changed-${randomUUID()}@recovery.example.test` } });
    await db.user.update({ where: { id: replacement.id }, data: { email: original.email } });
    const locks = jest.spyOn(users, "lockById");
    await expect(lifecycle.issueForRequest(link.job.id, await lease(link.job.id))).resolves.toBeNull();
    expect(locks).toHaveBeenCalledWith(original.id, expect.anything());
    expect(locks).not.toHaveBeenCalledWith(replacement.id, expect.anything());
    expect(await db.passwordResetCredential.count({ where: { userId: replacement.id } })).toBe(0);
    expect((await db.user.findUniqueOrThrow({ where: { id: replacement.id } })).passwordHash).toBe(oldHash);
    await expect(complete(link.token)).rejects.toMatchObject({ errorCode: "RESET_LINK_INVALID" });
  });

  it("rechecks issuance after account changes, lease expiry and an expired request deadline", async () => {
    const target = await user(), job = await requestJob(target.email), fence = await lease(job.id);
    await db.$executeRaw`UPDATE account_recovery_jobs SET lease_until=clock_timestamp() WHERE id=${job.id}::uuid`;
    await expect(lifecycle.issueForRequest(job.id, fence)).resolves.toBeNull();
    expect(await db.passwordResetCredential.count()).toBe(0);
    const freshFence = await lease(job.id);
    await db.$executeRaw`WITH c AS (SELECT clock_timestamp() AS t) UPDATE account_recovery_jobs SET created_at=c.t-interval '10 minutes',deadline_at=c.t FROM c WHERE id=${job.id}::uuid`;
    await expect(lifecycle.issueForRequest(job.id, freshFence)).resolves.toBeNull();
    expect(await db.accountRecoveryJob.findUniqueOrThrow({ where: { id: job.id } })).toMatchObject({ status: "SKIPPED", payload: null, failureCode: "EXPIRED" });
    const noPassword = await user();
    await db.user.update({ where: { id: noPassword.id }, data: { passwordHash: "" } });
    const missing = await requestJob(noPassword.email);
    await expect(lifecycle.issueForRequest(missing.id, await lease(missing.id))).resolves.toBeNull();
  });

  it("excludes expired, invalidated and old-version links from the six-link cap", async () => {
    const target = await user();
    const links = [];
    for (let i = 0; i < 6; i++) links.push(await issue(target.email));
    await db.$executeRaw`WITH c AS (SELECT clock_timestamp() AS t) UPDATE password_reset_credentials SET created_at=c.t-interval '30 minutes',expires_at=c.t FROM c WHERE id=${links[0].job.credentialId}::uuid`;
    await issue(target.email);
    await db.passwordResetCredential.update({ where: { id: links[1].job.credentialId! }, data: { invalidatedAt: new Date() } });
    await issue(target.email);
    await auth.logoutAll(target.id);
    const fresh = await issue(target.email);
    await expect(complete(fresh.token)).resolves.toEqual({ reset: true });
  });

  it("rejects missing credentials and validates the password before credential lookup", async () => {
    await expect(complete("f".repeat(64))).rejects.toMatchObject({ errorCode: "RESET_LINK_INVALID" });
    const lookup = jest.spyOn(repo, "findCredentialByHash");
    lookup.mockClear();
    await expect(lifecycle.complete({ token: "f".repeat(64), newPassword: "short" })).rejects.toMatchObject({ errorCode: "VALIDATION_FAILED" });
    expect(lookup).not.toHaveBeenCalled();
  });

  it("rejects swapped and tampered encrypted intake without issuing a grant", async () => {
    const first = await requestJob("first@recovery.example.test"), second = await requestJob("second@recovery.example.test");
    await db.accountRecoveryJob.update({ where: { id: second.id }, data: { payload: first.payload } });
    await expect(lifecycle.issueForRequest(second.id, await lease(second.id))).rejects.toMatchObject({ errorCode: "RECOVERY_UNAVAILABLE" });
    const parts = first.payload!.split(":");
    parts[2] = (parts[2][0] === "0" ? "1" : "0") + parts[2].slice(1);
    await db.accountRecoveryJob.update({ where: { id: first.id }, data: { payload: parts.join(":") } });
    await expect(lifecycle.issueForRequest(first.id, await lease(first.id))).rejects.toMatchObject({ errorCode: "RECOVERY_UNAVAILABLE" });
    expect(await db.passwordResetCredential.count()).toBe(0);
  });

  it("enforces SQL lifetime, terminal-erasure and foreign-key invariants", async () => {
    const target = await user(), link = await issue(target.email);
    const credential = await db.passwordResetCredential.findUniqueOrThrow({ where: { id: link.job.credentialId! } });
    for (const data of [
      { tokenHash: "raw-secret" }, { authorizationVersion: -1 },
      { expiresAt: new Date(credential.createdAt.getTime() + 1800001) },
      { consumedAt: new Date(), invalidatedAt: new Date() },
    ]) await expect(db.passwordResetCredential.update({ where: { id: credential.id }, data })).rejects.toThrow();
    await expect(db.accountRecoveryJob.update({ where: { id: link.job.id }, data: { status: "SKIPPED" } })).rejects.toThrow();
    await expect(db.accountRecoveryJob.update({ where: { id: link.job.id }, data: { leaseId: null } })).rejects.toThrow();
    await expect(db.passwordResetCredential.delete({ where: { id: credential.id } })).rejects.toThrow();
    await expect(db.user.delete({ where: { id: target.id } })).rejects.toThrow();
    expect(await db.passwordResetCredential.findUniqueOrThrow({ where: { id: credential.id } })).toEqual(credential);
  });

  it.each(["expiry", "administrative-revocation"])("rechecks %s after hashing outside the user lock", async (change) => {
    const target = await user(), link = await issue(target.email), ready = signal(), resume = signal();
    const slowHasher = {
      compare: hasher.compare.bind(hasher),
      async hash(value: string) { const result = await hasher.hash(value); ready.release(); await resume.promise; return result; },
    };
    const slow = new AccountRecoveryLifecycleService(repo, transactions, slowHasher, secrets);
    const pending = slow.complete({ token: link.token, newPassword });
    void pending.catch(() => undefined);
    await ready.promise;
    try {
      if (change === "expiry") await db.$executeRaw`WITH c AS (SELECT clock_timestamp() AS t) UPDATE password_reset_credentials SET created_at=c.t-interval '30 minutes',expires_at=c.t FROM c WHERE id=${link.job.credentialId}::uuid`;
      else await auth.logoutAll(target.id);
    } finally { resume.release(); }
    await expect(pending).rejects.toMatchObject({ errorCode: "RESET_LINK_INVALID" });
    expect((await db.user.findUniqueOrThrow({ where: { id: target.id } })).passwordHash).toBe(oldHash);
  });

  it("uses database time for reset expiry despite application-clock skew", async () => {
    const target = await user(), link = await issue(target.email);
    const clock = jest.spyOn(Date, "now").mockReturnValue(Date.now() + 864000000);
    try { await expect(complete(link.token)).resolves.toEqual({ reset: true }); }
    finally { clock.mockRestore(); }
  });

  it("prevents an old-password login that compared the password before reset from escaping revocation", async () => {
    const target = await user(), link = await issue(target.email), ready = signal(), resume = signal();
    const gated = { hash: hasher.hash.bind(hasher), async compare(plain: string, hash: string) {
      const valid = await hasher.compare(plain, hash); ready.release(); await resume.promise; return valid;
    } };
    const racingAuth = new AuthService(users, sessions, gated, tokens, transactions, new PiiCryptoService(env), audit);
    const pending = racingAuth.login({ email: target.email, password: oldPassword });
    void pending.catch(() => undefined);
    await ready.promise;
    try { await complete(link.token); } finally { resume.release(); }
    await expect(pending).rejects.toThrow();
    expect(await db.refreshToken.count({ where: { userId: target.id, revokedAt: null } })).toBe(0);
  });

  it("prevents a refresh that read its token before reset from rotating a surviving session", async () => {
    const target = await user(), link = await issue(target.email);
    const login = await auth.login({ email: target.email, password: oldPassword });
    const ready = signal(), resume = signal();
    const find = sessions.findByTokenHash.bind(sessions);
    jest.spyOn(sessions, "findByTokenHash").mockImplementationOnce(async (...args) => {
      const result = await find(...args); ready.release(); await resume.promise; return result;
    });
    const pending = auth.refreshToken(login.tokens.refreshToken);
    void pending.catch(() => undefined);
    await ready.promise;
    try { await complete(link.token); } finally { resume.release(); }
    await expect(pending).rejects.toThrow();
    expect(await db.refreshToken.count({ where: { userId: target.id, revokedAt: null } })).toBe(0);
  });

  it("denies old modern/legacy claims and disconnects active/passive socket recipients after reset", async () => {
    const recovered = await user("VET"), administrator = await user("ADMIN");
    const session = await auth.login({ email: recovered.email, password: oldPassword });
    const current = await tokens.verifyAccessToken(session.tokens.accessToken);
    const { authorizationVersion: _version, ...legacy } = current;
    await expect(identities.resolve(legacy)).resolves.toMatchObject({ sub: recovered.id });
    const adminSession = await auth.login({ email: administrator.email, password: oldPassword });
    const adminClaims = await tokens.verifyAccessToken(adminSession.tokens.accessToken);
    const consultationId = randomUUID();
    const consultation = ConsultationEntity.create({ id: consultationId, farmId: randomUUID(), farmerId: recovered.id, chiefComplaint: "Synthetic recovery socket check" });
    const gateway = new ConsultationChatGateway(tokens,
      {} as IConsultationChatService,
      { findById: async () => consultation } as unknown as IConsultationRepository,
      {} as IFarmMemberRepository, identities);
    function client(id: string, claims: JwtPayload) {
      const events: string[] = [];
      const state = { disconnected: false };
      const socket = { id, data: { user: claims },
        emit(event: string) { events.push(event); },
        disconnect() { state.disconnected = true; },
        async join() {}, async leave() {},
      } as unknown as Socket;
      return { socket, state, events };
    }
    const active = client("active", current), passive = client("passive", legacy), admin = client("admin", adminClaims);
    gateway.server = { in: () => ({ fetchSockets: async () => [passive.socket] }) } as unknown as Server;
    const link = await issue(recovered.email);
    await complete(link.token);
    await expect(identities.resolve(current)).rejects.toMatchObject({ errorCode: "AUTHORIZATION_CHANGED" });
    await expect(identities.resolve(legacy)).rejects.toMatchObject({ errorCode: "AUTHORIZATION_CHANGED" });
    await gateway.handleSendMessage(active.socket, { consultationId, content: "Must not send" });
    await gateway.handleJoinRoom(admin.socket, { consultationId });
    expect(active.state.disconnected).toBe(true);
    expect(passive.state.disconnected).toBe(true);
    expect(passive.events).not.toContain("user_joined");
    expect(admin.state.disconnected).toBe(false);
  });

  it.each(["email", "version", "suspended", "deleted", "expired", "consumed", "invalidated"])(
    "rejects a credential after %s changes with the same invalid-link error", async (change) => {
      const target = await user(), link = await issue(target.email);
      if (change === "email") await db.user.update({ where: { id: target.id }, data: { email: `${randomUUID()}@recovery.example.test` } });
      if (change === "version") await auth.logoutAll(target.id);
      if (change === "suspended") await db.user.update({ where: { id: target.id }, data: { status: "SUSPENDED" } });
      if (change === "deleted") await db.user.update({ where: { id: target.id }, data: { deletedAt: new Date() } });
      if (change === "expired") await db.$executeRaw`WITH c AS (SELECT clock_timestamp() AS t) UPDATE password_reset_credentials SET created_at=c.t-interval '30 minutes',expires_at=c.t FROM c WHERE id=${link.job.credentialId}::uuid`;
      if (change === "consumed") await db.passwordResetCredential.update({ where: { id: link.job.credentialId! }, data: { consumedAt: new Date() } });
      if (change === "invalidated") await db.passwordResetCredential.update({ where: { id: link.job.credentialId! }, data: { invalidatedAt: new Date() } });
      await expect(complete(link.token)).rejects.toMatchObject({ errorCode: "RESET_LINK_INVALID", statusCode: 400 });
      expect((await db.user.findUniqueOrThrow({ where: { id: target.id } })).passwordHash).toBe(oldHash);
    },
  );

  it.each([false, true])("admits exactly one reset winner for same/different-link races (%s)", async (different) => {
    const target = await user(), first = await issue(target.email), second = different ? await issue(target.email) : first;
    const results = await Promise.allSettled([complete(first.token), complete(second.token)]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected")).toMatchObject({ reason: { errorCode: "RESET_LINK_INVALID" } });
    expect(await db.auditLog.count({ where: { userId: target.id, action: "PASSWORD_RESET_COMPLETED" } })).toBe(1);
    expect(await db.accountRecoveryJob.count({ where: { userId: target.id, kind: "PASSWORD_CHANGED" } })).toBe(1);
    expect(await db.accountRecoveryJob.count({ where: { kind: "RESET_REQUEST", status: "PENDING" } })).toBe(0);
    expect((await db.user.findUniqueOrThrow({ where: { id: target.id } })).authorizationVersion).toBe(1);
  });

  it("enforces atomic account-independent admission backpressure under concurrency", async () => {
    const results = await Promise.allSettled(Array.from({ length: 105 }, (_, i) => lifecycle.acceptRequest({ email: `unknown-${i}@recovery.example.test`, locale: "bn" })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(100);
    expect(await db.accountRecoveryJob.count()).toBe(100);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(5);
    await db.accountRecoveryJob.deleteMany();
    const old = await requestJob("old@recovery.example.test");
    await db.$executeRaw`WITH c AS (SELECT clock_timestamp() AS t) UPDATE account_recovery_jobs SET created_at=c.t-interval '60 seconds', deadline_at=c.t+interval '540 seconds' FROM c WHERE id=${old.id}::uuid`;
    await expect(lifecycle.acceptRequest({ email: "any@recovery.example.test", locale: "en" })).rejects.toMatchObject({ errorCode: "RECOVERY_UNAVAILABLE" });
    expect(await db.accountRecoveryJob.count()).toBe(1);
  });

  it("allows a committed password reset and notice when intake is saturated", async () => {
    const target = await user(), link = await issue(target.email);
    await Promise.all(Array.from({ length: 99 }, (_, i) => lifecycle.acceptRequest({ email: `saturated-${i}@recovery.example.test`, locale: "bn" })));
    expect(await db.accountRecoveryJob.count({ where: { status: "PENDING", kind: "RESET_REQUEST" } })).toBe(100);
    await expect(complete(link.token)).resolves.toEqual({ reset: true });
    expect(await db.accountRecoveryJob.count({ where: { kind: "PASSWORD_CHANGED" } })).toBe(1);
  });

  it("revokes only the recovered account's sessions and links", async () => {
    const recovered = await user(), untouched = await user();
    const targetLink = await issue(recovered.email), otherLink = await issue(untouched.email);
    const otherSession = await auth.login({ email: untouched.email, password: oldPassword });
    const before = await db.user.findUniqueOrThrow({ where: { id: untouched.id } });
    await complete(targetLink.token);
    expect(await db.user.findUniqueOrThrow({ where: { id: untouched.id } })).toEqual(before);
    expect(await db.passwordResetCredential.findUniqueOrThrow({ where: { id: otherLink.job.credentialId! } })).toMatchObject({ consumedAt: null, invalidatedAt: null });
    expect(await db.accountRecoveryJob.findUniqueOrThrow({ where: { id: otherLink.job.id } })).toMatchObject({ status: "PENDING", payload: otherLink.job.payload });
    await expect(identities.resolve(await tokens.verifyAccessToken(otherSession.tokens.accessToken))).resolves.toMatchObject({ sub: untouched.id });
    await expect(auth.refreshToken(otherSession.tokens.refreshToken)).resolves.toHaveProperty("tokens");
  });

  it.each(["password", "sessions", "credentials", "audit", "notice"])("rolls back every reset mutation if %s persistence fails", async (fault) => {
    const target = await user(), link = await issue(target.email);
    await auth.login({ email: target.email, password: oldPassword });
    const before = await db.user.findUniqueOrThrow({ where: { id: target.id } });
    const faults = {
      password: { table: "users", event: "UPDATE", condition: "NEW.password_hash <> OLD.password_hash" },
      sessions: { table: "refresh_tokens", event: "UPDATE", condition: "NEW.revoked_at IS NOT NULL" },
      credentials: { table: "password_reset_credentials", event: "UPDATE", condition: "NEW.consumed_at IS NOT NULL" },
      audit: { table: "audit_logs", event: "INSERT", condition: "NEW.action = 'PASSWORD_RESET_COMPLETED'" },
      notice: { table: "account_recovery_jobs", event: "INSERT", condition: "NEW.kind = 'PASSWORD_CHANGED'" },
    } as const;
    const rule = faults[fault as keyof typeof faults];
    // Constant, test-owned identifiers and PL/pgSQL; no request values in SQL text.
    await db.$executeRawUnsafe("CREATE FUNCTION recovery_test_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic storage fault'; END $$");
    await db.$executeRawUnsafe(`CREATE TRIGGER recovery_test_fault BEFORE ${rule.event} ON ${rule.table} FOR EACH ROW WHEN (${rule.condition}) EXECUTE FUNCTION recovery_test_fault()`);
    try {
      await expect(complete(link.token)).rejects.toThrow();
      expect(await db.user.findUniqueOrThrow({ where: { id: target.id } })).toEqual(before);
      expect(await db.refreshToken.count({ where: { userId: target.id, revokedAt: null } })).toBe(1);
      expect(await db.passwordResetCredential.findUniqueOrThrow({ where: { id: link.job.credentialId! } })).toMatchObject({ consumedAt: null, invalidatedAt: null });
      expect(await db.accountRecoveryJob.findUniqueOrThrow({ where: { id: link.job.id } })).toMatchObject({ status: "PENDING", payload: link.job.payload });
      expect(await db.auditLog.count({ where: { userId: target.id, action: "PASSWORD_RESET_COMPLETED" } })).toBe(0);
      expect(await db.accountRecoveryJob.count({ where: { kind: "PASSWORD_CHANGED" } })).toBe(0);
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER recovery_test_fault ON ${rule.table}`);
      await db.$executeRawUnsafe("DROP FUNCTION recovery_test_fault()");
    }
    await expect(complete(link.token)).resolves.toEqual({ reset: true });
  });

  it("does not log slow-query parameters or database-error bodies containing recovery secrets", async () => {
    const warn = jest.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const error = jest.spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
    const output = jest.spyOn(console, "log").mockImplementation(() => undefined);
    const client = new PrismaService(new ConfigService({ NODE_ENV: "test", SLOW_QUERY_THRESHOLD_MS: "1" }));
    const marker = "synthetic-recovery-sensitive-value";
    try {
      await client.$queryRaw`SELECT pg_sleep(0.02)::text AS wait,${marker}::text AS marker`;
      await expect(client.$queryRaw`SELECT CAST(${marker} AS INTEGER)`).rejects.toThrow();
      await new Promise<void>((resolve) => setImmediate(resolve));
      expect(warn.mock.calls.some((call) => String(call[0]).includes("SLOW QUERY"))).toBe(true);
      expect(JSON.stringify([...warn.mock.calls, ...error.mock.calls, ...output.mock.calls])).not.toContain(marker);
    } finally {
      await client.$disconnect();
    }
  });
});
