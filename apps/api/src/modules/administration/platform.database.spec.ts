import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import {
  JwtPayload,
  UserRole,
  platformQueues,
  platformSettingsSaveSchema,
  platformReportQuerySchema,
  platformAuditExportSchema,
  platformSystemSchema,
} from "@vetralink/shared-types";
import { PlatformRepository, platformSettingsId } from "./platform.repository";
import { PlatformService } from "./platform.service";
import { PlatformProbe } from "./platform-probe.service";
import { PrismaService } from "../prisma/prisma.service";
import { UserRepository } from "../users/repositories/user.repository";
import { BcryptPasswordHasher } from "../auth/services/bcrypt-password-hasher.service";
import { AuditLogRepository } from "../audit/repositories/audit-log.repository";
import { TransactionManager } from "../prisma/transaction/transaction.manager";
import { EnvService } from "../../config";
const url = process.env.PLATFORM_TEST_DATABASE_URL;
if (
  url &&
  (!["127.0.0.1", "localhost"].includes(new URL(url).hostname) ||
    new URL(url).pathname !== "/adm8_test")
)
  throw new Error("Explicit disposable loopback /adm8_test required");
const password = "Synthetic ADM8 password!",
  confirmation = {
    actorPassword: password,
    reason: "Reviewed synthetic operation",
    confirmed: true as const,
  };
const query = {
  from: "2026-10-01",
  to: "2026-10-02",
  timezone: "Asia/Dhaka" as const,
};
const fields = {
  organizationBn: "পরীক্ষার প্রতিষ্ঠান",
  organizationEn: "Synthetic organization",
  supportEmail: "synthetic@example.test",
  reportTimezone: "UTC" as const,
};
const snapshot = () =>
  platformSystemSchema.parse({
    checkedAt: new Date().toISOString(),
    database: "UP",
    redis: "UNAVAILABLE",
    roleEmail: { pending: 0, failed: 0 },
    queues: platformQueues.map((name) => ({
      name,
      status: "UNAVAILABLE",
      counts: null,
      registeredWorkers: null,
    })),
  });
