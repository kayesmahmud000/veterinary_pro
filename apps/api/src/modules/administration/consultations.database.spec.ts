import { randomUUID } from "crypto";
import { PrismaClient, Prisma } from "@prisma/client";
import { JwtPayload, UserRole } from "@vetralink/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { UserRepository } from "../users/repositories/user.repository";
import { BcryptPasswordHasher } from "../auth/services/bcrypt-password-hasher.service";
import { AuditLogRepository } from "../audit/repositories/audit-log.repository";
import { TransactionManager } from "../prisma/transaction/transaction.manager";
import { AdminConsultationsRepository } from "./consultations.repository";
import { ConsultationRepository } from "../consultations/repositories/consultation.repository";
import { AdminConsultationsService } from "./consultations.service";

const url = process.env.CONSULTATION_TEST_DATABASE_URL;
if (
  url &&
  (!["127.0.0.1", "localhost"].includes(new URL(url).hostname) ||
    new URL(url).pathname !== "/adm5_test")
) {
  throw new Error("Explicit loopback disposable adm5_test required");
}
(url ? describe : describe.skip)(
  "Administrative consultations real PostgreSQL",
  () => {
    let db: PrismaClient,
      repo: AdminConsultationsRepository,
      service: AdminConsultationsService,
      audit: AuditLogRepository;
    let claims: JwtPayload,
      otherClaims: JwtPayload,
      ownerId: string,
      farmId: string,
      vetId: string,
      otherVetId: string,
      id: string;
    const password = "Synthetic consultation password!";
    const users: string[] = [],
      cases: string[] = [],
      animals: string[] = [];
    const hasher = new BcryptPasswordHasher();
    const profile = {
      isAvailable: true,
      maxActiveCases: 1,
      specialties: ["CATTLE"],
      workingHours: [{ dayOfWeek: 5, startTime: "09:00", endTime: "17:00" }],
      timezone: "Asia/Dhaka",
    };
    let passwordHash: string;
    async function user(
      role: "ADMIN" | "SUPER_ADMIN" | "FARMER" | "VET",
      name = `Synthetic ${role}`,
    ) {
      const row = await db.user.create({
        data: {
          role,
          name,
          email: `${randomUUID()}@adm5.example.test`,
          passwordHash,
        },
      });
      users.push(row.id);
      return row.id;
    }
    async function consultation(
      data: Partial<Prisma.ConsultationUncheckedCreateInput> = {},
    ) {
      const row = await db.consultation.create({
        data: {
          farmerId: ownerId,
          farmId,
          chiefComplaint: "Synthetic complaint",
          feeCents: 1234,
          currency: "USD",
          ...data,
        },
      });
      cases.push(row.id);
      return row.id;
    }
    const action = (
      revision: string,
      kind: "ASSIGN" | "AUTO_ASSIGN" | "CANCEL" = "ASSIGN",
      target = vetId,
    ) =>
      kind === "ASSIGN"
        ? {
            action: kind,
            vetId: target,
            expectedRevision: revision,
            reason: "Reviewed synthetic operation",
            actorPassword: password,
          }
        : {
            action: kind,
            expectedRevision: revision,
            reason: "Reviewed synthetic operation",
            actorPassword: password,
          };
    beforeAll(async () => {
      db = new PrismaClient({ datasources: { db: { url } } });
      const adapter = db as unknown as PrismaService;
      passwordHash = await hasher.hash(password);
      claims = {
        sub: await user("ADMIN"),
        role: UserRole.ADMIN,
        authorizationVersion: 0,
      } as JwtPayload;
      otherClaims = {
        sub: await user("SUPER_ADMIN"),
        role: UserRole.SUPER_ADMIN,
        authorizationVersion: 0,
      } as JwtPayload;
      ownerId = await user("FARMER");
      vetId = await user("VET");
      otherVetId = await user("VET");
      farmId = (
        await db.farm.create({
          data: {
            ownerId,
            name: "Synthetic ADM5 farm",
            slug: `adm5-${randomUUID()}`,
            country: "Bangladesh",
          },
        })
      ).id;
      for (const userId of [vetId, otherVetId])
        await db.vetProfile.create({ data: { userId, ...profile } });
      repo = new AdminConsultationsRepository(adapter);
      audit = new AuditLogRepository(adapter);
      service = new AdminConsultationsService(
        repo,
        new UserRepository(adapter, {} as never),
        hasher,
        new TransactionManager(adapter),
        audit,
        { hit: async () => undefined } as never,
      );
    });
    beforeEach(async () => {
      if (cases.length)
        await db.consultation.updateMany({
          where: { id: { in: cases } },
          data: { status: "CANCELLED" },
        });
      for (const userId of [vetId, otherVetId]) {
        await db.user.update({
          where: { id: userId },
          data: { status: "ACTIVE", deletedAt: null, role: "VET" },
        });
        await db.vetProfile.upsert({
          where: { userId },
          create: { userId, ...profile },
          update: profile,
        });
      }
      for (const userId of [claims.sub, otherClaims.sub])
        await db.user.update({
          where: { id: userId },
          data: { status: "ACTIVE", authorizationVersion: 0, passwordHash },
        });
      await db.user.update({
        where: { id: ownerId },
        data: { deletedAt: null },
      });
      id = await consultation();
    });
    afterAll(async () => {
      if (!db) return;
      await db.auditLog.deleteMany({ where: { entityId: { in: cases } } });
      await db.consultationNotificationLog.deleteMany({
        where: { consultationId: { in: cases } },
      });
      await db.consultation.deleteMany({ where: { id: { in: cases } } });
      await db.animal.deleteMany({ where: { id: { in: animals } } });
      if (farmId) await db.farm.delete({ where: { id: farmId } });
      await db.vetProfile.deleteMany({ where: { userId: { in: users } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
      await db.$disconnect();
    });
    it("allows both administrative roles, assignment/reassignment and stale repeat detection", async () => {
      const row = await service.detail(claims, id);
      const assigned = await service.action(claims, id, action(row.revision));
      expect(assigned.vet?.id).toBe(vetId);
      expect(assigned.status).toBe("ASSIGNED");
      expect(assigned.revision).not.toBe(row.revision);
      await expect(
        service.action(claims, id, action(row.revision)),
      ).rejects.toMatchObject({ errorCode: "CONSULTATION_VERSION_CONFLICT" });
      // Reassigning to the current vet must exclude this case from capacity.
      const same = await service.action(
        otherClaims,
        id,
        action(assigned.revision),
      );
      const changed = await service.action(
        otherClaims,
        id,
        action(same.revision, "ASSIGN", otherVetId),
      );
      expect(changed.vet?.id).toBe(otherVetId);
      expect(await db.auditLog.count({ where: { entityId: id } })).toBe(3);
      expect(
        await db.consultationNotificationLog.count({
          where: { consultationId: id, channel: "IN_APP" },
        }),
      ).toBe(3);
    });
    it("preserves payment, scheduling, media and complaint on assignment and safe cancellation", async () => {
      const at = new Date("2026-10-16T04:00:00Z");
      await db.consultation.update({
        where: { id },
        data: {
          type: "LIVE_VIDEO",
          scheduledAt: at,
          paymentStatus: "FAILED",
          mediaUrls: ["private-key"],
          paymentReleasedAt: at,
        },
      });
      const before = await db.consultation.findUniqueOrThrow({ where: { id } });
      const assigned = await service.action(
        claims,
        id,
        action((await service.detail(claims, id)).revision),
      );
      const cancelled = await service.action(
        claims,
        id,
        action(assigned.revision, "CANCEL"),
      );
      expect(cancelled.status).toBe("CANCELLED");
      const after = await db.consultation.findUniqueOrThrow({ where: { id } });
      for (const key of [
        "paymentStatus",
        "paymentIntentId",
        "paymentHeldAt",
        "paymentCapturedAt",
        "paymentReleasedAt",
        "feeCents",
        "currency",
        "scheduledAt",
        "mediaUrls",
        "chiefComplaint",
      ] as const)
        expect(after[key]).toEqual(before[key]);
      expect(
        await db.consultationNotificationLog.count({
          where: { consultationId: id, channel: "IN_APP" },
        }),
      ).toBe(2);
    });
    it.each([
      "AUTHORIZED",
      "CAPTURED",
      "PROVIDER",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED",
    ])(
      "denies unsafe %s cancellation without payment/audit changes",
      async (mode) => {
        await db.consultation.update({
          where: { id },
          data:
            mode === "PROVIDER"
              ? { paymentIntentId: "provider-secret" }
              : mode === "AUTHORIZED" || mode === "CAPTURED"
                ? { paymentStatus: mode }
                : { status: mode as any },
        });
        const before = await db.consultation.findUniqueOrThrow({
            where: { id },
          }),
          detail = await service.detail(claims, id);
        expect(detail.allowedActions).not.toContain("CANCEL");
        await expect(
          service.action(claims, id, action(detail.revision, "CANCEL")),
        ).rejects.toMatchObject({
          errorCode: "CONSULTATION_ACTION_UNAVAILABLE",
        });
        expect(
          await db.consultation.findUniqueOrThrow({ where: { id } }),
        ).toEqual(before);
        expect(await db.auditLog.count({ where: { entityId: id } })).toBe(0);
      },
    );
    it("rejects unavailable, missing profile, inactive and full vets; auto assignment finds no candidate", async () => {
      const revision = (await service.detail(claims, id)).revision;
      await db.vetProfile.delete({ where: { userId: vetId } });
      await expect(
        service.action(claims, id, action(revision)),
      ).rejects.toMatchObject({ errorCode: "CONSULTATION_ACTION_UNAVAILABLE" });
      await db.vetProfile.create({
        data: { userId: vetId, ...profile, isAvailable: false },
      });
      expect(
        (await service.candidates(claims, id)).items.find(
          (v) => v.vetId === vetId,
        )?.ineligibilityReason,
      ).toBe("UNAVAILABLE");
      await expect(
        service.action(claims, id, action(revision)),
      ).rejects.toMatchObject({ errorCode: "CONSULTATION_ACTION_UNAVAILABLE" });
      await db.vetProfile.update({
        where: { userId: vetId },
        data: { isAvailable: true },
      });
      await consultation({ vetId, status: "ASSIGNED" });
      await expect(
        service.action(claims, id, action(revision)),
      ).rejects.toMatchObject({ errorCode: "CONSULTATION_ACTION_UNAVAILABLE" });
      await db.user.update({
        where: { id: otherVetId },
        data: { status: "SUSPENDED" },
      });
      expect(
        (await service.candidates(claims, id)).items.some(
          (v) => v.vetId === otherVetId,
        ),
      ).toBe(false);
      await expect(
        service.action(claims, id, action(revision, "AUTO_ASSIGN")),
      ).rejects.toMatchObject({ errorCode: "CONSULTATION_ACTION_UNAVAILABLE" });
    });
    it("uses local timezone and rejects appointments within inclusive +/-45 minutes", async () => {
      await db.consultation.update({
        where: { id },
        data: {
          type: "LIVE_VIDEO",
          scheduledAt: new Date("2026-10-16T04:00:00Z"),
        },
      });
      await db.vetProfile.update({
        where: { userId: vetId },
        data: { maxActiveCases: 5 },
      });
      const candidates = await service.candidates(claims, id);
      expect(candidates.items.find((v) => v.vetId === vetId)?.isEligible).toBe(
        true,
      );
      await consultation({
        vetId,
        status: "ASSIGNED",
        type: "LIVE_VIDEO",
        scheduledAt: new Date("2026-10-16T04:45:00Z"),
      });
      expect(
        (await service.candidates(claims, id)).items.find(
          (v) => v.vetId === vetId,
        )?.ineligibilityReason,
      ).toBe("SCHEDULE");
      await expect(
        service.action(
          claims,
          id,
          action((await service.detail(claims, id)).revision),
        ),
      ).rejects.toMatchObject({ errorCode: "CONSULTATION_ACTION_UNAVAILABLE" });
      await db.consultation.update({
        where: { id },
        data: { scheduledAt: new Date("2026-10-16T14:00:00Z") },
      });
      expect(
        (await service.candidates(claims, id)).items.find(
          (v) => v.vetId === vetId,
        )?.ineligibilityReason,
      ).toBe("SCHEDULE");
    });
    it("serializes concurrent same-case requests to one acknowledged change", async () => {
      const revision = (await service.detail(claims, id)).revision;
      const results = await Promise.allSettled([
        service.action(claims, id, action(revision)),
        service.action(otherClaims, id, action(revision)),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const failed = results.find(
        (r) => r.status === "rejected",
      ) as PromiseRejectedResult;
      expect(failed.reason.errorCode).toBe("CONSULTATION_VERSION_CONFLICT");
      expect(await db.auditLog.count({ where: { entityId: id } })).toBe(1);
      expect(
        await db.consultationNotificationLog.count({
          where: { consultationId: id },
        }),
      ).toBe(1);
    });
    it("prevents competing administrative assignments from exceeding one vet's capacity", async () => {
      const other = await consultation();
      const a = await service.detail(claims, id),
        b = await service.detail(otherClaims, other);
      const results = await Promise.allSettled([
        service.action(claims, id, action(a.revision)),
        service.action(otherClaims, other, action(b.revision)),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(
        await db.consultation.count({
          where: { vetId, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
        }),
      ).toBe(1);
      expect(
        await db.auditLog.count({ where: { entityId: { in: [id, other] } } }),
      ).toBe(1);
    });
    it("rolls back assignment, revision, notification and audit together", async () => {
      const before = await service.detail(claims, id);
      const spy = jest
        .spyOn(audit, "record")
        .mockRejectedValueOnce(new Error("Synthetic audit failure"));
      try {
        await expect(
          service.action(claims, id, action(before.revision)),
        ).rejects.toThrow("Synthetic audit failure");
      } finally {
        spy.mockRestore();
      }
      const restored = await service.detail(claims, id);
      expect(restored.status).toBe("SUBMITTED");
      expect(restored.revision).toBe(before.revision);
      expect(
        await db.consultationNotificationLog.count({
          where: { consultationId: id },
        }),
      ).toBe(0);
      expect(await db.auditLog.count({ where: { entityId: id } })).toBe(0);
      await service.action(claims, id, action(before.revision));
    });
    it("detects a legacy payment/clinical update committed before the administrative write", async () => {
      const before = await service.detail(claims, id);
      await db.consultation.update({
        where: { id },
        data: {
          paymentStatus: "CAPTURED",
          paymentIntentId: "provider-secret",
          status: "IN_PROGRESS",
        },
      });
      await expect(
        service.action(claims, id, action(before.revision)),
      ).rejects.toMatchObject({ errorCode: "CONSULTATION_VERSION_CONFLICT" });
      const after = await db.consultation.findUniqueOrThrow({ where: { id } });
      expect(after.paymentStatus).toBe("CAPTURED");
      expect(after.status).toBe("IN_PROGRESS");
    });
    it("translates a legacy write committed after the serializable snapshot into a conflict", async () => {
      const before = await service.detail(claims, id);
      let release!: () => void, entered!: () => void;
      const enteredPromise = new Promise<void>((resolve) => {
          entered = resolve;
        }),
        gate = new Promise<void>((resolve) => {
          release = resolve;
        });
      const lock = repo.lock.bind(repo);
      const spy = jest
        .spyOn(repo, "lock")
        .mockImplementationOnce(async (target, tx) => {
          entered();
          await gate;
          return lock(target, tx);
        });
      const result = service.action(claims, id, action(before.revision));
      const assertion = expect(result).rejects.toMatchObject({
        errorCode: "CONSULTATION_VERSION_CONFLICT",
      });
      try {
        await enteredPromise;
        await db.consultation.update({
          where: { id },
          data: {
            paymentStatus: "CAPTURED",
            paymentIntentId: "provider-race",
            status: "IN_PROGRESS",
          },
        });
        release();
        await assertion;
      } finally {
        release();
        spy.mockRestore();
      }
      const row = await db.consultation.findUniqueOrThrow({ where: { id } });
      expect(row.status).toBe("IN_PROGRESS");
      expect(row.paymentIntentId).toBe("provider-race");
      expect(await db.auditLog.count({ where: { entityId: id } })).toBe(0);
    });
    it("rechecks actor password/version after password comparison before writing", async () => {
      const before = await service.detail(claims, id),
        compare = hasher.compare.bind(hasher);
      const spy = jest
        .spyOn(hasher, "compare")
        .mockImplementationOnce(async (raw, hash) => {
          const valid = await compare(raw, hash);
          await db.user.update({
            where: { id: claims.sub },
            data: { authorizationVersion: 1 },
          });
          return valid;
        });
      try {
        await expect(
          service.action(claims, id, action(before.revision)),
        ).rejects.toMatchObject({ statusCode: 403 });
      } finally {
        spy.mockRestore();
      }
      expect(await db.auditLog.count({ where: { entityId: id } })).toBe(0);
    });
    it("redacts deleted identities and private provider/body/error/audit data with bounded histories", async () => {
      const animal = await db.animal.create({
        data: {
          farmId,
          tagNumber: `adm5-${randomUUID()}`,
          name: "Private animal",
          species: "COW",
          gender: "FEMALE",
          deletedAt: new Date(),
        },
      });
      animals.push(animal.id);
      await db.user.update({
        where: { id: ownerId },
        data: { deletedAt: new Date() },
      });
      await db.consultation.update({
        where: { id },
        data: {
          animalId: animal.id,
          paymentIntentId: "provider-secret",
          mediaUrls: ["private-media"],
        },
      });
      await db.auditLog.createMany({
        data: Array.from({ length: 51 }, () => ({
          userId: ownerId,
          action: "CONSULTATION_REQUEST_SUBMITTED",
          entityType: "Consultation",
          entityId: id,
          traceId: randomUUID(),
          newValues: { phone: "PRIVATE-PHONE", media: "PRIVATE-MEDIA" },
        })),
      });
      await db.auditLog.create({
        data: {
          userId: claims.sub,
          action: "SECURITY_PRIVATE",
          entityType: "Consultation",
          entityId: id,
          traceId: randomUUID(),
          newValues: { reason: "PRIVATE-AUDIT" },
        },
      });
      await db.consultationNotificationLog.createMany({
        data: Array.from({ length: 51 }, () => ({
          consultationId: id,
          vetId,
          channel: "EMAIL" as const,
          status: "FAILED" as const,
          title: "PRIVATE-TITLE",
          message: "PRIVATE-BODY",
          errorMessage: "PRIVATE-ERROR",
          metadata: { email: "PRIVATE-EMAIL" },
        })),
      });
      const row = await service.detail(claims, id),
        text = JSON.stringify(row);
      expect(row.farmer).toBeNull();
      expect(row.animal).toBeNull();
      expect(row.history.every((h) => h.actor === null)).toBe(true);
      expect(row.history).toHaveLength(50);
      expect(row.historyTruncated).toBe(true);
      expect(row.notifications).toHaveLength(50);
      expect(row.notificationsTruncated).toBe(true);
      for (const value of [
        "provider-secret",
        "private-media",
        "Private animal",
        "PRIVATE-",
      ])
        expect(text).not.toContain(value);
      expect(
        (
          await service.list(claims, { limit: 100, search: "Synthetic FARMER" })
        ).items.some((c) => c.id === id),
      ).toBe(false);
    });
    it("discovers all statuses and uses stable ID cursors", async () => {
      const complete = await consultation({
        status: "COMPLETED",
        chiefComplaint: "Unique discovery phrase",
      });
      expect(
        (
          await service.list(claims, {
            limit: 100,
            search: "Unique discovery phrase",
          })
        ).items[0].id,
      ).toBe(complete);
      const first = await service.list(claims, { limit: 1 });
      expect(first.items).toHaveLength(1);
      expect(first.nextCursor).not.toBeNull();
      const next = await service.list(claims, {
        limit: 1,
        cursor: first.nextCursor!,
      });
      expect(next.items.every((c) => c.id > first.items[0].id)).toBe(true);
      expect(
        (await service.list(claims, { limit: 20, search: "-".repeat(36) }))
          .items,
      ).toEqual([]);
    });
    it("automatically selects ranked eligible vets and persists only IN_APP delivery", async () => {
      await db.vetProfile.update({
        where: { userId: otherVetId },
        data: { isAvailable: false },
      });
      const row = await service.action(
        otherClaims,
        id,
        action((await service.detail(otherClaims, id)).revision, "AUTO_ASSIGN"),
      );
      expect(row.vet?.id).toBe(vetId);
      const notices = await db.consultationNotificationLog.findMany({
        where: { consultationId: id },
      });
      expect(notices).toHaveLength(1);
      expect(notices[0].channel).toBe("IN_APP");
      const events = await db.auditLog.findMany({ where: { entityId: id } });
      expect(events[0].action).toBe("CONSULTATION_ADMIN_AUTO_ASSIGNED");
      expect(JSON.stringify(events)).not.toContain(password);
    });

    it("keeps delayed legacy payment evidence without undoing administrative cancellation", async () => {
      const legacy = new ConsultationRepository(db as unknown as PrismaService);
      const stale = (await legacy.findById(id))!;
      const row = await service.detail(claims, id);
      await service.action(claims, id, action(row.revision, "CANCEL"));
      stale.placePaymentHold("real-provider-hold");
      const saved = await legacy.save(stale);
      expect(saved.status).toBe("CANCELLED");
      expect(saved.paymentStatus).toBe("AUTHORIZED");
      expect(saved.paymentIntentId).toBe("real-provider-hold");
      expect((await service.detail(claims, id)).allowedActions).toEqual([]);
    });
    it("rejects delayed legacy clinical/assignment transitions after an admin mutation", async () => {
      const legacy = new ConsultationRepository(db as unknown as PrismaService);
      const stale = (await legacy.findById(id))!;
      await service.action(
        claims,
        id,
        action((await service.detail(claims, id)).revision, "CANCEL"),
      );
      stale.assignToVet(vetId);
      await expect(legacy.save(stale)).rejects.toMatchObject({
        errorCode: "CONSULTATION_VERSION_CONFLICT",
      });
      expect((await service.detail(claims, id)).status).toBe("CANCELLED");
    });
    it("rechecks capacity for a delayed legacy assignment after the admin claims the last slot", async () => {
      const legacy = new ConsultationRepository(db as unknown as PrismaService),
        other = await consultation();
      const stale = (await legacy.findById(other))!;
      stale.assignToVet(vetId);
      await service.action(
        claims,
        id,
        action((await service.detail(claims, id)).revision),
      );
      await expect(legacy.save(stale)).rejects.toMatchObject({
        errorCode: "CONSULTATION_ACTION_UNAVAILABLE",
      });
      expect(
        await db.consultation.count({
          where: { vetId, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
        }),
      ).toBe(1);
    });
    it("conflicts an admin snapshot when a ReadCommitted legacy assignment wins the same vet fence", async () => {
      const legacy = new ConsultationRepository(db as unknown as PrismaService),
        other = await consultation();
      const stale = (await legacy.findById(other))!;
      stale.assignToVet(vetId);
      const before = await service.detail(claims, id);
      let release!: () => void, entered!: () => void;
      const enteredPromise = new Promise<void>((resolve) => {
          entered = resolve;
        }),
        gate = new Promise<void>((resolve) => {
          release = resolve;
        });
      const lockVet = repo.lockVet.bind(repo);
      const spy = jest
        .spyOn(repo, "lockVet")
        .mockImplementationOnce(async (target, tx) => {
          entered();
          await gate;
          return lockVet(target, tx);
        });
      const result = service.action(claims, id, action(before.revision));
      const assertion = expect(result).rejects.toMatchObject({
        errorCode: "CONSULTATION_VERSION_CONFLICT",
      });
      try {
        await enteredPromise;
        await legacy.save(stale);
        release();
        await assertion;
      } finally {
        release();
        spy.mockRestore();
      }
      expect(
        await db.consultation.count({
          where: { vetId, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
        }),
      ).toBe(1);
    });

    it("retains a cancellation notice for an assigned vet even when detail redacts that deleted identity", async () => {
      await db.consultation.update({
        where: { id },
        data: { vetId, status: "ASSIGNED" },
      });
      await db.user.update({
        where: { id: vetId },
        data: { deletedAt: new Date() },
      });
      const row = await service.detail(claims, id);
      expect(row.vet).toBeNull();
      await service.action(claims, id, action(row.revision, "CANCEL"));
      expect(
        await db.consultationNotificationLog.count({
          where: { consultationId: id, vetId, channel: "IN_APP" },
        }),
      ).toBe(1);
    });
    it("rolls back cancellation and its notice when the audit write fails", async () => {
      await db.consultation.update({
        where: { id },
        data: { vetId, status: "ASSIGNED" },
      });
      const row = await service.detail(claims, id);
      const spy = jest
        .spyOn(audit, "record")
        .mockRejectedValueOnce(
          new Error("Synthetic cancellation audit failure"),
        );
      try {
        await expect(
          service.action(claims, id, action(row.revision, "CANCEL")),
        ).rejects.toThrow("Synthetic cancellation audit failure");
      } finally {
        spy.mockRestore();
      }
      const restored = await service.detail(claims, id);
      expect(restored.status).toBe("ASSIGNED");
      expect(restored.revision).toBe(row.revision);
      expect(
        await db.consultationNotificationLog.count({
          where: { consultationId: id },
        }),
      ).toBe(0);
    });
    it("bounds candidate discovery at 100 and exposes truncation", async () => {
      for (let i = 0; i < 100; i++)
        await user("VET", `Bounded synthetic vet ${i}`);
      const result = await service.candidates(claims, id);
      expect(result.items).toHaveLength(100);
      expect(result.truncated).toBe(true);
      // These fixture identities deliberately have no availability profile.
      expect(
        result.items.some((v) => v.ineligibilityReason === "PROFILE_REQUIRED"),
      ).toBe(true);
      await db.user.updateMany({
        where: {
          id: {
            in: users.filter(
              (u) =>
                ![
                  claims.sub,
                  otherClaims.sub,
                  ownerId,
                  vetId,
                  otherVetId,
                ].includes(u),
            ),
          },
        },
        data: { status: "SUSPENDED" },
      });
    });
  },
);
