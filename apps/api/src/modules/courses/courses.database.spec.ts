import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import { JwtPayload, UserRole } from "@vetralink/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { UserRepository } from "../users/repositories/user.repository";
import { AuditLogRepository } from "../audit/repositories/audit-log.repository";
import { TransactionManager } from "../prisma/transaction/transaction.manager";
import { CoursesRepository } from "./courses.repository";
import { CoursesService } from "./courses.service";
const url = process.env.YTL_TEST_DATABASE_URL;
if (url && !new URL(url).pathname.endsWith("/adm3_test"))
  throw new Error("Explicit disposable adm3_test URL required");
(url ? describe : describe.skip)("YouTube learner PostgreSQL", () => {
  let prisma: PrismaClient,
    service: CoursesService,
    audit: AuditLogRepository,
    a: JwtPayload,
    b: JwtPayload,
    productId: string,
    slug: string,
    mainId: string,
    demoId: string;
  const productIds: string[] = [];
  beforeAll(async () => {
    prisma = new PrismaClient({ datasources: { db: { url } } });
    const adapter = prisma as unknown as PrismaService;
    const users = await Promise.all(
      ["A", "B"].map((name) =>
        prisma.user.create({
          data: {
            name: `Synthetic Learner ${name}`,
            email: `${randomUUID()}@ytl.example.test`,
            passwordHash: "synthetic",
            role: "LEARNER",
          },
        }),
      ),
    );
    [a, b] = users.map(
      (user) =>
        ({
          sub: user.id,
          role: UserRole.LEARNER,
          authorizationVersion: 0,
        }) as JwtPayload,
    );
    audit = new AuditLogRepository(adapter);
    service = new CoursesService(
      new CoursesRepository(adapter),
      new UserRepository(adapter, {} as never),
      new TransactionManager(adapter),
      audit,
    );
  });
  beforeEach(async () => {
    mainId = randomUUID();
    demoId = randomUUID();
    slug = `synthetic-${randomUUID()}`;
    const product = await prisma.product.create({
      data: {
        title: "Synthetic free course",
        slug,
        description: "Synthetic course description",
        type: "VIDEO_COURSE",
        contentProvider: "YOUTUBE",
        priceCents: 0,
        discountPriceCents: null,
        contentS3Key: "",
        isPublished: true,
        courseLessons: {
          create: [
            {
              id: mainId,
              title: "Main lesson",
              summary: "",
              access: "ENROLLED",
              position: 1,
              youtubeVideoId: "MainVid_001",
            },
            {
              id: demoId,
              title: "Demo lesson",
              summary: "",
              access: "PUBLIC_DEMO",
              position: 2,
              youtubeVideoId: "DemoVid_001",
            },
          ],
        },
      },
    });
    productId = product.id;
    productIds.push(productId);
  });
  afterAll(async () => {
    if (!prisma) return;
    await prisma.auditLog.deleteMany({
      where: { userId: { in: [a.sub, b.sub] } },
    });
    await prisma.courseEnrollment.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.courseLesson.deleteMany({
      where: { productId: { in: productIds } },
    });
    await prisma.product.deleteMany({ where: { id: { in: productIds } } });
    await prisma.user.deleteMany({ where: { id: { in: [a.sub, b.sub] } } });
    await prisma.$disconnect();
  });
  it("keeps sources out of public outlines and restricts demo playback to the matching lesson", async () => {
    expect(JSON.stringify(await service.bySlug(slug))).not.toContain(
      "MainVid_001",
    );
    expect(JSON.stringify(await service.list({ limit: 50 }))).not.toContain(
      "DemoVid_001",
    );
    expect((await service.demoPlayback(productId, demoId)).videoId).toBe(
      "DemoVid_001",
    );
    await expect(service.demoPlayback(productId, mainId)).rejects.toThrow();
    await expect(service.demoPlayback(randomUUID(), demoId)).rejects.toThrow();
  });
  it("creates one membership/audit under concurrent retries and isolates each user library", async () => {
    const results = await Promise.all([
      service.enroll(a, productId),
      service.enroll(a, productId),
    ]);
    expect(results[0].id).toBe(results[1].id);
    expect(
      await prisma.courseEnrollment.count({
        where: { userId: a.sub, productId },
      }),
    ).toBe(1);
    expect(
      await prisma.auditLog.count({
        where: {
          userId: a.sub,
          entityId: results[0].id,
          action: "COURSE_ENROLLED",
        },
      }),
    ).toBe(1);
    expect(
      (await service.myCourses(a, { limit: 20 })).items.map((row) => row.id),
    ).toContain(productId);
    expect((await service.myCourses(b, { limit: 20 })).items).toHaveLength(0);
    await expect(
      service.lessonPlayback(b, productId, mainId),
    ).rejects.toThrow();
    expect((await service.lessonPlayback(a, productId, mainId)).videoId).toBe(
      "MainVid_001",
    );
    expect((await service.myDetail(b, productId)).enrollment).toBeNull();
  });
  it("rolls back registration when audit fails and permits a safe retry", async () => {
    const spy = jest
      .spyOn(audit, "record")
      .mockRejectedValueOnce(new Error("Synthetic audit failure"));
    await expect(service.enroll(a, productId)).rejects.toThrow(
      "Synthetic audit failure",
    );
    spy.mockRestore();
    expect(
      await prisma.courseEnrollment.count({
        where: { userId: a.sub, productId },
      }),
    ).toBe(0);
    expect((await service.enroll(a, productId)).productId).toBe(productId);
  });
  it("hides unpublished courses without deleting memberships", async () => {
    await service.enroll(a, productId);
    await prisma.product.update({
      where: { id: productId },
      data: { isPublished: false },
    });
    await expect(
      service.lessonPlayback(a, productId, mainId),
    ).rejects.toThrow();
    await expect(service.enroll(b, productId)).rejects.toThrow();
    expect(
      (await service.myCourses(a, { limit: 50 })).items.some(
        (row) => row.id === productId,
      ),
    ).toBe(false);
    expect(
      await prisma.courseEnrollment.count({
        where: { userId: a.sub, productId },
      }),
    ).toBe(1);
  });
  it("rejects revoked identity versions and suspended accounts", async () => {
    await prisma.user.update({
      where: { id: b.sub },
      data: { authorizationVersion: { increment: 1 } },
    });
    await expect(service.enroll(b, productId)).rejects.toThrow();
    await prisma.user.update({
      where: { id: b.sub },
      data: { status: "SUSPENDED" },
    });
    await expect(
      service.myCourses({ ...b, authorizationVersion: 1 }, { limit: 20 }),
    ).rejects.toThrow();
  });
});
