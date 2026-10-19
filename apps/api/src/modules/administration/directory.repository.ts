import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  DirectoryKind,
  DirectoryQuery,
  directoryDetails,
  directoryRows,
  UserRole,
  UserStatus,
} from "@vetralink/shared-types";
import { PrismaService } from "../prisma/prisma.service";
import { WorkflowException } from "../../common/exceptions/domain.exception";
const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  authorizationVersion: true,
  createdAt: true,
} as const;
const farmSelect = {
  id: true,
  name: true,
  farmType: true,
  country: true,
  owner: { select: { id: true, name: true, deletedAt: true } },
  createdAt: true,
} as const;
export const auditMetadataSelect = {
  id: true,
  userId: true,
  action: true,
  entityType: true,
  entityId: true,
  traceId: true,
  createdAt: true,
} as const;
// Unknown and security events require SUPER_ADMIN; never rely on a denylist.
const reasonBearingActions = [
  "ADMIN_SETTLEMENT_RECONCILED", "ADMIN_SETTLEMENT_BULK_RECONCILED", "ADMIN_REVIEW_MODERATED",
  "USER_SUSPENDED", "USER_REACTIVATED", "USER_SESSIONS_REVOKED",
  "SUBSCRIPTION_CANCELLATION_SCHEDULED", "SUBSCRIPTION_CANCELLATION_REVOKED", "SUBSCRIPTION_PLAN_UPDATED",
  "CONSULTATION_ADMIN_ASSIGNED", "CONSULTATION_ADMIN_AUTO_ASSIGNED", "CONSULTATION_ADMIN_CANCELLED",
];
export const operationalAuditActions = [
  "ADMIN_REPORT_EXPORTED", "ADMIN_AUDIT_EXPORTED",
  "CONTENT_DRAFT_CREATED", "CONTENT_DRAFT_SAVED", "CONTENT_PUBLISHED", "CONTENT_UNPUBLISHED",
  "ROLE_EMAIL_RETRY_REQUESTED", "SUPPORT_TICKET_CREATED", "SUPPORT_MESSAGE_ADDED", "SUPPORT_ADMIN_UPDATED",
  "ADMIN_SETTLEMENT_RECONCILED", "ADMIN_SETTLEMENT_BULK_RECONCILED", "ADMIN_REVIEW_MODERATED",
  "CONSULTATION_ADMIN_ASSIGNED", "CONSULTATION_ADMIN_AUTO_ASSIGNED", "CONSULTATION_ADMIN_CANCELLED",
  "SUBSCRIPTION_CANCELLATION_SCHEDULED", "SUBSCRIPTION_CANCELLATION_REVOKED", "SUBSCRIPTION_PLAN_UPDATED",
  "USER_SUSPENDED",
  "USER_REACTIVATED",
  "USER_SESSIONS_REVOKED",
  "ROLE_REQUEST_SUBMITTED",
  "ROLE_REQUEST_APPROVED",
  "ROLE_REQUEST_REJECTED",
  "FARM_CREATED",
  "FARM_MEMBER_ADDED",
  "COURSE_ENROLLED", "COURSE_CURRICULUM_UPDATED",
  "PRODUCT_CREATED", "PRODUCT_UPDATED", "PRODUCT_PUBLISHED", "PRODUCT_UNPUBLISHED", "PRODUCT_DELETED", "PRODUCT_ASSET_ATTACHED", "PRODUCT_MANAGEMENT_STARTED",
  "MEDIA_UPLOAD_RESERVED", "MEDIA_UPLOAD_STARTED", "MEDIA_UPLOAD_FAILED", "MEDIA_UPLOAD_COMPLETED", "MEDIA_UPLOAD_ABORTED", "MEDIA_PROCESSING_REQUESTED",
];
const auditSelect = auditMetadataSelect;
const operationalActions = operationalAuditActions;
function projectFarm<
  T extends { owner: { id: string; name: string; deletedAt: Date | null } },
