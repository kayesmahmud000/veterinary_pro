import { randomUUID } from "crypto";
import { PrismaClient } from "@prisma/client";
import {
  JwtPayload,
  UserRole,
  EditorialCreate,
  editorialActionSchema,
  editorialCreateSchema,
  supportActionSchema,
} from "@vetralink/shared-types";
import { CommunicationsRepository } from "./communications.repository";
import { CommunicationsService } from "./communications.service";
import { PrismaService } from "../prisma/prisma.service";
import { UserRepository } from "../users/repositories/user.repository";
import { BcryptPasswordHasher } from "../auth/services/bcrypt-password-hasher.service";
import { AuditLogRepository } from "../audit/repositories/audit-log.repository";
import { TransactionManager } from "../prisma/transaction/transaction.manager";
import { RoleNotificationRepository } from "../role-notifications/role-notification.repository";
const url = process.env.COMMUNICATIONS_TEST_DATABASE_URL;
if (
  url &&
  (!["127.0.0.1", "localhost"].includes(new URL(url).hostname) ||
    new URL(url).pathname !== "/adm7_test")
)
  throw new Error("Explicit disposable loopback /adm7_test required");
const text = {
  title: "Synthetic <script>escaped title</script>",
  summary: "Synthetic bilingual summary",
  body: "Plain text <img src=x onerror=alert(1)>\nSecond paragraph",
};
const draft = () => ({ bn: { ...text }, en: { ...text } });
const password = "Synthetic ADM7 password!";
const confirmation = {
  actorPassword: password,
  reason: "Reviewed synthetic operation",
  confirmed: true as const,
};
describe("ADM7 strict shared contracts", () => {
  it("rejects cross-action fields, missing confirmation, hidden output and invalid subjects", () => {
    expect(
      editorialCreateSchema.safeParse({
        id: randomUUID(),
        kind: "BLOG",
        slug: "valid-slug",
        draft: draft(),
        subjectUserId: randomUUID(),
      }).success,
    ).toBe(false);
    expect(
      editorialActionSchema.safeParse({
        ...confirmation,
        confirmed: false,
        expectedVersion: 1,
        action: "PUBLISH",
      }).success,
    ).toBe(false);
    expect(
      supportActionSchema.safeParse({
        ...confirmation,
        expectedVersion: 1,
        action: "STATUS",
        status: "CLOSED",
        body: "Not permitted",
      }).success,
    ).toBe(false);
    expect(
      editorialCreateSchema.safeParse({
        id: randomUUID(),
        kind: "PAGE",
        slug: "valid-slug",
        draft: { ...draft(), bn: { ...text, body: "\u0000" } },
      }).success,
    ).toBe(false);
  });
});
(url ? describe : describe.skip)(
  "ADM7 real PostgreSQL privacy, concurrency and rollback",
  () => {
    let db: PrismaClient,
      repo: CommunicationsRepository,
      service: CommunicationsService,
      audit: AuditLogRepository,
      roleRepo: RoleNotificationRepository;
    let admin: JwtPayload,
      superAdmin: JwtPayload,
      learner: JwtPayload,
      other: JwtPayload,
      vet: JwtPayload;
    const userIds: string[] = [],
      docIds: string[] = [],
      ticketIds: string[] = [],
      outboxIds: string[] = [],
      deliveryIds: string[] = [];
    const hasher = new BcryptPasswordHasher();
    beforeAll(async () => {
      db = new PrismaClient({ datasources: { db: { url } } });
      const hash = await hasher.hash(password),
        adapter = db as unknown as PrismaService;
      async function user(role: UserRole) {
        const u = await db.user.create({
          data: {
            role,
            name: `Synthetic ADM7 ${role}`,
            email: `${randomUUID()}@adm7.example.test`,
            passwordHash: hash,
          },
        });
        userIds.push(u.id);
        return { sub: u.id, role, authorizationVersion: 0 } as JwtPayload;
      }
      admin = await user(UserRole.ADMIN);
      superAdmin = await user(UserRole.SUPER_ADMIN);
      learner = await user(UserRole.LEARNER);
      other = await user(UserRole.BUYER);
      vet = await user(UserRole.VET);
      await db.vetProfile.create({
        data: { userId: vet.sub, licenseNumber: "SYNTHETIC-ADM7" },
      });
      repo = new CommunicationsRepository(adapter);
      audit = new AuditLogRepository(adapter);
      roleRepo = new RoleNotificationRepository(adapter, audit);
      service = new CommunicationsService(
        repo,
        new UserRepository(adapter, {} as never),
        hasher,
        new TransactionManager(adapter),
        audit,
        { hit: async () => undefined } as never,
      );
    }, 30000);
    afterEach(() => jest.restoreAllMocks());
    afterAll(async () => {
      if (!db) return;
      await db.auditLog.deleteMany({ where: { userId: { in: userIds } } });
      await db.editorialRevision.deleteMany({
        where: { documentId: { in: docIds } },
      });
      await db.editorialDocument.deleteMany({ where: { id: { in: docIds } } });
      await db.supportMessage.deleteMany({
        where: { ticketId: { in: ticketIds } },
      });
      await db.supportTicket.deleteMany({ where: { id: { in: ticketIds } } });
      await db.roleNotificationDelivery.deleteMany({
        where: { outboxId: { in: outboxIds } },
      });
      await db.roleNotificationOutbox.deleteMany({
        where: { id: { in: outboxIds } },
      });
      await db.vetProfile.deleteMany({ where: { userId: { in: userIds } } });
      await db.user.deleteMany({ where: { id: { in: userIds } } });
      await db.$disconnect();
    });
    async function content(kind: EditorialCreate["kind"] = "BLOG") {
      const id = randomUUID();
      docIds.push(id);
      return service.createContent(admin, {
        id,
        kind,
        slug: `synthetic-${randomUUID()}`,
        draft: draft(),
        ...(kind === "VET" ? { subjectUserId: vet.sub } : {}),
      });
    }
    async function ticket() {
      const id = randomUUID();
      ticketIds.push(id);
      return service.createSupport(learner, {
        id,
        messageId: randomUUID(),
        subject: "Synthetic support question",
        category: "ACCOUNT",
        body: "Requester message",
      });
    }
    async function delivery() {
      const event = await db.roleNotificationOutbox.create({
        data: {
          eventKey: randomUUID(),
          eventType: "ROLE_REQUEST_APPROVED",
          targetUserId: learner.sub,
          completedAt: new Date(),
        },
      });
      outboxIds.push(event.id);
      const r = await db.roleNotificationDelivery.create({
        data: {
          outboxId: event.id,
          recipientUserId: learner.sub,
          status: "FAILED",
          attempts: 5,
          providerMessageId: "PRIVATE-PROVIDER",
          errorCode: "PRIVATE-CONFIG",
        },
      });
      deliveryIds.push(r.id);
      return r;
    }
    it("keeps drafts private, pins published snapshots across edits and removes publication", async () => {
      const r = await content();
      expect(await repo.publicContent("BLOG", r.slug)).toBeNull();
      const published = await service.actionContent(admin, r.id, {
        ...confirmation,
        expectedVersion: 1,
        action: "PUBLISH",
      });
      const changed = {
        bn: { ...text, body: "PRIVATE-DRAFT" },
        en: { ...text, body: "PRIVATE-DRAFT" },
      };
      const saved = await service.saveContent(admin, r.id, {
        expectedVersion: published.version,
        draft: changed,
      });
      expect(saved.revisions).toHaveLength(2);
      const publicRow = await repo.publicContent("BLOG", r.slug);
      expect(publicRow!.content.bn.body).toContain("<img");
      expect(JSON.stringify(publicRow)).not.toContain("PRIVATE-DRAFT");
      expect(Object.keys(publicRow!)).not.toContain("subjectUserId");
      await service.actionContent(superAdmin, r.id, {
        ...confirmation,
        expectedVersion: saved.version,
        action: "UNPUBLISH",
      });
      expect(await repo.publicContent("BLOG", r.slug)).toBeNull();
    });
    it("rejects incomplete bilingual publication and reserved authored slugs", async () => {
      const r = await content("GUIDE");
      await service.saveContent(admin, r.id, {
        expectedVersion: 1,
        draft: { ...draft(), en: { ...text, body: "" } },
      });
      await expect(
        service.actionContent(admin, r.id, {
          ...confirmation,
          expectedVersion: 2,
          action: "PUBLISH",
        }),
      ).rejects.toMatchObject({ errorCode: "CONTENT_INCOMPLETE" });
      await expect(
        service.createContent(admin, {
          id: randomUUID(),
          kind: "BLOG",
          slug: "one-place-for-farm-notes",
          draft: draft(),
        }),
      ).rejects.toMatchObject({ errorCode: "CONTENT_RESERVED_SLUG" });
    });
    it("permits exactly one concurrent versioned draft save", async () => {
      const r = await content();
      const saves = await Promise.allSettled(
        [admin, superAdmin].map((a) =>
          service.saveContent(a, r.id, { expectedVersion: 1, draft: draft() }),
        ),
      );
      expect(saves.filter((v) => v.status === "fulfilled")).toHaveLength(1);
      expect((await service.content(admin, r.id)).version).toBe(2);
    });
    it("rolls back a draft and its revision when audit persistence fails", async () => {
      const r = await content();
      jest
        .spyOn(audit, "record")
        .mockRejectedValueOnce(new Error("Synthetic audit failure"));
      await expect(
        service.saveContent(admin, r.id, {
          expectedVersion: 1,
          draft: { ...draft(), en: { ...text, title: "Not persisted" } },
        }),
      ).rejects.toThrow("audit failure");
      const current = await service.content(admin, r.id);
      expect(current.version).toBe(1);
      expect(current.revisions).toHaveLength(1);
    });
    it("requires veterinary verification and hides publication on identity version changes", async () => {
      const r = await content("VET");
      await expect(
        service.actionContent(admin, r.id, {
          ...confirmation,
          expectedVersion: 1,
          action: "PUBLISH",
        }),
      ).rejects.toMatchObject({ errorCode: "VET_VERIFICATION_REQUIRED" });
      await service.actionContent(admin, r.id, {
        ...confirmation,
        expectedVersion: 1,
        action: "PUBLISH",
        verified: true,
        verificationNote: "Synthetic verification completed",
      });
      expect((await repo.publicContent("VET", r.slug))!.verified).toBe(true);
      await db.user.update({
        where: { id: vet.sub },
        data: { authorizationVersion: { increment: 1 } },
      });
      expect(await repo.publicContent("VET", r.slug)).toBeNull();
      expect(
        (await repo.publicList("VET", { limit: 20 })).items.some(
          (v) => v.id === r.id,
        ),
      ).toBe(false);
    });
    it("denies ordinary roles and outdated/suspended admin identities", async () => {
      await expect(
        service.listContent(learner, { limit: 20 }),
      ).rejects.toMatchObject({ errorCode: "FORBIDDEN_OPERATION" });
      await expect(
        service.listContent(
          { ...admin, authorizationVersion: 99 },
          { limit: 20 },
        ),
      ).rejects.toMatchObject({ errorCode: "FORBIDDEN_OPERATION" });
      await db.user.update({
        where: { id: admin.sub },
        data: { status: "SUSPENDED" },
      });
      await expect(
        service.notifications(admin, { limit: 20, source: "ROLE_EMAIL" }),
      ).rejects.toMatchObject({ errorCode: "FORBIDDEN_OPERATION" });
      await db.user.update({
        where: { id: admin.sub },
        data: { status: "ACTIVE" },
      });
    });
    it("rejects foreign ticket access and forged domain pointers", async () => {
      const r = await ticket();
      await expect(service.support(other, r.id, false)).rejects.toMatchObject({
        errorCode: "ENTITY_NOT_FOUND",
      });
      expect(
        (await service.listSupport(other, { limit: 20 }, false)).items,
      ).toHaveLength(0);
      await expect(
        service.createSupport(learner, {
          id: randomUUID(),
          messageId: randomUUID(),
          subject: "Foreign order reference",
          category: "ORDER",
          body: "Synthetic question",
          orderId: randomUUID(),
        }),
      ).rejects.toMatchObject({ errorCode: "SUPPORT_LINK_FORBIDDEN" });
    });
    it("keeps internal notes and action reasons out of requester responses", async () => {
      const r = await ticket();
      await service.actionSupport(admin, r.id, {
        ...confirmation,
        expectedVersion: 1,
        action: "REPLY",
        messageId: randomUUID(),
        body: "PRIVATE-INTERNAL-NOTE",
        internal: true,
      });
      const own = await service.support(learner, r.id, false),
        administrative = await service.support(superAdmin, r.id, true);
      expect(JSON.stringify(own)).not.toContain("PRIVATE-INTERNAL");
      expect(own.messages).toHaveLength(1);
      expect(administrative.messages).toHaveLength(2);
      const reply = await service.replySupport(learner, r.id, {
        expectedVersion: own.version,
        messageId: randomUUID(),
        body: "Public follow-up",
      });
      expect(reply.messages).toHaveLength(2);
    });
    it("supports audited assignment/status, denies non-admin assignees and closed replies", async () => {
      const r = await ticket();
      await expect(
        service.actionSupport(admin, r.id, {
          ...confirmation,
          expectedVersion: 1,
          action: "ASSIGN",
          assigneeId: learner.sub,
        }),
      ).rejects.toMatchObject({ errorCode: "FORBIDDEN_OPERATION" });
      const assigned = await service.actionSupport(admin, r.id, {
        ...confirmation,
        expectedVersion: 1,
        action: "ASSIGN",
        assigneeId: superAdmin.sub,
      });
      expect(assigned.assignee!.id).toBe(superAdmin.sub);
      const closed = await service.actionSupport(admin, r.id, {
        ...confirmation,
        expectedVersion: 2,
        action: "STATUS",
        status: "CLOSED",
      });
      await expect(
        service.replySupport(learner, r.id, {
          expectedVersion: closed.version,
          messageId: randomUUID(),
          body: "Cannot reply",
        }),
      ).rejects.toMatchObject({ errorCode: "COMMUNICATION_CONFLICT" });
      await service.actionSupport(superAdmin, r.id, {
        ...confirmation,
        expectedVersion: 3,
        action: "STATUS",
        status: "OPEN",
      });
    });
    it("can unassign a deleted administrator without exposing their identity", async () => {
      const r = await ticket();
      await service.actionSupport(admin, r.id, {
        ...confirmation,
        expectedVersion: 1,
        action: "ASSIGN",
        assigneeId: superAdmin.sub,
      });
      await db.user.update({
        where: { id: superAdmin.sub },
        data: { deletedAt: new Date() },
      });
      try {
        expect((await service.support(admin, r.id, true)).assignee).toBeNull();
        const cleared = await service.actionSupport(admin, r.id, {
          ...confirmation,
          expectedVersion: 2,
          action: "ASSIGN",
          assigneeId: null,
        });
        expect(cleared.assignee).toBeNull();
        expect(
          (await db.supportTicket.findUniqueOrThrow({ where: { id: r.id } }))
            .assigneeId,
        ).toBeNull();
      } finally {
        await db.user.update({
          where: { id: superAdmin.sub },
          data: { deletedAt: null },
        });
      }
    });
    it("serializes requester/admin replies and rolls back message insertion when audit fails", async () => {
      const r = await ticket();
      const settled = await Promise.allSettled([
        service.replySupport(learner, r.id, {
          expectedVersion: 1,
          messageId: randomUUID(),
          body: "Requester concurrent reply",
        }),
        service.actionSupport(admin, r.id, {
          ...confirmation,
          expectedVersion: 1,
          action: "REPLY",
          messageId: randomUUID(),
          body: "Administrative concurrent reply",
          internal: false,
        }),
      ]);
      expect(settled.filter((v) => v.status === "fulfilled")).toHaveLength(1);
      jest
        .spyOn(audit, "record")
        .mockRejectedValueOnce(new Error("Synthetic audit failure"));
      await expect(
        service.replySupport(learner, r.id, {
          expectedVersion: 2,
          messageId: randomUUID(),
          body: "Rolled back reply",
        }),
      ).rejects.toThrow("audit failure");
      expect(
        (await service.support(learner, r.id, false)).messages,
      ).toHaveLength(2);
    });
    it("projects safe notification evidence, requests one retry and rejects old worker completion", async () => {
      const r = await delivery();
      const list = await service.notifications(admin, {
        source: "ROLE_EMAIL",
        limit: 20,
      });
      expect(JSON.stringify(list)).not.toMatch(
        /PRIVATE-PROVIDER|PRIVATE-CONFIG|example.test/,
      );
      expect(list.items.find((v) => v.id === r.id)!.canRetry).toBe(true);
      const results = await Promise.allSettled(
        [admin, superAdmin].map((a) =>
          service.retry(a, r.id, { ...confirmation, expectedGeneration: 0 }),
        ),
      );
      expect(results.filter((v) => v.status === "fulfilled")).toHaveLength(1);
      await roleRepo.sent(r.id, "OLD-PROVIDER", 0);
      await roleRepo.failed(r.id, true, 0);
      const current = await db.roleNotificationDelivery.findUniqueOrThrow({
        where: { id: r.id },
      });
      expect(current.retryGeneration).toBe(1);
      expect(current.status).toBe("PENDING");
      await roleRepo.sent(r.id, "CURRENT-PROVIDER", 1);
      expect(
        (
          await service.notifications(admin, {
            source: "ROLE_EMAIL",
            status: "ACCEPTED",
            limit: 20,
          })
        ).items.find((v) => v.id === r.id)!.canRetry,
      ).toBe(false);
    });
    it("rolls back retry/outbox changes on audit failure and rejects wrong passwords", async () => {
      const r = await delivery();
      await expect(
        service.retry(admin, r.id, {
          ...confirmation,
          actorPassword: "incorrect",
          expectedGeneration: 0,
        }),
      ).rejects.toMatchObject({ errorCode: "PASSWORD_CONFIRMATION_FAILED" });
      jest
        .spyOn(audit, "record")
        .mockRejectedValueOnce(new Error("Synthetic audit failure"));
      await expect(
        service.retry(admin, r.id, { ...confirmation, expectedGeneration: 0 }),
      ).rejects.toThrow("audit failure");
      expect(
        (
          await db.roleNotificationDelivery.findUniqueOrThrow({
            where: { id: r.id },
          })
        ).status,
      ).toBe("FAILED");
      expect(
        (
          await db.roleNotificationOutbox.findUniqueOrThrow({
            where: { id: r.outboxId },
          })
        ).completedAt,
      ).not.toBeNull();
    });
  },
);