describe("ADM8 strict boundary contracts", () => {
  it("rejects secret/config injection, missing confirmation and invalid date windows", () => {
    expect(
      platformSettingsSaveSchema.safeParse({
        ...fields,
        ...confirmation,
        expectedVersion: 0,
        STRIPE_SECRET_KEY: "synthetic",
      }).success,
    ).toBe(false);
    expect(
      platformSettingsSaveSchema.safeParse({
        ...fields,
        ...confirmation,
        confirmed: false,
        expectedVersion: 0,
      }).success,
    ).toBe(false);
    for (const patch of [
      { from: "2026-02-30" },
      { to: "2026-10-01" },
      { to: "2028-10-01" },
      { timezone: "America/New_York" },
      { role: "SUPER_ADMIN" },
    ])
      expect(
        platformReportQuerySchema.safeParse({ ...query, ...patch }).success,
      ).toBe(false);
    expect(
      platformAuditExportSchema.safeParse({
        ...confirmation,
        query: { ...query, limit: 501 },
      }).success,
    ).toBe(false);
    expect(
      platformSystemSchema.safeParse({ ...snapshot(), redisUrl: "secret" })
        .success,
    ).toBe(false);
  });
});
(url ? describe : describe.skip)("ADM8 real PostgreSQL", () => {
  let db: PrismaClient,
    repo: PlatformRepository,
    service: PlatformService,
    audit: AuditLogRepository;
  let superAdmin: JwtPayload,
    secondSuper: JwtPayload,
    admin: JwtPayload,
    learner: JwtPayload;
  const ids: string[] = [],
    orderIds: string[] = [],
    subIds: string[] = [],
    eventIds: string[] = [],
    runIds: string[] = [],
    planIds: string[] = [];
  const hasher = new BcryptPasswordHasher(),
    probe = {
      system: jest.fn(async () => snapshot()),
      integrations: jest.fn(),
    },
    limiter = { hit: jest.fn(async () => {}) };
  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url } } });
    const adapter = db as unknown as PrismaService,
      hash = await hasher.hash(password);
    const user = async (role: UserRole) => {
      const u = await db.user.create({
        data: {
          name: "Synthetic ADM8",
          email: `${randomUUID()}@adm8.example.test`,
          passwordHash: hash,
          role,
        },
      });
      ids.push(u.id);
      return { sub: u.id, role, authorizationVersion: 0 } as JwtPayload;
    };
    superAdmin = await user(UserRole.SUPER_ADMIN);
    secondSuper = await user(UserRole.SUPER_ADMIN);
    admin = await user(UserRole.ADMIN);
    learner = await user(UserRole.LEARNER);
    repo = new PlatformRepository(adapter);
    audit = new AuditLogRepository(adapter);
    service = new PlatformService(
      repo,
      probe as unknown as PlatformProbe,
      new UserRepository(adapter, {} as never),
      hasher,
      new TransactionManager(adapter),
      audit,
      limiter as never,
    );
    for (const tier of ["STARTER", "PRO", "ENTERPRISE"] as const) {
      const plan = await db.subscriptionPlan.create({
        data: {
          name: "Synthetic " + tier,
          tier,
          priceMonthlyCents: 2001,
          priceAnnualCents: 12013,
          maxAnimals: 10,
        },
      });
      planIds.push(plan.id);
    }
    for (const [status, annual, planId] of [
      ["ACTIVE", false, planIds[0]],
      ["ACTIVE", true, planIds[1]],
      ["ACTIVE", true, planIds[1]],
      ["CANCELED", false, planIds[2]],
    ] as const) {
      const s = await db.subscription.create({
        data: {
          userId: learner.sub,
          planId,
          status,
          currentPeriodStart: new Date("2026-01-01T00:00:00Z"),
          currentPeriodEnd: new Date(
            annual ? "2027-01-01T00:00:00Z" : "2026-02-01T00:00:00Z",
          ),
          createdAt: new Date("2026-09-30T18:00:00Z"),
        },
      });
      subIds.push(s.id);
    }
    for (const [currency, status, createdAt, totalCents] of [
      ["USD", "COMPLETED", "2026-09-30T18:00:00Z", 2147483647],
      ["USD", "COMPLETED", "2026-09-30T18:00:01Z", 2147483647],
      ["BDT", "COMPLETED", "2026-09-30T18:00:00Z", 501],
      ["USD", "PENDING", "2026-10-01T17:59:59Z", 123],
      ["BDT", "COMPLETED", "2026-10-01T18:00:00Z", 900],
      ["USD", "COMPLETED", "2026-09-30T17:59:59Z", 800],
    ] as const) {
      const o = await db.order.create({
        data: {
          userId: learner.sub,
          currency,
          status,
          totalCents,
          paymentGateway: "synthetic",
          createdAt: new Date(createdAt),
        },
      });
      orderIds.push(o.id);
    }
  }, 30000);
  afterAll(async () => {
    if (!db) return;
    await db.platformDiagnosticRun.deleteMany({
      where: { actorId: { in: ids } },
    });
    await db.platformSettings.deleteMany({ where: { id: platformSettingsId } });
    await db.auditLog.deleteMany({
      where: { OR: [{ userId: { in: ids } }, { id: { in: eventIds } }] },
    });
    await db.order.deleteMany({ where: { id: { in: orderIds } } });
    await db.subscription.deleteMany({ where: { id: { in: subIds } } });
    await db.subscriptionPlan.deleteMany({ where: { id: { in: planIds } } });
    await db.user.deleteMany({ where: { id: { in: ids } } });
    await db.$disconnect();
  });
  it("denies ADMIN and ordinary roles on Super-only reads and crafted writes", async () => {
    for (const claims of [admin, learner]) {
      await expect(service.settings(claims)).rejects.toMatchObject({
        errorCode: "FORBIDDEN_OPERATION",
      });
      await expect(service.integrations(claims)).rejects.toMatchObject({
        errorCode: "FORBIDDEN_OPERATION",
      });
      await expect(service.system(claims)).rejects.toMatchObject({
        errorCode: "FORBIDDEN_OPERATION",
      });
      await expect(
        service.saveSettings(claims, {
          ...fields,
          ...confirmation,
          expectedVersion: 0,
        }),
      ).rejects.toMatchObject({ errorCode: "FORBIDDEN_OPERATION" });
    }
    await expect(service.report(learner, query)).rejects.toMatchObject({
      errorCode: "FORBIDDEN_OPERATION",
    });
  });
  it("does not persist defaults on GET and saves safe configuration plus audit atomically", async () => {
    expect((await service.settings(superAdmin)).version).toBe(0);
    expect(await db.platformSettings.count()).toBe(0);
    await expect(
      service.saveSettings(superAdmin, {
        ...fields,
        ...confirmation,
        actorPassword: "wrong",
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({ errorCode: "PASSWORD_CONFIRMATION_FAILED" });
    const saved = await service.saveSettings(superAdmin, {
      ...fields,
      ...confirmation,
      expectedVersion: 0,
    });
    expect(saved).toMatchObject({ ...fields, version: 1 });
    expect(
      await db.auditLog.count({
        where: { userId: superAdmin.sub, action: "PLATFORM_SETTINGS_UPDATED" },
      }),
    ).toBe(1);
    const event = await db.auditLog.findFirstOrThrow({
      where: { userId: superAdmin.sub, action: "PLATFORM_SETTINGS_UPDATED" },
    });
    expect(JSON.stringify(event)).not.toContain(password);
  });
  it("rejects stale writes and admits exactly one concurrent versioned update", async () => {
    await expect(
      service.saveSettings(superAdmin, {
        ...fields,
        ...confirmation,
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({ errorCode: "SETTINGS_CONFLICT" });
    const outcomes = await Promise.allSettled(
      [superAdmin, secondSuper].map((c) =>
        service.saveSettings(c, {
          ...fields,
          ...confirmation,
          expectedVersion: 1,
        }),
      ),
    );
    expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect((await service.settings(superAdmin)).version).toBe(2);
  });
  it("rolls back settings and diagnostics when audit persistence fails", async () => {
    const spy = jest
      .spyOn(audit, "record")
      .mockRejectedValueOnce(new Error("Synthetic audit failure"));
    await expect(
      service.saveSettings(superAdmin, {
        ...fields,
        ...confirmation,
        organizationEn: "Must roll back",
        expectedVersion: 2,
      }),
    ).rejects.toThrow("Synthetic audit failure");
    spy.mockRestore();
    expect((await service.settings(superAdmin)).organizationEn).toBe(
      fields.organizationEn,
    );
    const requestId = randomUUID();
    runIds.push(requestId);
    const failed = jest
      .spyOn(audit, "record")
      .mockRejectedValueOnce(new Error("Synthetic audit failure"));
    await expect(
      service.diagnostics(superAdmin, {
        ...confirmation,
        requestId,
        action: "RUN_DIAGNOSTICS",
      }),
    ).rejects.toThrow("Synthetic audit failure");
    failed.mockRestore();
    expect(
      await db.platformDiagnosticRun.findUnique({ where: { id: requestId } }),
    ).toBeNull();
  });
  it("replays the same redacted diagnostic only to its original actor", async () => {
    probe.system.mockClear();
    const requestId = randomUUID();
    runIds.push(requestId);
    const first = await service.diagnostics(superAdmin, {
      ...confirmation,
      requestId,
      action: "RUN_DIAGNOSTICS",
    });
    expect(
      await service.diagnostics(superAdmin, {
        ...confirmation,
        requestId,
        action: "RUN_DIAGNOSTICS",
      }),
    ).toEqual(first);
    expect(probe.system).toHaveBeenCalledTimes(1);
    await expect(
      service.diagnostics(secondSuper, {
        ...confirmation,
        requestId,
        action: "RUN_DIAGNOSTICS",
      }),
    ).rejects.toMatchObject({ errorCode: "FORBIDDEN_OPERATION" });
    expect(await db.auditLog.count({ where: { entityId: requestId } })).toBe(1);
  });
  it("uses local midnight bounds, exact sums, current status/tier counts and per-record annual rounding", async () => {
    const r = await service.report(admin, query);
    expect(r.range).toMatchObject({
      startInstant: "2026-09-30T18:00:00.000Z",
      endInstant: "2026-10-01T18:00:00.000Z",
    });
    expect(r.orders).toEqual(
      expect.arrayContaining([
        {
          currency: "USD",
          status: "COMPLETED",
          count: 2,
          totalMinor: "4294967294",
        },
        { currency: "BDT", status: "COMPLETED", count: 1, totalMinor: "501" },
      ]),
    );
    expect(r.orders.find((o) => o.status === "PENDING")?.totalMinor).toBe(
      "123",
    );
    expect(r.subscriptions.estimatedMrr).toEqual({
      currency: "USD",
      totalMinor: "4003",
      basis: "CURRENT_LOCAL_PLAN_ESTIMATE",
    });
    expect(r.subscriptions.created).toEqual([{ period: "2026-10", count: 4 }]);
    expect(r.subscriptions.tiers.reduce((sum, t) => sum + t.count, 0)).toBe(4);
    expect(r.branding).toEqual(fields);
    const utc = await service.report(superAdmin, { ...query, timezone: "UTC" });
    expect(utc.subscriptions.created).toEqual([]);
    expect(utc.orders.find((o) => o.currency === "BDT")?.totalMinor).toBe(
      "900",
    );
  });
  it("returns empty cohorts with genuine zero amounts and rejects future/unknown query fields", async () => {
    const r = await service.report(admin, {
      from: "2001-01-01",
      to: "2001-01-02",
      timezone: "UTC",
    });
    expect(r.orders).toEqual([]);
    expect(r.subscriptions.created).toEqual([]);
    await expect(
      service.report(admin, { ...query, from: "2099-01-01", to: "2099-01-02" }),
    ).rejects.toMatchObject({ errorCode: "VALIDATION_FAILED" });
    await expect(
      service.report(admin, { ...query, secret: "x" } as never),
    ).rejects.toMatchObject({ errorCode: "VALIDATION_FAILED" });
  });
  it("audits report exports, returns the authoritative snapshot and fails atomically", async () => {
    const r = await service.exportReport(admin, { ...confirmation, query });
    expect(
      r.report.orders.find(
        (o) => o.currency === "USD" && o.status === "COMPLETED",
      )?.totalMinor,
    ).toBe("4294967294");
    expect(
      await db.auditLog.count({
        where: {
          entityId: r.exportId,
          action: "ADMIN_REPORT_EXPORTED",
          userId: admin.sub,
        },
      }),
    ).toBe(1);
    const failed = jest
      .spyOn(audit, "record")
      .mockRejectedValueOnce(new Error("Synthetic audit failure"));
    await expect(
      service.exportReport(admin, { ...confirmation, query }),
    ).rejects.toThrow("Synthetic audit failure");
    failed.mockRestore();
  });
  it("exports only allowed metadata and pages at 500 rows without disclosing privileged events", async () => {
    const rows = Array.from({ length: 503 }, () => ({
      id: randomUUID(),
      userId: admin.sub,
      entityType: "SyntheticADM8",
      entityId: learner.sub,
      action: "USER_SUSPENDED",
      traceId: randomUUID(),
      createdAt: new Date("2026-10-01T00:00:00Z"),
      ipAddress: "127.0.0.1",
      newValues: {
        password: "SYNTHETIC_PRIVATE",
        privateNote: "MUST_NOT_EXPORT",
      },
    }));
    rows.push({
      ...rows[0],
      id: randomUUID(),
      action: "ADMIN_PRIVILEGE_GRANTED",
    });
    eventIds.push(...rows.map((r) => r.id));
    await db.auditLog.createMany({ data: rows });
    const auditQuery = { ...query, entityType: "SyntheticADM8", limit: 500 };
    const first = await service.exportAudit(admin, {
      ...confirmation,
      query: auditQuery,
    });
    expect(first.items).toHaveLength(500);
    expect(first.truncated).toBe(true);
    const second = await service.exportAudit(admin, {
      ...confirmation,
      query: { ...auditQuery, cursor: first.nextCursor! },
    });
    expect(second.items).toHaveLength(3);
    expect(second.truncated).toBe(false);
    expect(
      new Set([...first.items, ...second.items].map((r) => r.id)).size,
    ).toBe(503);
    expect(JSON.stringify(first)).not.toMatch(
      /SYNTHETIC_PRIVATE|MUST_NOT_EXPORT|ipAddress|newValues/,
    );
    expect(
      (
        await service.exportAudit(admin, {
          ...confirmation,
          query: { ...auditQuery, action: "ADMIN_PRIVILEGE_GRANTED" },
        })
      ).items,
    ).toEqual([]);
    expect(
      (
        await service.exportAudit(superAdmin, {
          ...confirmation,
          query: { ...auditQuery, action: "ADMIN_PRIVILEGE_GRANTED" },
        })
      ).items,
    ).toHaveLength(1);
  });
  it("rejects changed role/version, suspended accounts and changed password under the actor lock", async () => {
    await expect(
      service.report({ ...admin, authorizationVersion: 99 }, query),
    ).rejects.toMatchObject({ errorCode: "FORBIDDEN_OPERATION" });
    await expect(
      service.settings({ ...admin, role: UserRole.SUPER_ADMIN }),
    ).rejects.toMatchObject({ errorCode: "FORBIDDEN_OPERATION" });
    await db.user.update({
      where: { id: learner.sub },
      data: { status: "SUSPENDED" },
    });
    await expect(
      service.report({ ...learner, role: UserRole.ADMIN }, query),
    ).rejects.toMatchObject({ errorCode: "FORBIDDEN_OPERATION" });
    // Simulate the hash changing between password confirmation and transaction entry.
    const users = (service as unknown as { users: UserRepository }).users;
    const lock = jest.spyOn(users, "lockById");
    const underlying = users.lockById.bind(users);
    lock.mockImplementationOnce(async (id, tx) => {
      const u = await underlying(id, tx);
      return u
        ? Object.assign(Object.create(Object.getPrototypeOf(u)), u, {
            _passwordHash: "changed",
          })
        : null;
    });
    await expect(
      service.saveSettings(superAdmin, {
        ...fields,
        ...confirmation,
        expectedVersion: 2,
      }),
    ).rejects.toMatchObject({ errorCode: "FORBIDDEN_OPERATION" });
    lock.mockRestore();
  });
  it("performs a real database probe and redacts unavailable Redis/queue errors", async () => {
    const liveProbe = new PlatformProbe(
      {
        redisUrl: "redis://synthetic:do-not-expose@127.0.0.1:55441",
      } as EnvService,
      repo,
    );
    const result = await liveProbe.system();
    expect(result.database).toBe("UP");
    expect(result.redis).toBe("UNAVAILABLE");
    expect(result.queues.every((q) => q.status === "UNAVAILABLE")).toBe(true);
    expect(JSON.stringify(result)).not.toMatch(
      /synthetic|do-not-expose|55441|ECONNREFUSED/,
    );
  }, 10000);
});
