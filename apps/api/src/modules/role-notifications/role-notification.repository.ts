import { Inject, Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../audit/repositories/audit-log.repository.interface";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
export type RoleEvent = {
  eventKey: string;
  eventType: string;
  requestId?: string;
  targetUserId?: string;
  authorizationVersion?: number;
  locale?: string;
};
@Injectable()
export class RoleNotificationRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_LOG_REPOSITORY) private readonly audit: IAuditLogRepository,
  ) {}
  add(event: RoleEvent, tx: Prisma.TransactionClient) {
    return tx.roleNotificationOutbox.create({ data: event });
  }
  async claim() {
    return this.prisma.$transaction(async (tx) => {
      const ids = await tx.$queryRaw<
        Array<{ id: string }>
      >`SELECT id FROM role_notification_outbox WHERE completed_at IS NULL AND available_at <= NOW() AND (lease_until IS NULL OR lease_until < NOW()) ORDER BY created_at LIMIT 25 FOR UPDATE SKIP LOCKED`;
      if (!ids.length) return [];
      await tx.roleNotificationOutbox.updateMany({
        where: { id: { in: ids.map((i) => i.id) } },
        data: {
          leaseUntil: new Date(Date.now() + 60000),
          attempts: { increment: 1 },
        },
      });
      return tx.roleNotificationOutbox.findMany({
        where: { id: { in: ids.map((i) => i.id) } },
      });
    });
  }
  async recipients(event: any) {
    if (event.eventType === "ROLE_REQUEST_SUBMITTED") {
      const request = event.requestId
        ? await this.prisma.roleUpgradeRequest.findUnique({
            where: { id: event.requestId },
          })
        : null;
      if (!request || request.status !== "PENDING")
        return { obsolete: true, ids: [] as string[] };
      const ids: string[] = [];
      let cursor: string | undefined;
      for (;;) {
        const rows = await this.prisma.user.findMany({
          where: {
            role: { in: ["ADMIN", "SUPER_ADMIN"] },
            status: "ACTIVE",
            deletedAt: null,
          },
          select: { id: true },
          orderBy: { id: "asc" },
          take: 500,
          ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        });
        ids.push(...rows.map((u) => u.id));
        if (rows.length < 500) break;
        cursor = rows[rows.length - 1]!.id;
      }
      return { obsolete: false, ids };
    }
    return {
      obsolete: false,
      ids: event.targetUserId ? [event.targetUserId] : [],
    };
  }
  async delivery(outboxId: string, recipientUserId: string) {
    return this.prisma.roleNotificationDelivery.upsert({
      where: { outboxId_recipientUserId: { outboxId, recipientUserId } },
      create: { outboxId, recipientUserId },
      update: {},
    });
  }
  async context(deliveryId: string) {
    const delivery = await this.prisma.roleNotificationDelivery.findUnique({
      where: { id: deliveryId },
      include: {
        outbox: true,
        recipient: {
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            status: true,
            deletedAt: true,
          },
        },
      },
    });
    if (!delivery) return null;
    const request = delivery.outbox.requestId
      ? await this.prisma.roleUpgradeRequest.findUnique({
          where: { id: delivery.outbox.requestId },
          select: {
            id: true,
            targetRole: true,
            status: true,
            publicDecisionReason: true,
          },
        })
      : null;
    return { delivery, request };
  }
  async sent(id: string, messageId?: string) {
    await this.prisma.$transaction(async (tx) => {
      const changed = await tx.roleNotificationDelivery.updateMany({
        where: { id, status: { not: "SENT" } },
        data: {
          status: "SENT",
          sentAt: new Date(),
          providerMessageId: messageId,
          errorCode: null,
        },
      });
      if (changed.count)
        await this.audit.record(
          {
            action: "ROLE_EMAIL_ACCEPTED",
            entityType: "RoleNotificationDelivery",
            entityId: id,
            traceId: randomUUID(),
          },
          tx,
        );
    });
  }
  async skip(id: string) {
    await this.prisma.roleNotificationDelivery.update({
      where: { id },
      data: { status: "SKIPPED" },
    });
  }
  async failed(id: string, exhausted: boolean) {
    await this.prisma.roleNotificationDelivery.update({
      where: { id },
      data: {
        status: exhausted ? "FAILED" : "PENDING",
        attempts: { increment: 1 },
        errorCode: "PROVIDER_FAILURE",
        nextAttemptAt: new Date(Date.now() + 60000),
      },
    });
  }
  async finish(id: string) {
    await this.prisma.roleNotificationOutbox.update({
      where: { id },
      data: { completedAt: new Date(), leaseUntil: null },
    });
  }
  async retry(id: string, code: string) {
    await this.prisma.roleNotificationOutbox.update({
      where: { id },
      data: {
        leaseUntil: null,
        availableAt: new Date(Date.now() + 60000),
        lastErrorCode: code,
      },
    });
  }
  async unsettled(outboxId: string) {
    return this.prisma.roleNotificationDelivery.count({
      where: { outboxId, status: { notIn: ["SENT", "SKIPPED"] } },
    });
  }
}
