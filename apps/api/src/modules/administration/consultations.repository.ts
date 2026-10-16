import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash } from "crypto";
import {
  AdminConsultationCandidate,
  AdminConsultationQuery,
  adminConsultationCandidatesSchema,
  adminConsultationDetailSchema,
  adminConsultationHistoryActions,
  adminConsultationListSchema,
} from "@vetralink/shared-types";
import { isWithinVetWorkingHours } from "../consultations/entities/vet-profile.entity";
import { PrismaService } from "../prisma/prisma.service";

const identitySelect = { id: true, name: true, deletedAt: true } as const;
const consultationSelect = {
  id: true,
  status: true,
  type: true,
  chiefComplaint: true,
  farmer: { select: identitySelect },
  vet: { select: identitySelect },
  farm: { select: identitySelect },
  animal: { select: { ...identitySelect, tagNumber: true, species: true } },
  feeCents: true,
  currency: true,
  paymentStatus: true,
  paymentIntentId: true,
  scheduledAt: true,
  assignedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;
const vetSelect = {
  id: true,
  name: true,
  vetProfile: {
    select: {
      specialties: true,
      isAvailable: true,
      maxActiveCases: true,
      workingHours: true,
      timezone: true,
    },
  },
} as const;
type Consultation = Prisma.ConsultationGetPayload<{
  select: typeof consultationSelect;
}>;
type Vet = Prisma.UserGetPayload<{ select: typeof vetSelect }>;
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
const identity = <
  T extends { id: string; name: string | null; deletedAt: Date | null },
>(
  value: T | null,
) => (value && !value.deletedAt ? { id: value.id, name: value.name } : null);

export function projectConsultation(row: Consultation) {
  return {
    id: row.id,
    status: row.status,
    type: row.type,
    chiefComplaint: row.chiefComplaint,
    farmer: identity(row.farmer),
    vet: identity(row.vet),
    farm: identity(row.farm),
    animal:
      row.animal && !row.animal.deletedAt
        ? {
            id: row.animal.id,
            name: row.animal.name,
            tagNumber: row.animal.tagNumber,
            species: row.animal.species,
          }
        : null,
    feeCents: row.feeCents,
    currency: row.currency,
    paymentStatus: row.paymentStatus,
    scheduledAt: row.scheduledAt,
    assignedAt: row.assignedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
export function consultationAllowedActions(
  row: Pick<Consultation, "status" | "paymentStatus" | "paymentIntentId">,
) {
  if (row.status !== "SUBMITTED" && row.status !== "ASSIGNED") return [];
  const actions: Array<"ASSIGN" | "AUTO_ASSIGN" | "CANCEL"> = [
    "ASSIGN",
    "AUTO_ASSIGN",
  ];
  if (
    ["UNPAID", "FAILED", "RELEASED"].includes(row.paymentStatus) &&
    !row.paymentIntentId
  )
    actions.push("CANCEL");
  return actions;
}

export function evaluateConsultationCandidate(
  vet: Vet,
  consultation: Consultation,
  active: number,
  conflict: boolean,
): AdminConsultationCandidate {
  const p = vet.vetProfile;
  const specialties =
    p && Array.isArray(p.specialties)
      ? p.specialties.filter((s): s is string => typeof s === "string")
      : [];
  const capacity =
    p && Number.isInteger(p.maxActiveCases) && p.maxActiveCases > 0
      ? p.maxActiveCases
      : 0;
  const reason = !p
    ? "PROFILE_REQUIRED"
    : !p.isAvailable
      ? "UNAVAILABLE"
      : active >= capacity
        ? "CAPACITY"
        : consultation.type === "LIVE_VIDEO" &&
            consultation.scheduledAt &&
            (!isWithinVetWorkingHours(
              p.workingHours,
              p.timezone,
              consultation.scheduledAt,
            ) ||
              conflict)
          ? "SCHEDULE"
          : null;
  const upper = specialties.map((s) => s.toUpperCase());
  const species =
    consultation.animal && !consultation.animal.deletedAt
      ? consultation.animal.species
      : null;
  const specialtyScore =
    species && upper.includes(species)
      ? 50
      : !species ||
          !upper.length ||
          upper.includes("GENERAL") ||
          upper.includes("MIXED")
        ? 25
        : 0;
  const workloadScore = capacity
    ? Math.max(0, Math.round((1 - active / capacity) * 30))
    : 0;
  const availabilityScore = p?.isAvailable
    ? active === 0
      ? 20
      : active <= 2
        ? 10
        : 0
    : 0;
  return {
    vetId: vet.id,
    name: vet.name,
    specialties,
    isAvailable: p?.isAvailable ?? false,
    currentActiveCases: active,
    maxActiveCases: capacity,
    totalScore: reason ? 0 : specialtyScore + workloadScore + availabilityScore,
    isEligible: reason === null,
    ineligibilityReason: reason,
  };
}

@Injectable()
export class AdminConsultationsRepository {
  constructor(private readonly prisma: PrismaService) {}
  async list(q: AdminConsultationQuery) {
    const term = q.search
      ? { contains: q.search, mode: "insensitive" as const }
      : undefined;
    const idSearch =
      q.search && /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(q.search)
        ? [{ id: q.search }]
        : [];
    const where: Prisma.ConsultationWhereInput = {
      ...(q.cursor ? { id: { gt: q.cursor } } : {}),
      ...(q.status ? { status: q.status } : {}),
      ...(q.type ? { type: q.type } : {}),
      ...(term
        ? {
            OR: [
              ...idSearch,
              { chiefComplaint: term },
              { farmer: { deletedAt: null, name: term } },
              { vet: { deletedAt: null, name: term } },
              { farm: { deletedAt: null, name: term } },
              {
                animal: {
                  deletedAt: null,
                  OR: [{ name: term }, { tagNumber: term }],
                },
              },
            ],
          }
        : {}),
    };
    const rows = await this.prisma.consultation.findMany({
      where,
      select: consultationSelect,
      orderBy: { id: "asc" },
      take: q.limit + 1,
    });
    return adminConsultationListSchema.parse(
      json({
        items: rows.slice(0, q.limit).map(projectConsultation),
        nextCursor: rows.length > q.limit ? rows[q.limit - 1].id : null,
      }),
    );
  }
  async lock(id: string, tx: Prisma.TransactionClient) {
    const rows = await tx.$queryRaw<
      Array<{ vetId: string | null }>
    >`SELECT vet_id AS "vetId" FROM consultations WHERE id=${id}::uuid FOR UPDATE`;
    return rows[0]?.vetId ?? null;
  }
  async lockVet(id: string, tx: Prisma.TransactionClient) {
    // A user row exists even without a profile. All new admin assignments take this lock.
    // A real MVCC write fences even a concurrent ReadCommitted legacy assignment.
    await tx.$executeRaw`UPDATE users SET updated_at=updated_at WHERE id=${id}::uuid`;
    await tx.$queryRaw`SELECT id FROM vet_profiles WHERE user_id=${id}::uuid FOR UPDATE`;
  }
  async revision(id: string, tx: Prisma.TransactionClient) {
    const rows = await tx.$queryRaw<
      Array<{ revision: string }>
    >`SELECT xmin::text AS revision FROM consultations WHERE id=${id}::uuid`;
    return rows[0]
      ? createHash("sha256")
          .update(`consultation:${id}:${rows[0].revision}`)
          .digest("hex")
      : null;
  }
  async detail(id: string, tx: Prisma.TransactionClient) {
    const row = await tx.consultation.findUnique({
      where: { id },
      select: consultationSelect,
    });
    if (!row) return null;
    const history = await tx.auditLog.findMany({
      where: {
        entityType: "Consultation",
        entityId: id,
        action: { in: [...adminConsultationHistoryActions] },
      },
      select: {
        id: true,
        action: true,
        user: { select: identitySelect },
        newValues: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 51,
    });
    const notifications = await tx.consultationNotificationLog.findMany({
      where: { consultationId: id },
      select: {
        id: true,
        channel: true,
        status: true,
        dispatchedAt: true,
        readAt: true,
      },
      orderBy: [{ dispatchedAt: "desc" }, { id: "desc" }],
      take: 51,
    });
    return adminConsultationDetailSchema.parse(
      json({
        ...projectConsultation(row),
        revision: await this.revision(id, tx),
        allowedActions: consultationAllowedActions(row),
        history: history.slice(0, 50).map((h) => {
          const values = h.newValues;
          const reason =
            values &&
            typeof values === "object" &&
            !Array.isArray(values) &&
            typeof values.reason === "string"
              ? values.reason.slice(0, 1000)
              : null;
          return {
            id: h.id,
            action: h.action,
            actor: identity(h.user),
            reason,
            createdAt: h.createdAt,
          };
        }),
        historyTruncated: history.length > 50,
        notifications: notifications.slice(0, 50),
        notificationsTruncated: notifications.length > 50,
      }),
    );
  }
  private async evaluate(
    vet: Vet,
    consultation: Consultation,
    tx: Prisma.TransactionClient,
  ) {
    // Exclude the case itself so a reassignment to its current vet is capacity-neutral.
    const active = await tx.consultation.count({
      where: {
        vetId: vet.id,
        id: { not: consultation.id },
        status: { in: ["ASSIGNED", "IN_PROGRESS"] },
      },
    });
    const at =
      consultation.type === "LIVE_VIDEO" ? consultation.scheduledAt : null;
    const conflicts = at
      ? await tx.consultation.count({
          where: {
            vetId: vet.id,
            id: { not: consultation.id },
            type: "LIVE_VIDEO",
            status: { in: ["ASSIGNED", "IN_PROGRESS"] },
            scheduledAt: {
              gte: new Date(at.getTime() - 45 * 60000),
              lte: new Date(at.getTime() + 45 * 60000),
            },
          },
        })
      : 0;
    return evaluateConsultationCandidate(
      vet,
      consultation,
      active,
      conflicts > 0,
    );
  }
  async candidate(id: string, vetId: string, tx: Prisma.TransactionClient) {
    const consultation = await tx.consultation.findUnique({
      where: { id },
      select: consultationSelect,
    });
    const vet = await tx.user.findFirst({
      where: { id: vetId, role: "VET", status: "ACTIVE", deletedAt: null },
      select: vetSelect,
    });
    return consultation && vet ? this.evaluate(vet, consultation, tx) : null;
  }
  async candidates(id: string, tx: Prisma.TransactionClient) {
    const consultation = await tx.consultation.findUnique({
      where: { id },
      select: consultationSelect,
    });
    if (!consultation) return null;
    const vets = await tx.user.findMany({
      where: { role: "VET", status: "ACTIVE", deletedAt: null },
      select: vetSelect,
      orderBy: { id: "asc" },
      take: 101,
    });
    const items: AdminConsultationCandidate[] = [];
    for (const vet of vets.slice(0, 100))
      items.push(await this.evaluate(vet, consultation, tx));
    items.sort(
      (a, b) =>
        Number(b.isEligible) - Number(a.isEligible) ||
        b.totalScore - a.totalScore ||
        a.vetId.localeCompare(b.vetId),
    );
    return adminConsultationCandidatesSchema.parse({
      consultationId: id,
      items,
      truncated: vets.length > 100,
    });
  }
  async assign(id: string, vetId: string, tx: Prisma.TransactionClient) {
    // Partial updates avoid overwriting payment/schedule/clinical values from stale entities.
    await tx.consultation.update({
      where: { id },
      data: { vetId, status: "ASSIGNED", assignedAt: new Date() },
    });
  }
  async cancel(id: string, tx: Prisma.TransactionClient) {
    const row = await tx.consultation.update({
      where: { id },
      data: { status: "CANCELLED" },
      select: { vetId: true },
    });
    return row.vetId;
  }

  async notify(
    id: string,
    vetId: string,
    action: string,
    tx: Prisma.TransactionClient,
  ) {
    await tx.consultationNotificationLog.create({
      data: {
        consultationId: id,
        vetId,
        channel: "IN_APP",
        status: "SENT",
        title:
          action === "CANCEL"
            ? "Consultation cancelled"
            : "Consultation assigned",
        message: `Consultation ${id} ${action === "CANCEL" ? "was cancelled" : "was assigned to you"}. Review it in your consultation workspace.`,
        metadata: { source: "ADMIN_CONSULTATION_ACTION" },
      },
    });
  }
}
