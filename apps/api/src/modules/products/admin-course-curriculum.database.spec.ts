import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import {
  JwtPayload,
  ProductContentProvider,
  ProductType,
  SubscriptionTier,
  UserRole,
} from "@vetralink/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { UserRepository } from "../users/repositories/user.repository";
import { AuditLogRepository } from "../audit/repositories/audit-log.repository";
import { TransactionManager } from "../prisma/transaction/transaction.manager";
import { AdminProductsRepository } from "./admin-products.repository";
import { AdminProductsService } from "./admin-products.service";
import { AdminCourseCurriculumService } from "./admin-course-curriculum.service";
import { ProductRepository } from "./repositories/product.repository";
const database = process.env.YT_TEST_DATABASE_URL;
if (database && !new URL(database).pathname.endsWith("/adm3_test"))
  throw new Error("Explicit disposable adm3_test database required");
(database ? describe : describe.skip)(
  "YouTube admin curriculum real PostgreSQL",
  () => {
    let prisma: PrismaClient,
      actor: JwtPayload,
      catalog: AdminProductsService,
      service: AdminCourseCurriculumService,
      audit: AuditLogRepository,
      repo: AdminProductsRepository,
      productId: string;
    const ids: string[] = [];
    const lesson = (
      title: string,
      access: "ENROLLED" | "PUBLIC_DEMO" = "ENROLLED",
    ) => ({
      title,
      summary: "",
      access,
      videoUrl: "https://youtu.be/M7lc1UVf-VE",
    });
    beforeAll(async () => {
      prisma = new PrismaClient({ datasources: { db: { url: database } } });
      await prisma.$connect();
      const adapter = prisma as unknown as PrismaService;
      const user = await prisma.user.create({
        data: {
          name: "Synthetic YouTube Admin",
          email: `${randomUUID()}@yt.example.test`,
          passwordHash: "synthetic",
          role: "ADMIN",
        },
      });
      actor = {
        sub: user.id,
        role: UserRole.ADMIN,
        authorizationVersion: 0,
      } as JwtPayload;
      repo = new AdminProductsRepository(adapter);
      audit = new AuditLogRepository(adapter);
      const transactions = new TransactionManager(adapter);
      catalog = new AdminProductsService(
        repo,
        new UserRepository(adapter, {} as never),
        transactions,
        audit,
      );
      service = new AdminCourseCurriculumService(
        repo,
        catalog,
        transactions,
        audit,
      );
    });
    beforeEach(async () => {
      const product = await catalog.create(actor, {
        title: "Synthetic YouTube course",
        slug: `youtube-${randomUUID()}`,
        description: "Synthetic course description",
        type: ProductType.VIDEO_COURSE,
        contentProvider: ProductContentProvider.YOUTUBE,
        priceCents: 0,
        discountPriceCents: null,
        currency: "BDT",
        minSubscriptionTier: SubscriptionTier.STARTER,
      });
      productId = product.id;
      ids.push(productId);
    });
    afterAll(async () => {
      if (!prisma) return;
      await prisma.auditLog.deleteMany({ where: { userId: actor.sub } });
      await prisma.courseLesson.deleteMany({
        where: { productId: { in: ids } },
      });
      await prisma.product.deleteMany({ where: { id: { in: ids } } });
      await prisma.user.delete({ where: { id: actor.sub } });
      await prisma.$disconnect();
    });
    it("retains populated legacy products as INTERNAL after the additive migration", async () => {
      const original = await prisma.product.findUnique({
        where: { slug: "adm3-populated-rehearsal" },
      });
      expect(original?.contentProvider).toBe("INTERNAL");
      expect(original?.contentS3Key).toBe("legacy/guide.pdf");
    });
    it("keeps lesson identities and unique order, publishes, and rehydrates an empty-key course", async () => {
      const first = await service.replace(actor, productId, {
        expectedVersion: 0,
        lessons: [lesson("Main lesson"), lesson("Demo lesson", "PUBLIC_DEMO")],
      });
      const reordered = await service.replace(actor, productId, {
        expectedVersion: 1,
        lessons: [
          { ...lesson("Demo lesson", "PUBLIC_DEMO"), id: first.lessons[1].id },
          { ...lesson("Main lesson"), id: first.lessons[0].id },
        ],
      });
      expect(reordered.lessons.map((row) => row.id)).toEqual([
        first.lessons[1].id,
        first.lessons[0].id,
      ]);
      expect(reordered.lessons.map((row) => row.position)).toEqual([1, 2]);
      await catalog.action(actor, productId, {
        action: "PUBLISH",
        expectedVersion: 2,
        reason: "Reviewed synthetic course",
      });
      expect(
        (
          await new ProductRepository(
            prisma as unknown as PrismaService,
          ).findById(productId)
        )?.isPublished,
      ).toBe(true);
      await expect(
        service.replace(actor, productId, { expectedVersion: 3, lessons: [] }),
      ).rejects.toThrow();
    });
    it("rolls back lesson replacement and version when audit fails", async () => {
      const spy = jest
        .spyOn(audit, "record")
        .mockRejectedValueOnce(new Error("Synthetic audit failure"));
      await expect(
        service.replace(actor, productId, {
          expectedVersion: 0,
          lessons: [lesson("Main lesson")],
        }),
      ).rejects.toThrow("Synthetic audit failure");
      spy.mockRestore();
      expect(await prisma.courseLesson.count({ where: { productId } })).toBe(0);
      expect((await repo.detail(productId))?.version).toBe(0);
    });
    it("allows only one concurrent replacement at a saved version", async () => {
      const results = await Promise.allSettled([
        service.replace(actor, productId, {
          expectedVersion: 0,
          lessons: [lesson("Editor A")],
        }),
        service.replace(actor, productId, {
          expectedVersion: 0,
          lessons: [lesson("Editor B")],
        }),
      ]);
      expect(results.filter((row) => row.status === "fulfilled")).toHaveLength(
        1,
      );
      expect((await repo.detail(productId))?.version).toBe(1);
      expect(
        await prisma.auditLog.count({
          where: { entityId: productId, action: "COURSE_CURRICULUM_UPDATED" },
        }),
      ).toBe(1);
    });
    it("soft deletes removed lessons and rejects their reuse", async () => {
      const first = await service.replace(actor, productId, {
        expectedVersion: 0,
        lessons: [lesson("Main lesson"), lesson("Demo lesson", "PUBLIC_DEMO")],
      });
      await service.replace(actor, productId, {
        expectedVersion: 1,
        lessons: [{ ...lesson("Main lesson"), id: first.lessons[0].id }],
      });
      expect(
        (
          await prisma.courseLesson.findUnique({
            where: { id: first.lessons[1].id },
          })
        )?.deletedAt,
      ).not.toBeNull();
      await expect(
        service.replace(actor, productId, {
          expectedVersion: 2,
          lessons: [{ ...lesson("Removed"), id: first.lessons[1].id }],
        }),
      ).rejects.toThrow();
    });
  },
);
