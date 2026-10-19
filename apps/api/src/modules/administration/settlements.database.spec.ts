import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { JwtPayload, UserRole } from "@vetralink/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { UserRepository } from "../users/repositories/user.repository";
import { BcryptPasswordHasher } from "../auth/services/bcrypt-password-hasher.service";
import { AuditLogRepository } from "../audit/repositories/audit-log.repository";
import { TransactionManager } from "../prisma/transaction/transaction.manager";
import { AdminSettlementsRepository } from "./settlements.repository";
import { AdminSettlementsService } from "./settlements.service";
import { VetPayoutLedgerService } from "../consultations/services/vet-payout-ledger.service";
import { PayoutLedgerRepository } from "../consultations/repositories/payout-ledger.repository";
const url = process.env.SETTLEMENT_TEST_DATABASE_URL;
if (
  url &&
  (!["127.0.0.1", "localhost"].includes(new URL(url).hostname) ||
    new URL(url).pathname !== "/adm6_test")
)
  throw Error("Explicit loopback disposable adm6_test required");
(url ? describe : describe.skip)(
  "Administrative settlements real PostgreSQL",
  () => {
    let db: PrismaClient,
      service: AdminSettlementsService,
      legacy: VetPayoutLedgerService,
      audit: AuditLogRepository,
      claims: JwtPayload,
      vetId: string,
      farmerId: string,
      farmId: string,
      id: string;
    const userIds: string[] = [],
      ids: string[] = [],
      consultationIds: string[] = [];
    const password = "Synthetic settlement password!";
    const hasher = new BcryptPasswordHasher();
    const confirmation = (revision: string) => ({
      expectedRevision: revision,
      reason: "Checked external payment reference",
      actorPassword: password,
      payoutReference: "EXTERNAL-REFERENCE",
    });
    async function fixture(
      currency = "BDT",
      status: "PENDING" | "HELD" | "PAID" = "PENDING",
    ) {
      const c = await db.consultation.create({
        data: {
          farmerId,
          vetId,
          farmId,
          chiefComplaint: "PRIVATE CLINICAL CONTENT",
          status: "COMPLETED",
          paymentStatus: "CAPTURED",
          feeCents: 2999,
          currency,
          paymentIntentId: "PRIVATE_PROVIDER",
        },
      });
      consultationIds.push(c.id);
      const row = await db.consultationPayoutLedger.create({
        data: {
          consultationId: c.id,
          vetId,
          totalFeeCents: 2999,
          platformFeeRate: 0.2,
          platformFeeCents: 600,
          vetPayoutCents: 2399,
          currency,
          status,
          metadata: { secret: "PRIVATE_METADATA" },
        },
      });
      ids.push(row.id);
      return row.id;
    }
    beforeAll(async () => {
      db = new PrismaClient({ datasources: { db: { url } } });
      const adapter = db as unknown as PrismaService;
      const hash = await hasher.hash(password);
      for (const role of ["ADMIN", "VET", "FARMER"] as const) {
        const u = await db.user.create({
          data: {
            name: `Synthetic settlement ${role}`,
            email: `${randomUUID()}@settlement.example.test`,
            role,
            passwordHash: hash,
          },
        });
        userIds.push(u.id);
      }
      claims = {
        sub: userIds[0],
        role: UserRole.ADMIN,
        authorizationVersion: 0,
      } as JwtPayload;
      vetId = userIds[1];
      farmerId = userIds[2];
      farmId = (
        await db.farm.create({
          data: {
            ownerId: farmerId,
            name: "Synthetic settlement farm",
            slug: `settlements-${randomUUID()}`,
            country: "BD",
          },
        })
      ).id;
      audit = new AuditLogRepository(adapter);
      service = new AdminSettlementsService(
        new AdminSettlementsRepository(adapter),
        new UserRepository(adapter, {} as never),
        hasher,
        new TransactionManager(adapter),
        audit,
        { hit: async () => undefined } as never,
      );
      legacy = new VetPayoutLedgerService(
        new PayoutLedgerRepository(adapter),
        {
          findById: async (cid: string) =>
            await db.consultation.findUnique({ where: { id: cid } }),
        } as never,
        audit,
        new TransactionManager(adapter),
      );
    });
    beforeEach(async () => {
      await db.user.update({
        where: { id: claims.sub },
        data: { role: "ADMIN", status: "ACTIVE", authorizationVersion: 0 },
      });
      id = await fixture();
    });
    afterAll(async () => {
      if (!db) return;
      await db.auditLog.deleteMany({
        where: { OR: [{ userId: { in: userIds } }, { entityId: { in: ids } }] },
      });
      await db.consultationPayoutLedger.deleteMany({
        where: { id: { in: ids } },
      });
      await db.consultation.deleteMany({
        where: { id: { in: consultationIds } },
      });
      await db.farm.delete({ where: { id: farmId } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
      await db.$disconnect();
    });
    it("projects immutable preview and read-only detail without clinical/provider/private data or audit", async () => {
      const before = await db.consultationPayoutLedger.findUniqueOrThrow({
          where: { id },
        }),
        row = await service.detail(claims, id),
        preview = await service.preview(claims, id);
      expect(preview).toMatchObject({
        totalFeeCents: 2999,
        platformFeeCents: 600,
        vetPayoutCents: 2399,
        currency: "BDT",
        matchesStoredSplit: true,
      });
      expect(row.canReconcile).toBe(true);
      expect(JSON.stringify(row)).not.toMatch(/PRIVATE_|email|phone/);
      expect(await db.auditLog.count({ where: { entityId: id } })).toBe(0);
      expect(
        await db.consultationPayoutLedger.findUniqueOrThrow({ where: { id } }),
      ).toEqual(before);
    });
    it("groups currency totals with bounded filtered aggregate and never labels mixed legacy totals as one currency", async () => {
      await fixture("USD");
      const summary = await service.summary(claims, { vetId });
      expect(summary.items.map((r) => r.currency)).toEqual(["BDT", "USD"]);
      expect(summary.items.find((r) => r.currency === "USD")).toMatchObject({
        totalGrossCents: 2999,
        pendingPayoutCents: 2399,
      });
      await expect(legacy.getVetEarningsSummary(vetId)).rejects.toThrow();
      await expect(legacy.getPlatformRevenueSummary()).rejects.toThrow();
    });
    it("reconciles once locally, preserves financial snapshot and rejects stale replay", async () => {
      const row = await service.detail(claims, id),
        before = await db.consultationPayoutLedger.findUniqueOrThrow({
          where: { id },
        });
      const paid = await service.reconcile(
        claims,
        id,
        confirmation(row.revision),
      );
      expect(paid.status).toBe("PAID");
      const after = await db.consultationPayoutLedger.findUniqueOrThrow({
        where: { id },
      });
      for (const field of [
        "totalFeeCents",
        "platformFeeRate",
        "platformFeeCents",
        "vetPayoutCents",
        "currency",
        "metadata",
      ] as const)
        expect(after[field]).toEqual(before[field]);
      await expect(
        service.reconcile(claims, id, confirmation(row.revision)),
      ).rejects.toMatchObject({ errorCode: "SETTLEMENT_VERSION_CONFLICT" });
      expect(await db.auditLog.count({ where: { entityId: id } })).toBe(1);
    });
    it("invalidates displayed revision when related consultation changes", async () => {
      const row = await service.detail(claims, id);
      await db.consultation.update({
        where: { id: row.consultationId },
        data: { paymentStatus: "RELEASED" },
      });
      await expect(
        service.reconcile(claims, id, confirmation(row.revision)),
      ).rejects.toMatchObject({ errorCode: "SETTLEMENT_VERSION_CONFLICT" });
    });
    it.each(["HELD", "PAID", "REVERSED", "mismatch", "consultation"] as const)(
      "makes %s records unavailable",
      async (mode) => {
        if (mode === "mismatch")
          await db.consultationPayoutLedger.update({
            where: { id },
            data: { platformFeeCents: 599 },
          });
        else if (mode === "consultation") {
          const l = await db.consultationPayoutLedger.findUniqueOrThrow({
            where: { id },
          });
          await db.consultation.update({
            where: { id: l.consultationId },
            data: { status: "CANCELLED" },
          });
        } else
          await db.consultationPayoutLedger.update({
            where: { id },
            data: { status: mode },
          });
        const row = await service.detail(claims, id);
        expect(row.canReconcile).toBe(false);
        await expect(
          service.reconcile(claims, id, confirmation(row.revision)),
        ).rejects.toMatchObject({ errorCode: "SETTLEMENT_ACTION_UNAVAILABLE" });
      },
    );
    it("rolls back entire bulk including audit when one row is unavailable", async () => {
      const second = await fixture("BDT", "HELD");
      const rows = await Promise.all(
        [id, second].map((i) => service.detail(claims, i)),
      );
      const { expectedRevision, ...base } = confirmation(rows[0].revision);
      await expect(
        service.bulk(claims, {
          ...base,
          items: rows.map((r) => ({ id: r.id, expectedRevision: r.revision })),
          vetId,
          currency: "BDT",
        }),
      ).rejects.toMatchObject({ errorCode: "SETTLEMENT_ACTION_UNAVAILABLE" });
      expect((await service.detail(claims, id)).status).toBe("PENDING");
      expect(
        await db.auditLog.count({ where: { entityId: { in: [id, second] } } }),
      ).toBe(0);
    });
    it("rolls back mutation on administrative audit failure", async () => {
      const row = await service.detail(claims, id),
        spy = jest
          .spyOn(audit, "record")
          .mockRejectedValueOnce(Error("Synthetic audit failure"));
      await expect(
        service.reconcile(claims, id, confirmation(row.revision)),
      ).rejects.toThrow("Synthetic audit failure");
      spy.mockRestore();
      expect((await service.detail(claims, id)).revision).toBe(row.revision);
    });
    it("serializes concurrent single and bulk requests with one audit", async () => {
      const row = await service.detail(claims, id),
        { expectedRevision, ...base } = confirmation(row.revision);
      const results = await Promise.allSettled([
        service.reconcile(claims, id, confirmation(row.revision)),
        service.bulk(claims, {
          ...base,
          vetId,
          currency: "BDT",
          items: [{ id, expectedRevision }],
        }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await db.auditLog.count({ where: { entityId: id } })).toBe(1);
    });
    it("legacy audit failure must roll back its local status", async () => {
      const spy = jest
        .spyOn(audit, "record")
        .mockRejectedValueOnce(Error("Synthetic legacy audit failure"));
      await expect(
        legacy.processPayout(id, { payoutReference: "LEGACY-REF" }, claims.sub),
      ).rejects.toThrow("Synthetic legacy audit failure");
      spy.mockRestore();
      expect((await service.detail(claims, id)).status).toBe("PENDING");
    });
    it("serializes legacy and new reconciliation with one local write and no lost metadata", async () => {
      const row = await service.detail(claims, id);
      const result = await Promise.allSettled([
        legacy.processPayout(id, { payoutReference: "LEGACY-REF" }, claims.sub),
        service.reconcile(claims, id, confirmation(row.revision)),
      ]);
      expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(await db.auditLog.count({ where: { entityId: id } })).toBe(1);
      expect(
        (await db.consultationPayoutLedger.findUniqueOrThrow({ where: { id } }))
          .metadata,
      ).toEqual({ secret: "PRIVATE_METADATA" });
    });
    it("denies bad password, stale role and authorization version", async () => {
      const row = await service.detail(claims, id);
      await expect(
        service.reconcile(claims, id, {
          ...confirmation(row.revision),
          actorPassword: "wrong",
        }),
      ).rejects.toMatchObject({ errorCode: "PASSWORD_CONFIRMATION_FAILED" });
      await db.user.update({
        where: { id: claims.sub },
        data: { role: "LEARNER" },
      });
      await expect(service.list(claims, { limit: 20 })).rejects.toThrow();
      await db.user.update({
        where: { id: claims.sub },
        data: { role: "ADMIN", authorizationVersion: 1 },
      });
      await expect(
        service.reconcile(claims, id, confirmation(row.revision)),
      ).rejects.toThrow();
    });
    it("preserves an existing processing batch on omission and records the actual retained value", async () => {
      await db.consultationPayoutLedger.update({
        where: { id },
        data: { status: "PROCESSING", payoutBatchId: "EXISTING-BATCH" },
      });
      const row = await service.detail(claims, id);
      const paid = await service.reconcile(
        claims,
        id,
        confirmation(row.revision),
      );
      expect(paid.payoutBatchId).toBe("EXISTING-BATCH");
      const event = await db.auditLog.findFirstOrThrow({
        where: { entityId: id, action: "ADMIN_SETTLEMENT_RECONCILED" },
      });
      expect(event.newValues).toMatchObject({
        payoutBatchId: "EXISTING-BATCH",
      });
    });
    it("replaces an existing batch when a new batch is supplied", async () => {
      await db.consultationPayoutLedger.update({
        where: { id },
        data: { status: "PROCESSING", payoutBatchId: "OLD-BATCH" },
      });
      const row = await service.detail(claims, id);
      expect(
        (
          await service.reconcile(claims, id, {
            ...confirmation(row.revision),
            payoutBatchId: "NEW-BATCH",
          })
        ).payoutBatchId,
      ).toBe("NEW-BATCH");
    });
    it("rolls back every legacy bulk row when the second audit fails", async () => {
      const second = await fixture();
      let calls = 0;
      const original = audit.record.bind(audit);
      const spy = jest
        .spyOn(audit, "record")
        .mockImplementation(async (...args) => {
          if (++calls === 2) throw Error("Synthetic second audit failure");
          return original(...args);
        });
      try {
        await expect(
          legacy.bulkProcessPayouts(
            vetId,
            [id, second],
            { payoutReference: "LEGACY-BULK" },
            claims.sub,
          ),
        ).rejects.toThrow("Synthetic second audit failure");
      } finally {
        spy.mockRestore();
      }
      expect((await service.detail(claims, id)).status).toBe("PENDING");
      expect((await service.detail(claims, second)).status).toBe("PENDING");
      expect(
        await db.auditLog.count({ where: { entityId: { in: [id, second] } } }),
      ).toBe(0);
    });
    it("rolls back capture-triggered creation when its audit fails", async () => {
      const row = await db.consultationPayoutLedger.findUniqueOrThrow({
        where: { id },
      });
      await db.consultationPayoutLedger.delete({ where: { id } });
      const spy = jest
        .spyOn(audit, "record")
        .mockRejectedValueOnce(Error("Synthetic capture audit failure"));
      try {
        await expect(
          legacy.recordConsultationSettlement(row.consultationId),
        ).rejects.toThrow("Synthetic capture audit failure");
      } finally {
        spy.mockRestore();
      }
      expect(
        await db.consultationPayoutLedger.count({
          where: { consultationId: row.consultationId },
        }),
      ).toBe(0);
    });
  },
);
