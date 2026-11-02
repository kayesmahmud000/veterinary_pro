import { PrismaClient } from "@prisma/client";
import { randomUUID, createHash } from "crypto";
import { UserRole, JwtPayload } from "@vetralink/shared-types";
import { AdminCourseEnrollmentsService } from "./admin-course-enrollments.service";
import { AdminCourseEnrollmentsRepository } from "./admin-course-enrollments.repository";
import { CourseEnrollmentWriter } from "./course-enrollment-writer.service";
import { UserRepository } from "../users/repositories/user.repository";
import { BcryptPasswordHasher } from "../auth/services/bcrypt-password-hasher.service";
import { TransactionManager } from "../prisma/transaction/transaction.manager";
import { AuditLogRepository } from "../audit/repositories/audit-log.repository";
import { AuthService } from "../auth/services/auth.service";
import { RefreshTokenRepository } from "../auth/repositories/refresh-token.repository";
import { CoursesService } from "./courses.service";
import { CoursesRepository } from "./courses.repository";
import { YouTubeDurationService } from "./youtube-duration.service";
const url = process.env.ENROLLMENTS_TEST_DATABASE_URL;
if (url) {
  const u = new URL(url);
  if (
    !["127.0.0.1", "localhost"].includes(u.hostname) ||
    u.pathname !== "/course_enrollments_test"
  )
    throw new Error("Explicit task-owned loopback database required.");
}
(url ? describe : describe.skip)(
  "Administrative enrollment PostgreSQL transactions",
  () => {
    jest.setTimeout(60000);
    let p: PrismaClient,
      service: AdminCourseEnrollmentsService,
      users: UserRepository,
      hash: BcryptPasswordHasher,
      audit: AuditLogRepository,
      auth: AuthService,
      learner: CoursesService;
    let claims: JwtPayload,
      productId: string,
      adminPassword = "synthetic-actor-pass";
    const newInput = () => ({
      name: "Synthetic Learner",
      email: `${randomUUID()}@enrollment.example.test`,
      newUserPassword: "synthetic-new-pass",
      actorPassword: adminPassword,
      reason: "Requested synthetic enrollment",
    });
    beforeAll(async () => {
      p = new PrismaClient({ datasources: { db: { url } } });
      hash = new BcryptPasswordHasher();
      const adapter = p as any;
      users = new UserRepository(adapter, {} as any);
      audit = new AuditLogRepository(adapter);
      const transactions = new TransactionManager(adapter);
      service = new AdminCourseEnrollmentsService(
        new AdminCourseEnrollmentsRepository(adapter),
        new CourseEnrollmentWriter(),
        users,
        hash,
        transactions,
        audit,
        { hit: async () => undefined } as any,
        { adminCourseEnrollmentsEnabled: true, redisEnabled: true } as any,
      );
      const admin = await p.user.create({
        data: {
          name: "Synthetic Admin",
          email: `${randomUUID()}@enrollment.example.test`,
          passwordHash: await hash.hash(adminPassword),
          role: "ADMIN",
        },
      });
      claims = {
        sub: admin.id,
        role: UserRole.ADMIN,
        authorizationVersion: 0,
      } as JwtPayload;
      const tokens: any = {
        generateTokens: async () => ({
          accessToken: "synthetic-login-token",
          refreshToken: randomUUID(),
        }),
        hashRefreshToken: (s: string) =>
          createHash("sha256").update(s).digest("hex"),
        getRefreshTokenExpiresAt: () => new Date(Date.now() + 3600000),
      };
      auth = new AuthService(
        users,
        new RefreshTokenRepository(adapter),
        hash,
        tokens,
        transactions,
        {} as any,
        audit,
      );
      learner = new CoursesService(
        new CoursesRepository(adapter),
        users,
        transactions,
        audit,
        new YouTubeDurationService({} as any),
      );
    });
    beforeEach(async () => {
      const c = await p.product.create({
        data: {
          title: "Synthetic course",
          slug: `enrollment-${randomUUID()}`,
          description: "Synthetic free course",
          type: "VIDEO_COURSE",
          contentProvider: "YOUTUBE",
          priceCents: 0,
          currency: "USD",
          contentS3Key: "",
          isPublished: true,
        },
      });
      productId = c.id;
    });
    afterAll(async () => p?.$disconnect());
    it("creates account before enrollment and permits normal login without an admin session mutation", async () => {
      const input = newInput(),
        before = await p.refreshToken.count();
      const result = await service.createUserAndEnroll(
        claims,
        productId,
        input,
      );
      expect(await p.refreshToken.count()).toBe(before);
      const user = await p.user.findUniqueOrThrow({
        where: { email: input.email },
      });
      expect(user).toMatchObject({
        role: "LEARNER",
        status: "ACTIVE",
        isEmailVerified: false,
      });
      expect(user.passwordHash).not.toBe(input.newUserPassword);
      expect(await hash.compare(input.newUserPassword, user.passwordHash)).toBe(
        true,
      );
      expect(result.enrollment).toMatchObject({
        userId: user.id,
        productId,
        status: "ACTIVE",
        source: "ADMIN",
      });
      expect(JSON.stringify(result)).not.toMatch(
        /synthetic-new-pass|passwordHash|refreshToken/,
      );
      const logged = await auth.login({
        email: input.email,
        password: input.newUserPassword,
      });
      expect(logged.user.id).toBe(user.id);
      expect(
        await p.user.findUnique({ where: { id: claims.sub } }),
      ).toMatchObject({ role: "ADMIN" });
    });
    it("rolls back user, membership and first audit when the enrollment audit fails", async () => {
      const input = newInput(),
        original = audit.record.bind(audit);
      const spy = jest
        .spyOn(audit, "record")
        .mockImplementation(async (e, tx) => {
          if (e.action === "COURSE_ENROLLMENT_ADDED")
            throw new Error("Synthetic audit failure");
          return original(e, tx);
        });
      try {
        await expect(
          service.createUserAndEnroll(claims, productId, input),
        ).rejects.toThrow("Synthetic audit failure");
      } finally {
        spy.mockRestore();
      }
      expect(
        await p.user.findUnique({ where: { email: input.email } }),
      ).toBeNull();
    });
    it("rejects duplicate creation including a concurrent public signup without overwriting the winning password", async () => {
      const input = newInput();
      const publicPassword = "synthetic-public-pass";
      const outcomes = await Promise.allSettled([
        service.createUserAndEnroll(claims, productId, input),
        auth.register({
          name: "Public signup",
          email: input.email,
          password: publicPassword,
        }),
      ]);
      expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const user = await p.user.findUniqueOrThrow({
        where: { email: input.email },
      });
      const adminWon = outcomes[0].status === "fulfilled";
      expect(
        await hash.compare(
          adminWon ? input.newUserPassword : publicPassword,
          user.passwordHash,
        ),
      ).toBe(true);
      expect(
        await p.courseEnrollment.count({
          where: { userId: user.id, productId },
        }),
      ).toBe(adminWon ? 1 : 0);
      await expect(
        service.createUserAndEnroll(claims, productId, input),
      ).rejects.toMatchObject({ errorCode: "ACCOUNT_EXISTS" });
    });
    it("revokes one pair, blocks self enrollment, restores only with its current version and preserves ID", async () => {
      const created = await service.createUserAndEnroll(
          claims,
          productId,
          newInput(),
        ),
        userId = created.enrollment.userId,
        id = created.enrollment.id;
      const removed = await service.act(claims, productId, userId, {
        action: "REMOVE",
        expectedVersion: 0,
        actorPassword: adminPassword,
        reason: "Remove synthetic membership",
      });
      expect(removed.enrollment).toMatchObject({
        id,
        status: "REVOKED",
        version: 1,
      });
      await expect(
        learner.enroll(
          { sub: userId, authorizationVersion: 0 } as JwtPayload,
          productId,
        ),
      ).rejects.toMatchObject({ errorCode: "COURSE_ENROLLMENT_REVOKED" });
      expect(
        await service.list(claims, productId, { limit: 20, status: "ALL" }),
      ).toMatchObject({ activeCount: 0, revokedCount: 1 });
      await expect(
        service.act(claims, productId, userId, {
          action: "RESTORE",
          expectedVersion: 0,
          actorPassword: adminPassword,
          reason: "Restore synthetic membership",
        }),
      ).rejects.toMatchObject({ errorCode: "ENROLLMENT_VERSION_CONFLICT" });
      const restored = await service.act(claims, productId, userId, {
        action: "RESTORE",
        expectedVersion: 1,
        actorPassword: adminPassword,
        reason: "Restore synthetic membership",
      });
      expect(restored.enrollment).toMatchObject({
        id,
        status: "ACTIVE",
        version: 2,
        revokedAt: null,
      });
    });
    it("serializes removal with self enrollment and denies paid create without an orphan account", async () => {
      const created = await service.createUserAndEnroll(
          claims,
          productId,
          newInput(),
        ),
        userId = created.enrollment.userId;
      await Promise.allSettled([
        service.act(claims, productId, userId, {
          action: "REMOVE",
          expectedVersion: 0,
          actorPassword: adminPassword,
          reason: "Remove synthetic membership",
        }),
        learner.enroll(
          { sub: userId, authorizationVersion: 0 } as JwtPayload,
          productId,
        ),
      ]);
      expect(
        await p.courseEnrollment.findUnique({
          where: { id: created.enrollment.id },
        }),
      ).toMatchObject({ status: "REVOKED" });
      await p.product.update({
        where: { id: productId },
        data: { isPublished: false, priceCents: 100 },
      });
      const input = newInput();
      await expect(
        service.createUserAndEnroll(claims, productId, input),
      ).rejects.toMatchObject({ errorCode: "COURSE_NOT_ENROLLABLE" });
      expect(
        await p.user.findUnique({ where: { email: input.email } }),
      ).toBeNull();
    });
    it("returns consistent course/user views and bounded exact email candidates", async () => {
      const input = newInput(),
        created = await service.createUserAndEnroll(claims, productId, input);
      const course = await service.list(claims, productId, {
          limit: 1,
          status: "ACTIVE",
        }),
        user = await service.userCourses(claims, created.enrollment.userId, {
          limit: 1,
          status: "ACTIVE",
        }),
        candidates = await service.candidates(claims, productId, {
          email: input.email,
          limit: 20,
        });
      expect(course.items[0].id).toBe(user.items[0].id);
      expect(course.activeCount).toBe(1);
      expect(candidates.items).toHaveLength(1);
      expect(candidates.items[0]).toMatchObject({
        canAdd: false,
        enrollment: { status: "ACTIVE", version: 0 },
      });
    });
    it("paginates over100 real memberships without duplicates and excludes deleted identities from totals", async () => {
      const seed = Array.from({ length: 105 }, (_, i) => ({
        id: randomUUID(),
        name: `Synthetic page learner ${i}`,
        email: `${randomUUID()}@enrollment.example.test`,
        passwordHash: "synthetic-page-hash",
      }));
      await p.user.createMany({ data: seed });
      await p.courseEnrollment.createMany({
        data: seed.map((u) => ({ userId: u.id, productId })),
      });
      const first = await service.list(claims, productId, {
        limit: 100,
        status: "ACTIVE",
      });
      expect(first.activeCount).toBe(105);
      expect(first.items).toHaveLength(100);
      expect(first.nextCursor).toBeTruthy();
      const second = await service.list(claims, productId, {
        limit: 100,
        status: "ACTIVE",
        cursor: first.nextCursor!,
      });
      expect(second.items).toHaveLength(5);
      expect(
        new Set([...first.items, ...second.items].map((r) => r.id)).size,
      ).toBe(105);
      await p.user.update({
        where: { id: seed[0].id },
        data: { deletedAt: new Date() },
      });
      expect(
        (await service.list(claims, productId, { limit: 20, status: "ALL" }))
          .activeCount,
      ).toBe(104);
      const plans = await p.$queryRaw<
        Array<Record<string, unknown>>
      >`EXPLAIN (FORMAT JSON) SELECT id FROM course_enrollments WHERE product_id=${productId}::uuid AND status='ACTIVE' ORDER BY id LIMIT 21`;
      expect(plans).toHaveLength(1);
    });
  },
);
