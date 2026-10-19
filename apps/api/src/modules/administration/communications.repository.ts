import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  EditorialCreate,
  EditorialDraft,
  EditorialQuery,
  CommunicationsQuery,
  NotificationQuery,
  SupportCreate,
  SupportQuery,
  editorialDetailSchema,
  editorialDraftSchema,
  editorialListSchema,
  publicEditorialSchema,
  publicEditorialListSchema,
  notificationListSchema,
  notificationRowSchema,
  supportDetailSchema,
  supportListSchema,
} from "@vetralink/shared-types";
import { PrismaService } from "../prisma/prisma.service";

const json = (v: unknown): unknown => JSON.parse(JSON.stringify(v));
const identitySelect = { id: true, name: true, deletedAt: true } as const;
const identity = (
  v: { id: string; name: string; deletedAt: Date | null } | null,
) => (v && !v.deletedAt ? { id: v.id, name: v.name } : null);
const ticketSelect = {
  id: true,
  subject: true,
  category: true,
  status: true,
  version: true,
  requesterId: true,
  requester: { select: identitySelect },
  assignee: { select: identitySelect },
  farmId: true,
  orderId: true,
  createdAt: true,
  updatedAt: true,
} as const;
const projectTicket = (
  r: Prisma.SupportTicketGetPayload<{ select: typeof ticketSelect }>,
) => ({
  ...r,
  requester: identity(r.requester),
  assignee: identity(r.assignee),
});
function eligibleRoleRetry(
  r: {
    recipient: { id: string; role: string; authorizationVersion: number };
    outbox: {
      eventType: string;
      targetUserId: string | null;
      authorizationVersion: number | null;
    };
  },
  pendingRequest: boolean,
) {
  if (r.outbox.eventType === "ROLE_REQUEST_SUBMITTED")
    return (
      pendingRequest && ["ADMIN", "SUPER_ADMIN"].includes(r.recipient.role)
    );
  return (
    [
      "ROLE_REQUEST_APPROVED",
      "ROLE_REQUEST_REJECTED",
      "PRIVILEGED_ROLE_CHANGED",
    ].includes(r.outbox.eventType) &&
    r.outbox.targetUserId === r.recipient.id &&
    (r.outbox.authorizationVersion === null ||
      r.outbox.authorizationVersion === r.recipient.authorizationVersion)
  );
}

