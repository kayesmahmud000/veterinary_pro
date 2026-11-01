import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { Queue, Worker } from "bullmq";
import { JwtPayload, UserRole } from "@vetralink/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { TransactionManager } from "../prisma/transaction/transaction.manager";
import { UserRepository } from "../users/repositories/user.repository";
import { BcryptPasswordHasher } from "../auth/services/bcrypt-password-hasher.service";
import { RefreshTokenRepository } from "../auth/repositories/refresh-token.repository";
import { AuditLogRepository } from "../audit/repositories/audit-log.repository";
import { RoleNotificationRepository } from "../role-notifications/role-notification.repository";
import { RoleNotificationProcessor } from "../role-notifications/role-notification.processor";
import { RoleNotificationDispatcher } from "../role-notifications/role-notification-dispatcher.service";
import { WorkflowRateLimiter } from "../../common/security/workflow-rate-limiter";
import { EnvService } from "../../config";
import { DirectoryRepository } from "./directory.repository";
import { DirectoryService } from "./directory.service";
import { CommunicationsRepository } from "./communications.repository";
import { CommunicationsService } from "./communications.service";
import { PlatformRepository } from "./platform.repository";
import { PlatformProbe } from "./platform-probe.service";

// Both targets must be task-owned services; never fall back to project .env.
const database = process.env.ADM9_TEST_DATABASE_URL;
const redis = process.env.ADM9_TEST_REDIS_URL;
if (
  database &&
  !/^postgresql:\/\/postgres@127\.0\.0\.1:55432\/adm9_test$/.test(database)
)
  throw new Error("Explicit disposable 127.0.0.1:55432/adm9_test required");
if (redis && redis !== "redis://127.0.0.1:56380")
  throw new Error("Explicit disposable Redis on 127.0.0.1:56380 required");
const password = "Synthetic ADM9 password!";
const confirmation = {
  actorPassword: password,
  reason: "Synthetic integrated acceptance",
  confirmed: true as const,
};
const accountConfirmation = {
  actorPassword: password,
  reason: confirmation.reason,
};

