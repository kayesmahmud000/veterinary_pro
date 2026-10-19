import { randomUUID } from "crypto";
import { Prisma, PrismaClient } from "@prisma/client";
import {
  JwtPayload,
  ReviewModerationStatus,
  UserRole,
} from "@vetralink/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { UserRepository } from "../users/repositories/user.repository";
import { BcryptPasswordHasher } from "../auth/services/bcrypt-password-hasher.service";
import { AuditLogRepository } from "../audit/repositories/audit-log.repository";
import { TransactionManager } from "../prisma/transaction/transaction.manager";
import { ConsultationRepository } from "../consultations/repositories/consultation.repository";
import { ConsultationReviewRepository } from "../consultations/repositories/consultation-review.repository";
import { VetProfileRepository } from "../consultations/repositories/vet-profile.repository";
import { ConsultationReviewService } from "../consultations/services/consultation-review.service";
import { AdminReviewsRepository } from "./reviews.repository";
import { AdminReviewsService } from "./reviews.service";

const url = process.env.REVIEW_TEST_DATABASE_URL;
if (
  url &&
  (!["127.0.0.1", "localhost"].includes(new URL(url).hostname) ||
    new URL(url).pathname !== "/adm6_test")
) {
  throw new Error("Explicit loopback disposable adm6_test required");
}
(url ? describe : describe.skip)(
  "Administrative reviews real PostgreSQL",
  () => {
    let db: PrismaClient,
      repo: AdminReviewsRepository,
      service: AdminReviewsService,
      legacy: ConsultationReviewService,
      profiles: VetProfileRepository,
      audit: AuditLogRepository,
      claims: JwtPayload,
      otherClaims: JwtPayload,
      farmerClaims: JwtPayload,
      farmerId: string,
      vetId: string,
      farmId: string,
      id: string,
      hash: string;
    const password = "Synthetic review password!";
    const users: string[] = [],
      cases: string[] = [],
      reviews: string[] = [];
    const hasher = new BcryptPasswordHasher();
    async function user(role: "ADMIN" | "SUPER_ADMIN" | "FARMER" | "VET") {
      const row = await db.user.create({
        data: {
          role,
          name: `Synthetic ${role}`,
          email: `${randomUUID()}@adm6-review.example.test`,
          passwordHash: hash,
        },
      });
      users.push(row.id);
      return row.id;
    }
    async function consultation() {
      const row = await db.consultation.create({
        data: {
          farmerId,
          vetId,
          farmId,
          chiefComplaint: "PRIVATE-CLINICAL",
          feeCents: 1234,
          currency: "BDT",
          status: "COMPLETED",
          paymentStatus: "CAPTURED",
          paymentIntentId: "PRIVATE-PROVIDER",
        },
      });
      cases.push(row.id);
      return row.id;
    }
    async function review(
      data: Partial<Prisma.ConsultationReviewUncheckedCreateInput> = {},
    ) {
      const row = await db.consultationReview.create({
        data: {
          consultationId: await consultation(),
          farmerId,
          vetId,
          rating: 4,
          feedback: "Authored feedback <script>text</script>",
          tags: ["KIND"],
          isPublic: true,
          moderationStatus: "PENDING",
          ...data,
        },
      });
      reviews.push(row.id);
      return row.id;
    }
    const input = (
      revision: string,
      status: "APPROVED" | "FLAGGED" | "REJECTED" = "APPROVED",
    ) => ({
      status,
      expectedRevision: revision,
      reason: "Reviewed synthetic feedback",
      actorPassword: password,
    });
    async function assertAggregate(rating: number, count: number) {
      const p = await db.vetProfile.findUniqueOrThrow({
        where: { userId: vetId },
      });
      expect(Number(p.averageRating)).toBe(rating);
      expect(p.totalReviews).toBe(count);
    }
    beforeAll(async () => {
      db = new PrismaClient({ datasources: { db: { url } } });
      const adapter = db as unknown as PrismaService;
      hash = await hasher.hash(password);
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
      farmerId = await user("FARMER");
      vetId = await user("VET");
      farmerClaims = {
        sub: farmerId,
        role: UserRole.FARMER,
        authorizationVersion: 0,
      } as JwtPayload;
      farmId = (
        await db.farm.create({
          data: {
            ownerId: farmerId,
            name: "Synthetic review farm",
            slug: `adm6-review-${randomUUID()}`,
            country: "Bangladesh",
          },
        })
      ).id;
      profiles = new VetProfileRepository(adapter);
      repo = new AdminReviewsRepository(adapter);
      audit = new AuditLogRepository(adapter);
      const transactions = new TransactionManager(adapter);
      service = new AdminReviewsService(
        repo,
        new UserRepository(adapter, {} as never),
        hasher,
        transactions,
        audit,
        { hit: async () => undefined } as never,
        profiles,
      );
      legacy = new ConsultationReviewService(
        new ConsultationReviewRepository(adapter),
        new ConsultationRepository(adapter),
        profiles,
        audit,
        transactions,
      );
    });
    beforeEach(async () => {
      if (reviews.length) {
        await db.auditLog.deleteMany({ where: { entityId: { in: reviews } } });
        await db.consultationReview.deleteMany({
          where: { id: { in: reviews } },
        });
        reviews.length = 0;
      }
      await db.user.updateMany({
        where: { id: { in: users } },
        data: {
          deletedAt: null,
          status: "ACTIVE",
          authorizationVersion: 0,
          passwordHash: hash,
        },
      });
      await db.farm.update({
        where: { id: farmId },
        data: { deletedAt: null },
      });
      await db.vetProfile.upsert({
        where: { userId: vetId },
        create: {
          userId: vetId,
          isAvailable: false,
          averageRating: 0,
          totalReviews: 0,
          maxActiveCases: 3,
        },
        update: {
          isAvailable: false,
          averageRating: 0,
          totalReviews: 0,
          maxActiveCases: 3,
        },
      });
      id = await review();
    });
    afterAll(async () => {
      if (!db) return;
      await db.auditLog.deleteMany({
        where: {
          OR: [{ entityId: { in: reviews } }, { userId: { in: users } }],
        },
      });
      await db.consultationReview.deleteMany({
        where: { consultationId: { in: cases } },
      });
      await db.consultation.deleteMany({ where: { id: { in: cases } } });
      if (farmId) await db.farm.deleteMany({ where: { id: farmId } });
      await db.vetProfile.deleteMany({ where: { userId: { in: users } } });
      await db.user.deleteMany({ where: { id: { in: users } } });
      await db.$disconnect();
    });
    it("keeps revision, history and audit identity canonical for uppercase review IDs", async () => {
      const before = await service.detail(claims, id);
      await service.moderate(claims, id.toUpperCase(), input(before.revision));
      const canonical = await service.detail(claims, id);
      expect(await service.detail(claims, id.toUpperCase())).toEqual(canonical);
      expect(canonical.history).toHaveLength(1);
      const filtered = await service.list(claims, {
        limit: 20,
        vetId: vetId.toUpperCase(),
      });
      expect(filtered.items.map((row) => row.id)).toContain(id);
    });
    it("preserves private authorship on approval and updates only existing aggregate fields", async () => {
      await db.consultationReview.update({
        where: { id },
        data: { isPublic: false },
      });
      const before = await service.detail(claims, id);
      const approved = await service.moderate(
        claims,
        id,
        input(before.revision),
      );
      expect(approved).toMatchObject({
        rating: 4,
        feedback: "Authored feedback <script>text</script>",
        tags: ["KIND"],
        isPublic: false,
        moderationStatus: "APPROVED",
      });
      await assertAggregate(0, 0);
      const p = await db.vetProfile.findUniqueOrThrow({
        where: { userId: vetId },
      });
      expect(p.isAvailable).toBe(false);
      expect(p.maxActiveCases).toBe(3);
      expect(
        await db.auditLog.count({
          where: { entityId: id, action: "ADMIN_REVIEW_MODERATED" },
        }),
      ).toBe(1);
      expect(JSON.stringify(approved)).not.toContain(password);
    });
    it("never fabricates a missing vet availability profile", async () => {
      await db.vetProfile.delete({ where: { userId: vetId } });
      await service.moderate(
        claims,
        id,
        input((await service.detail(claims, id)).revision),
      );
      expect(await db.vetProfile.count({ where: { userId: vetId } })).toBe(0);
    });
    it("rolls back moderation and aggregates when audit persistence fails", async () => {
      const before = await service.detail(claims, id);
      const spy = jest
        .spyOn(audit, "record")
        .mockRejectedValueOnce(new Error("Synthetic audit failure"));
      try {
        await expect(
          service.moderate(claims, id, input(before.revision)),
        ).rejects.toThrow("Synthetic audit failure");
      } finally {
        spy.mockRestore();
      }
      expect(await service.detail(claims, id)).toMatchObject({
        revision: before.revision,
        moderationStatus: "PENDING",
      });
      await assertAggregate(0, 0);
      expect(await db.auditLog.count({ where: { entityId: id } })).toBe(0);
    });
    it("rolls back moderation when profile persistence fails", async () => {
      const before = await service.detail(claims, id);
      const spy = jest
        .spyOn(profiles, "updateRatingAggregates")
        .mockRejectedValueOnce(new Error("Synthetic profile failure"));
      try {
        await expect(
          service.moderate(claims, id, input(before.revision)),
        ).rejects.toThrow("Synthetic profile failure");
      } finally {
        spy.mockRestore();
      }
      expect(await service.detail(claims, id)).toMatchObject({
        revision: before.revision,
        moderationStatus: "PENDING",
      });
      expect(await db.auditLog.count({ where: { entityId: id } })).toBe(0);
    });
    it("rejects duplicate/stale submissions with one committed event", async () => {
      const before = await service.detail(claims, id);
      const results = await Promise.allSettled([
        service.moderate(claims, id, input(before.revision)),
        service.moderate(otherClaims, id, input(before.revision)),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.find((r) => r.status === "rejected")).toMatchObject({
        reason: { errorCode: "REVIEW_VERSION_CONFLICT" },
      });
      const after = await service.detail(claims, id);
      await expect(
        service.moderate(claims, id, input(after.revision)),
      ).rejects.toMatchObject({ errorCode: "REVIEW_ACTION_UNAVAILABLE" });
      expect(await db.auditLog.count({ where: { entityId: id } })).toBe(1);
      await assertAggregate(4, 1);
    });
    it("recomputes public approved aggregates across independent admin writes", async () => {
      const other = await review({ rating: 2 });
      const a = await service.detail(claims, id),
        b = await service.detail(otherClaims, other);
      const result = await Promise.allSettled([
        service.moderate(claims, id, input(a.revision)),
        service.moderate(otherClaims, other, input(b.revision)),
      ]);
      for (let n = 0; n < result.length; n++)
        if (result[n].status === "rejected") {
          expect(result[n]).toMatchObject({
            reason: { errorCode: "REVIEW_VERSION_CONFLICT" },
          });
          const target = n === 0 ? id : other;
          await service.moderate(
            claims,
            target,
            input((await service.detail(claims, target)).revision),
          );
        }
      await assertAggregate(3, 2);
    });
    it("detects a committed legacy moderation after the admin snapshot and keeps its aggregate", async () => {
      const before = await service.detail(claims, id);
      let entered!: () => void, release!: () => void;
      const atFence = new Promise<void>((r) => (entered = r)),
        gate = new Promise<void>((r) => (release = r));
      const fence = profiles.lockReviewFence.bind(profiles);
      const spy = jest
        .spyOn(profiles, "lockReviewFence")
        .mockImplementationOnce(async (target, tx) => {
          entered();
          await gate;
          return fence(target, tx);
        });
      const pending = service.moderate(claims, id, input(before.revision));
      const assertion = expect(pending).rejects.toMatchObject({
        errorCode: "REVIEW_VERSION_CONFLICT",
      });
      try {
        await atFence;
        await legacy.moderateReview(
          id,
          {
            status: ReviewModerationStatus.REJECTED,
            reason: "Legacy rejection",
          },
          otherClaims,
        );
        release();
        await assertion;
      } finally {
        release();
        spy.mockRestore();
      }
      expect((await service.detail(claims, id)).moderationStatus).toBe(
        "REJECTED",
      );
      await assertAggregate(0, 0);
      expect(await db.auditLog.count({ where: { entityId: id } })).toBe(1);
    });
    it("serializes legacy submission with admin aggregate recomputation", async () => {
      const caseId = await consultation(),
        before = await service.detail(claims, id);
      let entered!: () => void, release!: () => void;
      const atFence = new Promise<void>((r) => (entered = r)),
        gate = new Promise<void>((r) => (release = r));
      const fence = profiles.lockReviewFence.bind(profiles);
      const spy = jest
        .spyOn(profiles, "lockReviewFence")
        .mockImplementationOnce(async (target, tx) => {
          entered();
          await gate;
          return fence(target, tx);
        });
      const pending = service.moderate(claims, id, input(before.revision));
      const assertion = expect(pending).rejects.toMatchObject({
        errorCode: "REVIEW_VERSION_CONFLICT",
      });
      try {
        await atFence;
        const submitted = await legacy.submitReview(caseId, farmerClaims, {
          rating: 2,
        });
        reviews.push(submitted.id);
        release();
        await assertion;
      } finally {
        release();
        spy.mockRestore();
      }
      await assertAggregate(2, 1);
      await service.moderate(
        claims,
        id,
        input((await service.detail(claims, id)).revision),
      );
      await assertAggregate(3, 2);
    });
    it("rolls back legacy submission and moderation when audit persistence fails", async () => {
      const caseId = await consultation();
      let spy = jest
        .spyOn(audit, "record")
        .mockRejectedValueOnce(new Error("Synthetic legacy audit failure"));
      try {
        await expect(
          legacy.submitReview(caseId, farmerClaims, { rating: 5 }),
        ).rejects.toThrow("Synthetic legacy audit failure");
      } finally {
        spy.mockRestore();
      }
      expect(
        await db.consultationReview.count({
          where: { consultationId: caseId },
        }),
      ).toBe(0);
      await assertAggregate(0, 0);
      spy = jest
        .spyOn(audit, "record")
        .mockRejectedValueOnce(new Error("Synthetic legacy audit failure"));
      try {
        await expect(
          legacy.moderateReview(
            id,
            { status: ReviewModerationStatus.APPROVED },
            claims,
          ),
        ).rejects.toThrow("Synthetic legacy audit failure");
      } finally {
        spy.mockRestore();
      }
      expect((await service.detail(claims, id)).moderationStatus).toBe(
        "PENDING",
      );
      await assertAggregate(0, 0);
    });
    it("limits legacy public discovery and unrelated consultation reads to approved public reviews", async () => {
      const publicId = await review({
          moderationStatus: "APPROVED",
          rating: 5,
        }),
        privateId = await review({
          moderationStatus: "APPROVED",
          isPublic: false,
        }),
        rejectedId = await review({ moderationStatus: "REJECTED" });
      const result = await legacy.getVetReviews(vetId, {
        moderationStatus: ReviewModerationStatus.REJECTED,
      });
      expect(result.items.map((r) => r.id)).toEqual([publicId]);
      for (const target of [id, privateId, rejectedId]) {
        const row = await service.detail(claims, target);
        expect(
          await legacy.getConsultationReview(row.consultationId, {
            sub: randomUUID(),
            role: UserRole.BUYER,
          } as JwtPayload),
        ).toBeNull();
        expect(
          await legacy.getConsultationReview(row.consultationId, farmerClaims),
        ).not.toBeNull();
        expect(
          await legacy.getConsultationReview(row.consultationId, {
            sub: vetId,
            role: UserRole.VET,
          } as JwtPayload),
        ).not.toBeNull();
        expect(
          await legacy.getConsultationReview(row.consultationId, claims),
        ).not.toBeNull();
      }
      expect((await legacy.getVetRatingSummary(vetId)).totalReviews).toBe(1);
    });
    it("redacts deleted identities and arbitrary audit metadata with bounded history", async () => {
      await db.user.updateMany({
        where: { id: { in: [farmerId, vetId] } },
        data: { deletedAt: new Date() },
      });
      await db.farm.update({
        where: { id: farmId },
        data: { deletedAt: new Date() },
      });
      await db.auditLog.createMany({
        data: Array.from({ length: 51 }, () => ({
          userId: farmerId,
          action: "CONSULTATION_REVIEW_MODERATED",
          entityType: "ConsultationReview",
          entityId: id,
          traceId: randomUUID(),
          newValues: {
            reason: "Safe reason",
            email: "PRIVATE-EMAIL",
            provider: "PRIVATE-AUDIT",
          },
        })),
      });
      await db.auditLog.create({
        data: {
          userId: claims.sub,
          action: "PRIVATE_UNKNOWN",
          entityType: "ConsultationReview",
          entityId: id,
          traceId: randomUUID(),
          newValues: { reason: "PRIVATE-UNKNOWN" },
        },
      });
      const row = await service.detail(claims, id);
      expect(row).toMatchObject({
        farmer: null,
        vet: null,
        consultation: { farm: null },
        historyTruncated: true,
      });
      expect(row.history).toHaveLength(50);
      expect(
        row.history.every(
          (h) => h.actor === null && h.reason === "Safe reason",
        ),
      ).toBe(true);
      expect(JSON.stringify(row)).not.toContain("PRIVATE-");
      expect(
        (await service.list(claims, { limit: 20, search: "Synthetic FARMER" }))
          .items,
      ).toEqual([]);
    });
    it("paginates/filter/searches with ascending IDs without mutating review state", async () => {
      const approved = await review({
        moderationStatus: "APPROVED",
        rating: 5,
      });
      expect(
        (
          await service.list(claims, {
            limit: 20,
            status: "APPROVED",
            rating: 5,
            vetId,
          })
        ).items.map((r) => r.id),
      ).toEqual([approved]);
      expect(
        (await service.list(claims, { limit: 20, search: approved })).items.map(
          (r) => r.id,
        ),
      ).toEqual([approved]);
      const first = await service.list(claims, { limit: 1, vetId });
      expect(first.nextCursor).not.toBeNull();
      const next = await service.list(claims, {
        limit: 1,
        vetId,
        cursor: first.nextCursor!,
      });
      expect(next.items[0].id > first.items[0].id).toBe(true);
      const before = await service.detail(claims, id);
      await service.detail(claims, id);
      expect((await service.detail(claims, id)).revision).toBe(before.revision);
      expect(
        await db.auditLog.count({ where: { entityId: { in: reviews } } }),
      ).toBe(0);
    });
    it("rechecks locked actor credentials and refuses changed role/version", async () => {
      const before = await service.detail(claims, id),
        compare = hasher.compare.bind(hasher);
      const spy = jest
        .spyOn(hasher, "compare")
        .mockImplementationOnce(async (raw, current) => {
          const valid = await compare(raw, current);
          await db.user.update({
            where: { id: claims.sub },
            data: { authorizationVersion: 1 },
          });
          return valid;
        });
      try {
        await expect(
          service.moderate(claims, id, input(before.revision)),
        ).rejects.toMatchObject({ statusCode: 403 });
      } finally {
        spy.mockRestore();
      }
      expect(
        (await db.consultationReview.findUniqueOrThrow({ where: { id } }))
          .moderationStatus,
      ).toBe("PENDING");
      expect(await db.auditLog.count({ where: { entityId: id } })).toBe(0);
    });
  },
);