@Injectable()
export class CommunicationsRepository {
  constructor(private readonly prisma: PrismaService) {}
  private editorialRow(r: {
    id: string;
    kind: string;
    slug: string;
    draft: Prisma.JsonValue;
    version: number;
    publishedAt: Date | null;
    updatedAt: Date;
  }) {
    const draft = editorialDraftSchema.parse(r.draft);
    return {
      id: r.id,
      kind: r.kind,
      slug: r.slug,
      title: { bn: draft.bn.title, en: draft.en.title },
      version: r.version,
      publishedAt: r.publishedAt,
      updatedAt: r.updatedAt,
    };
  }
  async contentList(q: EditorialQuery) {
    const rows = await this.prisma.editorialDocument.findMany({
      where: {
        ...(q.cursor ? { id: { gt: q.cursor } } : {}),
        ...(q.kind ? { kind: q.kind } : {}),
        ...(q.search
          ? {
              OR: [
                { slug: { contains: q.search } },
                { draft: { path: ["bn", "title"], string_contains: q.search } },
                { draft: { path: ["en", "title"], string_contains: q.search } },
              ],
            }
          : {}),
      },
      orderBy: { id: "asc" },
      take: q.limit + 1,
    });
    return editorialListSchema.parse(
      json({
        items: rows.slice(0, q.limit).map((r) => this.editorialRow(r)),
        nextCursor: rows.length > q.limit ? rows[q.limit - 1].id : null,
      }),
    );
  }
  async content(id: string, tx: Prisma.TransactionClient) {
    const r = await tx.editorialDocument.findUnique({
      where: { id },
      include: { revisions: { orderBy: { version: "desc" }, take: 21 } },
    });
    if (!r) return null;
    return editorialDetailSchema.parse(
      json({
        ...this.editorialRow(r),
        draft: r.draft,
        published: r.published,
        subjectUserId: r.subjectUserId,
        revisions: r.revisions.slice(0, 20).map((v) => ({
          version: v.version,
          draft: v.draft,
          createdAt: v.createdAt,
        })),
        revisionsTruncated: r.revisions.length > 20,
      }),
    );
  }
  async createContent(input: EditorialCreate, tx: Prisma.TransactionClient) {
    await tx.editorialDocument.create({
      data: {
        id: input.id,
        kind: input.kind,
        slug: input.slug,
        draft: input.draft,
        subjectUserId: input.subjectUserId,
        revisions: { create: { version: 1, draft: input.draft } },
      },
    });
  }
  async lockContent(id: string, tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT id FROM editorial_documents WHERE id=${id}::uuid FOR UPDATE`;
  }
  async saveContent(
    id: string,
    expected: number,
    draft: EditorialDraft,
    tx: Prisma.TransactionClient,
  ) {
    const result = await tx.editorialDocument.updateMany({
      where: { id, version: expected },
      data: { draft, version: { increment: 1 } },
    });
    if (result.count)
      await tx.editorialRevision.create({
        data: { documentId: id, version: expected + 1, draft },
      });
    return result.count;
  }
  async publishContent(
    id: string,
    expected: number,
    published: EditorialDraft | null,
    subjectVersion: number | null,
    tx: Prisma.TransactionClient,
  ) {
    return (
      await tx.editorialDocument.updateMany({
        where: { id, version: expected },
        data: {
          published: published ?? Prisma.DbNull,
          publishedAt: published ? new Date() : null,
          publishedSubjectVersion: subjectVersion,
          version: { increment: 1 },
        },
      })
    ).count;
  }
  async vetEligibility(id: string, tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT id FROM users WHERE id=${id}::uuid FOR UPDATE`;
    return tx.user.findUnique({
      where: { id },
      select: {
        role: true,
        status: true,
        deletedAt: true,
        authorizationVersion: true,
        vetProfile: { select: { licenseNumber: true } },
      },
    });
  }
  async publicList(kind: string, q: CommunicationsQuery) {
    const rows = await this.prisma.editorialDocument.findMany({
      where: {
        kind,
        publishedAt: { not: null },
        ...(q.cursor ? { id: { gt: q.cursor } } : {}),
        ...(q.search
          ? {
              OR: [
                { slug: { contains: q.search } },
                {
                  published: {
                    path: ["bn", "title"],
                    string_contains: q.search,
                  },
                },
                {
                  published: {
                    path: ["en", "title"],
                    string_contains: q.search,
                  },
                },
              ],
            }
          : {}),
      },
      include: {
        subject: {
          select: {
            role: true,
            status: true,
            deletedAt: true,
            authorizationVersion: true,
          },
        },
      },
      orderBy: { id: "asc" },
      take: q.limit + 1,
    });
    return publicEditorialListSchema.parse(
      json({
        items: rows.slice(0, q.limit).flatMap((r) => {
          const value = this.publicProjection(r);
          return value ? [value] : [];
        }),
        nextCursor: rows.length > q.limit ? rows[q.limit - 1].id : null,
      }),
    );
  }
  private publicProjection(
    r: Prisma.EditorialDocumentGetPayload<{
      include: {
        subject: {
          select: {
            role: true;
            status: true;
            deletedAt: true;
            authorizationVersion: true;
          };
        };
      };
    }>,
  ) {
    if (
      !r.published ||
      !r.publishedAt ||
      (r.kind === "VET" &&
        (!r.subject ||
          r.subject.role !== "VET" ||
          r.subject.status !== "ACTIVE" ||
          r.subject.deletedAt ||
          r.subject.authorizationVersion !== r.publishedSubjectVersion))
    )
      return null;
    return publicEditorialSchema.parse(
      json({
        id: r.id,
        kind: r.kind,
        slug: r.slug,
        content: r.published,
        publishedAt: r.publishedAt,
        verified: r.kind === "VET",
      }),
    );
  }
  async publicContent(kind: string, slug: string) {
    const row = await this.prisma.editorialDocument.findUnique({
      where: { kind_slug: { kind, slug } },
      include: {
        subject: {
          select: {
            role: true,
            status: true,
            deletedAt: true,
            authorizationVersion: true,
          },
        },
      },
    });
    return row ? this.publicProjection(row) : null;
  }
  async notificationList(q: NotificationQuery) {
    const whereId = q.cursor ? { id: { gt: q.cursor } } : {};
    if (q.source === "ROLE_EMAIL") {
      if (q.status === "RECORDED_UNVERIFIED")
        return { items: [], nextCursor: null };
      const rows = await this.prisma.roleNotificationDelivery.findMany({
        where: {
          ...whereId,
          ...(q.status
            ? { status: q.status === "ACCEPTED" ? "SENT" : q.status }
            : {}),
        },
        include: {
          recipient: {
            select: {
              ...identitySelect,
              status: true,
              role: true,
              authorizationVersion: true,
            },
          },
          outbox: true,
        },
        orderBy: { id: "asc" },
        take: q.limit + 1,
      });
      const requests = await this.prisma.roleUpgradeRequest.findMany({
        where: {
          id: {
            in: rows.flatMap((r) =>
              r.outbox.requestId ? [r.outbox.requestId] : [],
            ),
          },
          status: "PENDING",
        },
        select: { id: true },
        take: 21,
      });
      const pending = new Set(requests.map((r) => r.id));
      return notificationListSchema.parse(
        json({
          items: rows
            .slice(0, q.limit)
            .map((r) =>
              this.roleNotification(
                r,
                eligibleRoleRetry(
                  r,
                  !!r.outbox.requestId && pending.has(r.outbox.requestId),
                ),
              ),
            ),
          nextCursor: rows.length > q.limit ? rows[q.limit - 1].id : null,
        }),
      );
    }
    if (
      q.status &&
      !["FAILED", "PENDING", "RECORDED_UNVERIFIED"].includes(q.status)
    )
      return { items: [], nextCursor: null };
    const rows = await this.prisma.consultationNotificationLog.findMany({
      where: {
        ...whereId,
        ...(q.status
          ? {
              status:
                q.status === "RECORDED_UNVERIFIED"
                  ? "SENT"
                  : (q.status as "FAILED" | "PENDING"),
            }
          : {}),
      },
      select: {
        id: true,
        vet: { select: identitySelect },
        channel: true,
        status: true,
        dispatchedAt: true,
      },
      orderBy: { id: "asc" },
      take: q.limit + 1,
    });
    return notificationListSchema.parse(
      json({
        items: rows.slice(0, q.limit).map((r) => ({
          id: r.id,
          source: "CONSULTATION",
          status: r.status === "SENT" ? "RECORDED_UNVERIFIED" : r.status,
          recipient: identity(r.vet),
          channel: r.channel,
          category: "CONSULTATION_NOTIFICATION",
          attempts: 0,
          createdAt: r.dispatchedAt,
          acceptedAt: null,
          generation: 0,
          canRetry: false,
        })),
        nextCursor: rows.length > q.limit ? rows[q.limit - 1].id : null,
      }),
    );
  }
  private roleNotification(
    r: Prisma.RoleNotificationDeliveryGetPayload<{
      include: {
        recipient: {
          select: typeof identitySelect & { status: true; role: true };
        };
        outbox: true;
      };
    }>,
    eligible: boolean,
  ) {
    return notificationRowSchema.parse(
      json({
        id: r.id,
        source: "ROLE_EMAIL",
        status: r.status === "SENT" ? "ACCEPTED" : r.status,
        recipient: identity(r.recipient),
        channel: "EMAIL",
        category: r.outbox.eventType,
        attempts: r.attempts,
        createdAt: r.outbox.createdAt,
        acceptedAt: r.sentAt,
        generation: r.retryGeneration,
        canRetry:
          r.status === "FAILED" &&
          !r.recipient.deletedAt &&
          r.recipient.status === "ACTIVE" &&
          eligible,
      }),
    );
  }
  async retryNotification(
    id: string,
    generation: number,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$queryRaw`SELECT id FROM role_notification_deliveries WHERE id=${id}::uuid FOR UPDATE`;
    const r = await tx.roleNotificationDelivery.findUnique({
      where: { id },
      include: {
        recipient: {
          select: {
            ...identitySelect,
            status: true,
            role: true,
            authorizationVersion: true,
          },
        },
        outbox: true,
      },
    });
    if (!r) return null;
    const request = r.outbox.requestId
      ? await tx.roleUpgradeRequest.findUnique({
          where: { id: r.outbox.requestId },
          select: { status: true },
        })
      : null;
    const projected = this.roleNotification(
      r,
      eligibleRoleRetry(r, request?.status === "PENDING"),
    );
    if (!projected.canRetry || r.retryGeneration !== generation) return null;
    const changed = await tx.roleNotificationDelivery.updateMany({
      where: { id, status: "FAILED", retryGeneration: generation },
      data: {
        status: "PENDING",
        retryGeneration: { increment: 1 },
        errorCode: null,
        nextAttemptAt: new Date(),
      },
    });
    if (!changed.count) return null;
    await tx.roleNotificationOutbox.update({
      where: { id: r.outboxId },
      data: { completedAt: null, availableAt: new Date(), lastErrorCode: null },
    });
    return {
      ...projected,
      status: "PENDING" as const,
      generation: generation + 1,
      canRetry: false,
    };
  }
  async supportList(q: SupportQuery, requesterId?: string) {
    const rows = await this.prisma.supportTicket.findMany({
      where: {
        ...(requesterId ? { requesterId } : {}),
        ...(q.cursor ? { id: { gt: q.cursor } } : {}),
        ...(q.status ? { status: q.status } : {}),
        ...(q.search
          ? { subject: { contains: q.search, mode: "insensitive" } }
          : {}),
      },
      select: ticketSelect,
      orderBy: { id: "asc" },
      take: q.limit + 1,
    });
    return supportListSchema.parse(
      json({
        items: rows.slice(0, q.limit).map(projectTicket),
        nextCursor: rows.length > q.limit ? rows[q.limit - 1].id : null,
      }),
    );
  }
  async support(
    id: string,
    tx: Prisma.TransactionClient,
    requesterId?: string,
  ) {
    const row = await tx.supportTicket.findFirst({
      where: { id, ...(requesterId ? { requesterId } : {}) },
      select: {
        ...ticketSelect,
        messages: {
          where: requesterId ? { internal: false } : {},
          select: {
            id: true,
            author: { select: identitySelect },
            body: true,
            internal: true,
            createdAt: true,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 51,
        },
      },
    });
    if (!row) return null;
    const events = requesterId
      ? []
      : await tx.auditLog.findMany({
          where: {
            entityType: "SupportTicket",
            entityId: id,
            action: {
              in: [
                "SUPPORT_TICKET_CREATED",
                "SUPPORT_MESSAGE_ADDED",
                "SUPPORT_ADMIN_UPDATED",
              ],
            },
          },
          select: {
            id: true,
            action: true,
            user: { select: identitySelect },
            newValues: true,
            createdAt: true,
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 21,
        });
    return supportDetailSchema.parse(
      json({
        ...projectTicket(row),
        messages: row.messages
          .slice(0, 50)
          .reverse()
          .map((m) => ({ ...m, author: identity(m.author) })),
        messagesTruncated: row.messages.length > 50,
        events: events.slice(0, 20).map((e) => {
          const v =
            e.newValues &&
            typeof e.newValues === "object" &&
            !Array.isArray(e.newValues)
              ? e.newValues
              : {};
          return {
            id: e.id,
            action:
              e.action === "SUPPORT_TICKET_CREATED"
                ? "CREATED"
                : e.action === "SUPPORT_MESSAGE_ADDED"
                  ? "MESSAGE"
                  : v.action,
            actor: identity(e.user),
            status: typeof v.status === "string" ? v.status : null,
            assigneeId: typeof v.assigneeId === "string" ? v.assigneeId : null,
            createdAt: e.createdAt,
          };
        }),
        eventsTruncated: events.length > 20,
      }),
    );
  }
  async supportLinks(
    requesterId: string,
    input: SupportCreate,
    tx: Prisma.TransactionClient,
  ) {
    if (
      input.farmId &&
      !(await tx.farmMember.findFirst({
        where: {
          farmId: input.farmId,
          userId: requesterId,
          farm: { deletedAt: null },
        },
        select: { id: true },
      }))
    )
      return false;
    if (
      input.orderId &&
      !(await tx.order.findFirst({
        where: { id: input.orderId, userId: requesterId },
        select: { id: true },
      }))
    )
      return false;
    return true;
  }
  async createSupport(
    requesterId: string,
    input: SupportCreate,
    tx: Prisma.TransactionClient,
  ) {
    return tx.supportTicket.create({
      data: {
        id: input.id,
        requesterId,
        subject: input.subject,
        category: input.category,
        farmId: input.farmId,
        orderId: input.orderId,
        messages: {
          create: {
            id: input.messageId,
            authorId: requesterId,
            body: input.body,
          },
        },
      },
    });
  }
  async lockSupport(id: string, tx: Prisma.TransactionClient) {
    await tx.$queryRaw`SELECT id FROM support_tickets WHERE id=${id}::uuid FOR UPDATE`;
  }
  async supportAssignment(id: string, tx: Prisma.TransactionClient) {
    return (
      await tx.supportTicket.findUniqueOrThrow({
        where: { id },
        select: { assigneeId: true },
      })
    ).assigneeId;
  }
  async updateSupport(
    id: string,
    expected: number,
    change: { status?: string; assigneeId?: string | null },
    tx: Prisma.TransactionClient,
  ) {
    return (
      await tx.supportTicket.updateMany({
        where: { id, version: expected },
        data: { ...change, version: { increment: 1 } },
      })
    ).count;
  }
  async supportMessage(
    id: string,
    ticketId: string,
    authorId: string,
    body: string,
    internal: boolean,
    tx: Prisma.TransactionClient,
  ) {
    await tx.supportMessage.create({
      data: { id, ticketId, authorId, body, internal },
    });
  }
}