(database && redis ? describe : describe.skip)(
  "ADM9 real PostgreSQL/Redis acceptance with controlled mail",
  () => {
    let db: PrismaClient,
      directory: DirectoryService,
      communications: CommunicationsService;
    let audit: AuditLogRepository,
      records: RoleNotificationRepository,
      limiter: WorkflowRateLimiter;
    let dispatcher: RoleNotificationDispatcher,
      queue: Queue,
      probe: PlatformProbe;
    let worker: Worker | undefined;
    let baselineCompletedAt: Date | null | undefined;
    const users: string[] = [],
      events: string[] = [],
      jobs: string[] = [];
    const hasher = new BcryptPasswordHasher();
    const connection = { host: "127.0.0.1", port: 56380 };
    const env = {
      redisUrl: redis,
      webBaseUrl: "http://localhost:3410",
      emailFrom: "synthetic@example.test",
    } as EnvService;
    let hash: string;
    async function user(role = UserRole.LEARNER) {
      const row = await db.user.create({
        data: {
          name: "Synthetic ADM9",
          email: `${randomUUID()}@adm9.example.test`,
          passwordHash: hash,
          role,
        },
      });
      users.push(row.id);
      return { sub: row.id, role, authorizationVersion: 0 } as JwtPayload;
    }
    async function until(check: () => Promise<boolean>) {
      const end = Date.now() + 12000;
      while (Date.now() < end) {
        if (await check()) return;
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      throw new Error("Synthetic runtime acceptance timed out");
    }
    async function notification() {
      const recipient = await user();
      const event = await db.$transaction((tx) =>
        records.add(
          {
            eventKey: randomUUID(),
            eventType: "PRIVILEGED_ROLE_CHANGED",
            targetUserId: recipient.sub,
            authorizationVersion: 0,
            locale: "bn",
          },
          tx,
        ),
      );
      events.push(event.id);
      return records.delivery(event.id, recipient.sub);
    }
    async function startWorker(failures: number) {
      let calls = 0;
      const processor = new RoleNotificationProcessor(
        records,
        {
          providerName: "controlled",
          sendEmail: async () => ({
            success: ++calls > failures,
            provider: "controlled",
            messageId: "synthetic-provider-acceptance",
          }),
        },
        env,
      );
      worker = new Worker(
        "role-notifications",
        (job) => processor.process(job),
        { connection },
      );
      await worker.waitUntilReady();
      return () => calls;
    }
    beforeAll(async () => {
      db = new PrismaClient({ datasources: { db: { url: database } } });
      await db.$connect();
      hash = await hasher.hash(password);
      const adapter = db as unknown as PrismaService;
      const userRepo = new UserRepository(adapter, {} as never);
      audit = new AuditLogRepository(adapter);
      const tx = new TransactionManager(adapter);
      limiter = new WorkflowRateLimiter(env);
      directory = new DirectoryService(
        new DirectoryRepository(adapter),
        userRepo,
        hasher,
        new RefreshTokenRepository(adapter),
        tx,
        audit,
        limiter,
      );
      communications = new CommunicationsService(
        new CommunicationsRepository(adapter),
        userRepo,
        hasher,
        tx,
        audit,
        limiter,
      );
      records = new RoleNotificationRepository(adapter, audit);
      queue = new Queue("role-notifications", { connection });
      dispatcher = new RoleNotificationDispatcher(records, queue);
      probe = new PlatformProbe(env, new PlatformRepository(adapter));
      // This named fixture was copied from the migration rehearsal. Keep it out
      // of dispatch while retaining the failed delivery used to verify defaults.
      const baseline = await db.roleNotificationOutbox.findUnique({
        where: { eventKey: "adm9-preserved-event" },
      });
      if (baseline) {
        baselineCompletedAt = baseline.completedAt;
        await db.roleNotificationOutbox.update({
          where: { id: baseline.id },
          data: { completedAt: new Date() },
        });
      }
    }, 15000);
    afterEach(async () => {
      jest.restoreAllMocks();
      await worker?.close();
      worker = undefined;
    });
    afterAll(async () => {
      dispatcher?.onModuleDestroy();
      limiter?.onModuleDestroy();
      for (const id of jobs) await (await queue?.getJob(id))?.remove();
      await queue?.close();
      if (!db) return;
      const deliveries = await db.roleNotificationDelivery.findMany({
        where: { outboxId: { in: events } },
        select: { id: true },
      });
      await db.auditLog.deleteMany({
        where: {
          OR: [
            { userId: { in: users } },
            { entityId: { in: deliveries.map((d) => d.id) } },
          ],
        },
      });
      await db.roleNotificationDelivery.deleteMany({
        where: { outboxId: { in: events } },
      });
      await db.roleNotificationOutbox.deleteMany({
        where: { id: { in: events } },
      });
      await db.user.deleteMany({ where: { id: { in: users } } });
      if (baselineCompletedAt !== undefined)
        await db.roleNotificationOutbox.updateMany({
          where: { eventKey: "adm9-preserved-event" },
          data: { completedAt: baselineCompletedAt },
        });
      await db.$disconnect();
    });

    it("serializes concurrent account revocation and invalidates every persisted refresh session atomically", async () => {
      const actor = await user(UserRole.ADMIN),
        other = await user(UserRole.SUPER_ADMIN),
        target = await user();
      for (let i = 0; i < 2; i++)
        await db.refreshToken.create({
          data: {
            userId: target.sub,
            tokenHash: randomUUID(),
            expiresAt: new Date(Date.now() + 60000),
          },
        });
      const input = {
        ...accountConfirmation,
        action: "REVOKE_SESSIONS" as const,
        expectedAuthorizationVersion: 0,
      };
      const results = await Promise.allSettled([
        directory.act(actor, target.sub, input),
        directory.act(other, target.sub, input),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
      expect(
        (await db.user.findUniqueOrThrow({ where: { id: target.sub } }))
          .authorizationVersion,
      ).toBe(1);
      expect(
        await db.refreshToken.count({
          where: { userId: target.sub, revokedAt: null },
        }),
      ).toBe(0);
      expect(
        await db.auditLog.count({
          where: { entityId: target.sub, action: "USER_SESSIONS_REVOKED" },
        }),
      ).toBe(1);
    });
    it("rolls account status, authorization version and refresh revocation back when the atomic audit fails", async () => {
      const actor = await user(UserRole.ADMIN),
        target = await user();
      const token = await db.refreshToken.create({
        data: {
          userId: target.sub,
          tokenHash: randomUUID(),
          expiresAt: new Date(Date.now() + 60000),
        },
      });
      jest
        .spyOn(audit, "record")
        .mockRejectedValueOnce(new Error("Synthetic audit failure"));
      await expect(
        directory.act(actor, target.sub, {
          ...accountConfirmation,
          action: "SUSPEND",
          expectedAuthorizationVersion: 0,
        }),
      ).rejects.toThrow("Synthetic audit failure");
      expect(
        await db.user.findUniqueOrThrow({ where: { id: target.sub } }),
      ).toMatchObject({ status: "ACTIVE", authorizationVersion: 0 });
      expect(
        (await db.refreshToken.findUniqueOrThrow({ where: { id: token.id } }))
          .revokedAt,
      ).toBeNull();
      expect(await db.auditLog.count({ where: { entityId: target.sub } })).toBe(
        0,
      );
    });
    it("denies self, administrative targets and a demoted actor with stale claims", async () => {
      const actor = await user(UserRole.ADMIN),
        target = await user(UserRole.SUPER_ADMIN);
      const input = {
        ...accountConfirmation,
        action: "SUSPEND" as const,
        expectedAuthorizationVersion: 0,
      };
      await expect(
        directory.act(actor, actor.sub, input),
      ).rejects.toMatchObject({ errorCode: "ACCOUNT_ACTION_FORBIDDEN" });
      await expect(
        directory.act(actor, target.sub, input),
      ).rejects.toMatchObject({ errorCode: "ACCOUNT_ACTION_FORBIDDEN" });
      await db.user.update({
        where: { id: actor.sub },
        data: { role: "LEARNER", authorizationVersion: { increment: 1 } },
      });
      await expect(
        directory.list(actor, "users", { limit: 20 }),
      ).rejects.toMatchObject({ statusCode: 403 });
      expect(
        (await db.user.findUniqueOrThrow({ where: { id: target.sub } })).status,
      ).toBe("ACTIVE");
    });
    it("observes real Redis queues and a registered worker without claiming external delivery", async () => {
      await startWorker(0);
      const result = await probe.system();
      expect(result.database).toBe("UP");
      expect(result.redis).toBe("UP");
      expect(result.queues.every((q) => q.status === "OBSERVED")).toBe(true);
      // The ADM8 contract fixes eight domain queues; durable role-email counts
      // are separate. Inspect the standalone worker directly without changing it.
      expect(await queue.getWorkersCount()).toBeGreaterThanOrEqual(1);
      expect(JSON.stringify(result)).not.toMatch(
        /postgresql:|redis:|password|example.test/,
      );
    });
    it("retains the failed legacy job, commits a confirmed retry and processes the new generation after worker restart", async () => {
      const actor = await user(UserRole.ADMIN),
        delivery = await notification();
      const legacyId = `role-mail-${delivery.id}`;
      jobs.push(legacyId);
      const firstCalls = await startWorker(1);
      const legacy = await queue.add(
        "role-email",
        { deliveryId: delivery.id },
        { jobId: legacyId, attempts: 1, removeOnFail: false },
      );
      await until(async () => (await legacy.getState()) === "failed");
      expect(
        (
          await db.roleNotificationDelivery.findUniqueOrThrow({
            where: { id: delivery.id },
          })
        ).status,
      ).toBe("FAILED");
      await worker!.close();
      worker = undefined;
      await communications.retry(actor, delivery.id, {
        ...confirmation,
        expectedGeneration: 0,
      });
      await records.sent(delivery.id, "obsolete-completion", 0);
      expect(
        await db.roleNotificationDelivery.findUniqueOrThrow({
          where: { id: delivery.id },
        }),
      ).toMatchObject({ status: "PENDING", retryGeneration: 1, sentAt: null });
      await dispatcher.dispatch();
      const retryId = `${legacyId}-1`;
      jobs.push(retryId);
      expect(await queue.getJob(retryId)).not.toBeNull();
      expect(await legacy.getState()).toBe("failed");
      const secondCalls = await startWorker(0);
      await until(
        async () =>
          (
            await db.roleNotificationDelivery.findUniqueOrThrow({
              where: { id: delivery.id },
            })
          ).status === "SENT",
      );
      expect(firstCalls()).toBe(1);
      expect(secondCalls()).toBe(1);
      expect(
        await db.auditLog.count({
          where: {
            entityId: delivery.id,
            action: "ROLE_EMAIL_RETRY_REQUESTED",
          },
        }),
      ).toBe(1);
      expect(
        await db.auditLog.count({
          where: { entityId: delivery.id, action: "ROLE_EMAIL_ACCEPTED" },
        }),
      ).toBe(1);
      await db.roleNotificationOutbox.update({
        where: { id: delivery.outboxId },
        data: { availableAt: new Date(), leaseUntil: null },
      });
      await dispatcher.dispatch();
      expect(
        (
          await db.roleNotificationOutbox.findUniqueOrThrow({
            where: { id: delivery.outboxId },
          })
        ).completedAt,
      ).not.toBeNull();
      expect(secondCalls()).toBe(1);
    }, 20000);
    it("executes a BullMQ transient retry and persists one provider acceptance", async () => {
      const delivery = await notification(),
        id = `role-mail-${delivery.id}`;
      jobs.push(id);
      const calls = await startWorker(1);
      const job = await queue.add(
        "role-email",
        { deliveryId: delivery.id, generation: 0 },
        { jobId: id, attempts: 2, backoff: { type: "fixed", delay: 30 } },
      );
      await until(async () => (await job.getState()) === "completed");
      expect(calls()).toBe(2);
      expect(
        await db.roleNotificationDelivery.findUniqueOrThrow({
          where: { id: delivery.id },
        }),
      ).toMatchObject({ status: "SENT", attempts: 1, retryGeneration: 0 });
      expect(
        await db.auditLog.count({
          where: { entityId: delivery.id, action: "ROLE_EMAIL_ACCEPTED" },
        }),
      ).toBe(1);
    }, 20000);
  },
);
