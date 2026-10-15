import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { JwtPayload, UserRole } from "@vetralink/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { UserRepository } from "../users/repositories/user.repository";
import { BcryptPasswordHasher } from "../auth/services/bcrypt-password-hasher.service";
import { AuditLogRepository } from "../audit/repositories/audit-log.repository";
import { TransactionManager } from "../prisma/transaction/transaction.manager";
import { BillingRepository } from "./billing.repository";
import { BillingService } from "./billing.service";
const url = process.env.BILLING_TEST_DATABASE_URL;
if (
  url &&
  (!["127.0.0.1", "localhost"].includes(new URL(url).hostname) ||
    !new URL(url).pathname.endsWith("/adm4_test"))
)
  throw new Error("Explicit loopback disposable adm4_test required");
(url ? describe : describe.skip)(
  "Administrative billing real PostgreSQL",
  () => {
    let db: PrismaClient,
      repo: BillingRepository,
      service: BillingService,
      audit: AuditLogRepository,
      claims: JwtPayload,
      ownerId: string,
      planId: string,
      productId: string,
      orderId: string,
      subId: string,
      passwordHash: string;
    const password = "Synthetic billing password!",
      subIds: string[] = [],
      orderIds: string[] = [];
    const hasher = new BcryptPasswordHasher();
    beforeAll(async () => {
      db = new PrismaClient({ datasources: { db: { url } } });
      const adapter = db as unknown as PrismaService;
      passwordHash = await hasher.hash(password);
      const admin = await db.user.create({
        data: {
          name: "Synthetic billing admin",
          email: `${randomUUID()}@billing.example.test`,
          role: "ADMIN",
          passwordHash,
        },
      });
      const owner = await db.user.create({
        data: {
          name: "Synthetic billing owner",
          email: `${randomUUID()}@billing.example.test`,
          role: "LEARNER",
          passwordHash,
        },
      });
      ownerId = owner.id;
      claims = {
        sub: admin.id,
        role: UserRole.ADMIN,
        authorizationVersion: 0,
      } as JwtPayload;
      const plan = await db.subscriptionPlan.create({
        data: {
          name: "Synthetic billing plan",
          tier: "PRO",
          priceMonthlyCents: 1200,
          priceAnnualCents: 12000,
          maxAnimals: 30,
          features: { preserve: "existing feature" },
        },
      });
      planId = plan.id;
      productId = (
        await db.product.create({
          data: {
            title: "Synthetic immutable guide",
            slug: `billing-${randomUUID()}`,
            type: "EBOOK",
            description: "Synthetic fixture only",
            priceCents: 1200,
            contentS3Key: "private/fixture.pdf",
          },
        })
      ).id;
      repo = new BillingRepository(adapter);
      audit = new AuditLogRepository(adapter);
      service = new BillingService(
        repo,
        new UserRepository(adapter, {} as never),
        hasher,
        new TransactionManager(adapter),
        audit,
        { hit: async () => undefined } as never,
      );
    });
    beforeEach(async () => {
      await db.user.update({
        where: { id: claims.sub },
        data: { role: "ADMIN", status: "ACTIVE", authorizationVersion: 0 },
      });
      await db.user.update({
        where: { id: ownerId },
        data: { deletedAt: null },
      });
      const row = await db.subscription.create({
        data: {
          userId: ownerId,
          planId,
          status: "ACTIVE",
          currentPeriodStart: new Date(Date.now() - 86400000),
          currentPeriodEnd: new Date(Date.now() + 86400000 * 10),
        },
      });
      subId = row.id;
      subIds.push(subId);
      const order = await db.order.create({
        data: {
          userId: ownerId,
          totalCents: 1200,
          currency: "USD",
          status: "COMPLETED",
          paymentGateway: "STRIPE",
          gatewayTxId: `secret-provider-${randomUUID()}`,
          items: { create: { productId, priceCents: 1200, downloadCount: 2 } },
        },
      });
      orderId = order.id;
      orderIds.push(orderId);
    });
    afterAll(async () => {
      if (!db) return;
      await db.auditLog.deleteMany({ where: { userId: claims.sub } });
      await db.subscriptionDunningLog.deleteMany({
        where: { subscriptionId: { in: subIds } },
      });
      await db.subscription.deleteMany({ where: { id: { in: subIds } } });
      await db.orderItem.deleteMany({ where: { orderId: { in: orderIds } } });
      await db.order.deleteMany({ where: { id: { in: orderIds } } });
      await db.product.delete({ where: { id: productId } });
      await db.subscriptionPlan.delete({ where: { id: planId } });
      await db.user.deleteMany({
        where: { id: { in: [claims.sub, ownerId] } },
      });
      await db.$disconnect();
    });
    async function subscription() {
      const row = await service.detail(claims, "subscriptions", subId);
      if (row.kind !== "subscriptions") throw Error("Wrong kind");
      return row;
    }
    const input = (
      revision: string,
      action:
        | "SCHEDULE_CANCELLATION"
        | "REVOKE_CANCELLATION" = "SCHEDULE_CANCELLATION",
    ) => ({
      expectedRevision: revision,
      action,
      reason: "Reviewed synthetic support request",
      actorPassword: password,
    });
    it("preserves order snapshots and omits tokens, private keys and provider references", async () => {
      const before = await db.orderItem.findFirstOrThrow({
        where: { orderId },
      });
      const row = await service.detail(claims, "orders", orderId);
      expect(row.kind).toBe("orders");
      const text = JSON.stringify(row);
      expect(text).not.toContain(before.downloadToken);
      expect(text).not.toContain("secret-provider");
      expect(text).not.toContain("private/fixture.pdf");
      expect(
        (await db.orderItem.findUniqueOrThrow({ where: { id: before.id } }))
          .downloadCount,
      ).toBe(2);
      expect(
        (await db.order.findUniqueOrThrow({ where: { id: orderId } }))
          .totalCents,
      ).toBe(1200);
    });
    it("redacts deleted owner names while retaining financial records", async () => {
      await db.user.update({
        where: { id: ownerId },
        data: { deletedAt: new Date() },
      });
      const row = await service.detail(claims, "orders", orderId);
      expect("owner" in row && row.owner).toBeNull();
      expect(
        (
          await service.list(claims, "orders", {
            limit: 100,
            search: "Synthetic billing owner",
          })
        ).items,
      ).toHaveLength(0);
    });
    it("paginates bounded lists and handles malformed UUID-shaped search safely", async () => {
      const first = await service.list(claims, "orders", { limit: 1 });
      expect(first.items).toHaveLength(1);
      if (first.nextCursor) {
        const next = await service.list(claims, "orders", {
          limit: 1,
          cursor: first.nextCursor,
        });
        expect(next.items.every((row) => row.id !== first.items[0].id)).toBe(
          true,
        );
      }
      expect(
        (
          await service.list(claims, "orders", {
            limit: 10,
            search: "-".repeat(36),
          })
        ).items,
      ).toHaveLength(0);
    });
    it("returns safe reminder history without recipient, body, error or invoice data", async () => {
      const log = await db.subscriptionDunningLog.create({
        data: {
          subscriptionId: subId,
          userId: ownerId,
          stage: "DAY_1",
          status: "FAILED",
          channel: "EMAIL",
          recipientEmail: "private@example.test",
          subject: "PRIVATE SUBJECT",
          message: "PRIVATE BODY",
          errorMessage: "PRIVATE ERROR",
          gatewayInvoiceId: "PRIVATE INVOICE",
          dispatchedDate: "2026-10-16",
        },
      });
      const row = await service.detail(claims, "dunning", log.id),
        text = JSON.stringify(row);
      for (const value of [
        "private@example.test",
        "PRIVATE SUBJECT",
        "PRIVATE BODY",
        "PRIVATE ERROR",
        "PRIVATE INVOICE",
      ])
        expect(text).not.toContain(value);
      expect(row.kind === "dunning" && row.status).toBe("FAILED");
      expect(
        (
          await service.list(claims, "dunning", {
            limit: 10,
            subscriptionId: subId,
          })
        ).items,
      ).toHaveLength(1);
    });
    it("changes cancellation once, rejects repeat/stale input and can revoke with the new revision", async () => {
      const before = await subscription();
      await service.action(claims, subId, input(before.revision));
      await expect(
        service.action(claims, subId, input(before.revision)),
      ).rejects.toMatchObject({ errorCode: "BILLING_VERSION_CONFLICT" });
      expect(
        await db.auditLog.count({
          where: {
            entityId: subId,
            action: "SUBSCRIPTION_CANCELLATION_SCHEDULED",
          },
        }),
      ).toBe(1);
      const after = await subscription();
      expect(after.cancelAtPeriodEnd).toBe(true);
      expect(after.revision).not.toBe(before.revision);
      await service.action(
        claims,
        subId,
        input(after.revision, "REVOKE_CANCELLATION"),
      );
      expect((await subscription()).cancelAtPeriodEnd).toBe(false);
    });
    it("serializes concurrent support writes", async () => {
      const row = await subscription();
      const results = await Promise.allSettled([
        service.action(claims, subId, input(row.revision)),
        service.action(claims, subId, input(row.revision)),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await db.auditLog.count({ where: { entityId: subId } })).toBe(1);
    });
    it.each(["provider", "expired", "terminal"])(
      "keeps %s subscription support read-only",
      async (mode) => {
        await db.subscription.update({
          where: { id: subId },
          data:
            mode === "provider"
              ? { gatewaySubId: `sub-${randomUUID()}` }
              : mode === "expired"
                ? { currentPeriodEnd: new Date(Date.now() - 86400000) }
                : { status: "CANCELED" },
        });
        const row = await subscription();
        expect(row.allowedActions).toEqual([]);
        await expect(
          service.action(claims, subId, input(row.revision)),
        ).rejects.toMatchObject({ errorCode: "BILLING_ACTION_UNAVAILABLE" });
        expect(await db.auditLog.count({ where: { entityId: subId } })).toBe(0);
      },
    );
    it("rolls back cancellation and revision when audit fails, permitting a safe retry", async () => {
      const row = await subscription(),
        spy = jest
          .spyOn(audit, "record")
          .mockRejectedValueOnce(new Error("Synthetic audit failure"));
      await expect(
        service.action(claims, subId, input(row.revision)),
      ).rejects.toThrow("Synthetic audit failure");
      spy.mockRestore();
      const restored = await subscription();
      expect(restored.cancelAtPeriodEnd).toBe(false);
      expect(restored.revision).toBe(row.revision);
      await service.action(claims, subId, input(row.revision));
    });
    it("edits local plan prices/limits atomically without overwriting existing features", async () => {
      const row = await service.detail(claims, "plans", planId);
      if (row.kind !== "plans") throw Error("Wrong kind");
      const change = {
        expectedRevision: row.revision,
        name: "Synthetic updated plan",
        priceMonthlyCents: 1350,
        priceAnnualCents: 13000,
        maxAnimals: 45,
        isActive: true,
        reason: "Reviewed synthetic plan catalogue",
        actorPassword: password,
      };
      const result = await service.editPlan(claims, planId, change);
      expect(result?.kind === "plans" && result.priceMonthlyCents).toBe(1350);
      expect(
        (await db.subscriptionPlan.findUniqueOrThrow({ where: { id: planId } }))
          .features,
      ).toEqual({ preserve: "existing feature" });
      await expect(
        service.editPlan(claims, planId, change),
      ).rejects.toMatchObject({ errorCode: "BILLING_VERSION_CONFLICT" });
      const events = await db.auditLog.findMany({
        where: { entityId: planId },
      });
      expect(JSON.stringify(events)).not.toContain(password);
    });
    it("detects legacy writers that do not know about admin revisions", async () => {
      const before = await subscription();
      await db.subscription.update({
        where: { id: subId },
        data: { cancelAtPeriodEnd: true },
      });
      await expect(
        service.action(claims, subId, input(before.revision)),
      ).rejects.toMatchObject({ errorCode: "BILLING_VERSION_CONFLICT" });
    });
    it("denies stale administrative roles, bad passwords and revoked versions without mutation", async () => {
      const row = await subscription();
      await expect(
        service.action(claims, subId, {
          ...input(row.revision),
          actorPassword: "wrong",
        }),
      ).rejects.toMatchObject({ errorCode: "PASSWORD_CONFIRMATION_FAILED" });
      await db.user.update({
        where: { id: claims.sub },
        data: { role: "LEARNER" },
      });
      await expect(
        service.list(claims, "orders", { limit: 20 }),
      ).rejects.toThrow();
      await db.user.update({
        where: { id: claims.sub },
        data: { role: "ADMIN", authorizationVersion: 1 },
      });
      await expect(
        service.action(claims, subId, input(row.revision)),
      ).rejects.toThrow();
      expect(
        (await db.subscription.findUniqueOrThrow({ where: { id: subId } }))
          .cancelAtPeriodEnd,
      ).toBe(false);
    });
  },
);