>(row: T) {
  return {
    ...row,
    owner: row.owner.deletedAt
      ? null
      : { id: row.owner.id, name: row.owner.name },
  };
}
const json = (v: unknown) => JSON.parse(JSON.stringify(v));
function snapshot(v: unknown) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const row = v as Record<string, unknown>,
    safe: Record<string, unknown> = {};
  for (const key of ["role", "status", "roleVersion", "authorizationVersion"]) {
    const value = row[key];
    if (key === "role" && Object.values(UserRole).includes(value as UserRole))
      safe[key] = value;
    if (
      key === "status" &&
      Object.values(UserStatus).includes(value as UserStatus)
    )
      safe[key] = value;
    if (
      key.endsWith("Version") &&
      Number.isInteger(value) &&
      Number(value) >= 0
    )
      safe[key] = value;
  }
  // Only this feature's bounded support reason is displayed by detail().
  return safe;
}
@Injectable()
export class DirectoryRepository {
  constructor(private readonly prisma: PrismaService) {}
  private auditWhere(
    q: DirectoryQuery,
    superAdmin: boolean,
  ): Prisma.AuditLogWhereInput {
    return {
      ...(superAdmin ? {} : { action: { in: operationalActions } }),
      ...(q.action ? { AND: [{ action: q.action }] } : {}),
      ...(q.actorId ? { userId: q.actorId } : {}),
      ...(q.entityId ? { entityId: q.entityId } : {}),
      ...(q.entityType ? { entityType: q.entityType } : {}),
      ...(q.from || q.to
        ? {
            createdAt: {
              ...(q.from ? { gte: new Date(q.from) } : {}),
              ...(q.to ? { lte: new Date(q.to) } : {}),
            },
          }
        : {}),
    };
  }
  async list(kind: DirectoryKind, q: DirectoryQuery, superAdmin: boolean) {
    const page = { orderBy: { id: "asc" as const }, take: q.limit + 1 };
    const id = q.cursor ? { id: { gt: q.cursor } } : {};
    let rows: unknown[];
    if (kind === "users" || kind === "veterinarians") {
      rows = await this.prisma.user.findMany({
        ...page,
        where: {
          ...id,
          deletedAt: null,
          ...(kind === "veterinarians"
            ? { role: "VET" }
            : q.role
              ? { role: q.role }
              : {}),
          ...(q.status ? { status: q.status } : {}),
          ...(q.search
            ? {
                OR: [
                  { name: { contains: q.search, mode: "insensitive" } },
                  { email: { contains: q.search, mode: "insensitive" } },
                ],
              }
            : {}),
        },
        select: userSelect,
      });
    } else if (kind === "farms") {
      rows = (
        await this.prisma.farm.findMany({
          ...page,
          where: {
            ...id,
            deletedAt: null,
            ...(q.farmType ? { farmType: q.farmType } : {}),
            ...(q.search
              ? { name: { contains: q.search, mode: "insensitive" } }
              : {}),
          },
          select: farmSelect,
        })
      ).map(projectFarm);
    } else {
      rows = (
        await this.prisma.auditLog.findMany({
          ...page,
          where: { ...id, ...this.auditWhere(q, superAdmin) },
          select: auditSelect,
        })
      ).map(({ userId, ...r }) => ({ ...r, actorId: userId }));
    }
    const items = rows
      .slice(0, q.limit)
      .map((r) => directoryRows[kind].parse(json(r)));
    return {
      items,
      nextCursor: rows.length > q.limit ? items[items.length - 1]!.id : null,
    };
  }
  async detail(kind: DirectoryKind, id: string, superAdmin: boolean) {
    if (kind === "audit") {
      const row = await this.prisma.auditLog.findFirst({
        where: { id, ...this.auditWhere({ limit: 1 }, superAdmin) },
        select: { ...auditSelect, oldValues: true, newValues: true },
      });
      if (!row) return null;
      const { userId, ...r } = row;
      const oldValues = snapshot(r.oldValues),
        newValues = snapshot(r.newValues);
      if (
        reasonBearingActions.includes(row.action) &&
        newValues &&
        r.newValues &&
        typeof r.newValues === "object" &&
        !Array.isArray(r.newValues) &&
        typeof r.newValues.reason === "string"
      )
        newValues.reason = r.newValues.reason.slice(0, 500);
      return directoryDetails.audit.parse(
        json({ ...r, actorId: userId, oldValues, newValues }),
      );
    }
    if (kind === "farms") {
      const row = await this.prisma.farm.findFirst({
        where: { id, deletedAt: null },
        select: {
          ...farmSelect,
          members: {
            where: { user: { deletedAt: null } },
            orderBy: { id: "asc" },
            take: 100,
            select: {
              userId: true,
              role: true,
              user: { select: { name: true } },
            },
          },
          _count: {
            select: {
              members: { where: { user: { deletedAt: null } } },
              animals: { where: { deletedAt: null, status: "ACTIVE" } },
            },
          },
          subscriptions: {
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: 1,
            select: {
              status: true,
              currentPeriodEnd: true,
              plan: { select: { name: true } },
            },
          },
        },
      });
      if (!row) return null;
      const { members, _count, subscriptions, ...base } = row;
      const sub = subscriptions[0];
      return directoryDetails.farms.parse(
        json({
          ...projectFarm(base),
          members: members.map(({ user, ...m }) => ({ ...m, name: user.name })),
          memberCount: _count.members,
          animalCount: _count.animals,
          subscription: sub
            ? {
                status: sub.status,
                plan: sub.plan.name,
                currentPeriodEnd: sub.currentPeriodEnd,
              }
            : null,
        }),
      );
    }
    const row = await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(kind === "veterinarians" ? { role: "VET" as const } : {}),
      },
      select: {
        ...userSelect,
        ownedFarms: {
          where: { deletedAt: null },
          take: 20,
          orderBy: { id: "asc" },
          select: { id: true, name: true },
        },
        farmMemberships: {
          where: { farm: { deletedAt: null } },
          take: 20,
          orderBy: { id: "asc" },
          select: { farm: { select: { id: true, name: true } } },
        },
        roleRequests: {
          take: 20,
          orderBy: [{ submittedAt: "desc" }, { id: "desc" }],
          select: { id: true, targetRole: true, status: true },
        },
        vetProfile: {
          select: {
            licenseNumber: true,
            specialties: true,
            isAvailable: true,
            maxActiveCases: true,
          },
        },
        _count: {
          select: {
            orders: true,
            roleRequests: true,
            ownedFarms: { where: { deletedAt: null } },
            farmMemberships: { where: { farm: { deletedAt: null } } },
            vetConsultations: true,
          },
        },
      },
    });
    if (!row) return null;
    const {
      ownedFarms,
      farmMemberships,
      roleRequests,
      vetProfile,
      _count,
      ...base
    } = row;
    const related = {
      farms: [
        ...ownedFarms.map((f) => ({ ...f, relation: "OWNER" })),
        ...farmMemberships.map((m) => ({ ...m.farm, relation: "MEMBER" })),
      ],
      farmCount: _count.ownedFarms + _count.farmMemberships,
      applications: roleRequests,
      applicationCount: _count.roleRequests,
      orderCount: _count.orders,
    };
    const profile = vetProfile
      ? {
          ...vetProfile,
          specialties: Array.isArray(vetProfile.specialties)
            ? vetProfile.specialties
                .filter((v): v is string => typeof v === "string")
                .slice(0, 100)
            : [],
        }
      : null;
    return directoryDetails[kind].parse(
      json({
        ...base,
        ...related,
        ...(kind === "veterinarians"
          ? { profile, consultationCount: _count.vetConsultations }
          : {}),
      }),
    );
  }
  async action(
    id: string,
    status: UserStatus,
    expectedVersion: number,
    tx: Prisma.TransactionClient,
  ) {
    const changed = await tx.user.updateMany({
      where: {
        id,
        authorizationVersion: expectedVersion,
        deletedAt: null,
        role: { notIn: ["ADMIN", "SUPER_ADMIN"] },
      },
      data: { status, authorizationVersion: { increment: 1 } },
    });
    if (changed.count !== 1)
      throw new WorkflowException(
        "ACCOUNT_VERSION_CONFLICT",
        "Account changed. Reload and retry.",
      );
    const row = await tx.user.findUniqueOrThrow({
      where: { id },
      select: userSelect,
    });
    return directoryRows.users.parse(json(row));
  }
}
