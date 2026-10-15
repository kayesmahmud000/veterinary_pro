import { Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { Prisma } from "@prisma/client";
import {
  BillingKind,
  BillingQuery,
  billingDetails,
  billingRowSchema,
  billingSubscriptionActions,
} from "@vetralink/shared-types";
import { PrismaService } from "../prisma/prisma.service";
const owner = { select: { id: true, name: true, deletedAt: true } } as const;
const orderSelect = {
  id: true,
  status: true,
  totalCents: true,
  currency: true,
  paymentGateway: true,
  gatewayTxId: true,
  createdAt: true,
  updatedAt: true,
  user: owner,
  _count: { select: { items: true } },
} as const;
const subscriptionSelect = {
  id: true,
  status: true,
  currentPeriodStart: true,
  currentPeriodEnd: true,
  cancelAtPeriodEnd: true,
  gatewaySubId: true,
  createdAt: true,
  updatedAt: true,
  user: owner,
  farm: { select: { id: true, name: true, deletedAt: true } },
  plan: { select: { id: true, name: true, tier: true } },
} as const;
const planSelect = {
  id: true,
  name: true,
  tier: true,
  priceMonthlyCents: true,
  priceAnnualCents: true,
  maxAnimals: true,
  isActive: true,
  createdAt: true,
} as const;
const dunningSelect = {
  id: true,
  subscriptionId: true,
  stage: true,
  status: true,
  channel: true,
  attemptCount: true,
  dispatchedDate: true,
  dispatchedAt: true,
  user: owner,
} as const;
type OrderRow = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;
type SubscriptionRow = Prisma.SubscriptionGetPayload<{
  select: typeof subscriptionSelect;
}>;
type PlanRow = Prisma.SubscriptionPlanGetPayload<{ select: typeof planSelect }>;
type DunningRow = Prisma.SubscriptionDunningLogGetPayload<{
  select: typeof dunningSelect;
}>;
const identity = (
  value: { id: string; name: string; deletedAt: Date | null } | null,
) => (value && !value.deletedAt ? { id: value.id, name: value.name } : null);
const json = (value: unknown) => JSON.parse(JSON.stringify(value));
const projectOrder = (row: OrderRow) => ({
  kind: "orders" as const,
  id: row.id,
  owner: identity(row.user),
  status: row.status,
  totalCents: row.totalCents,
  currency: row.currency,
  paymentGateway: row.paymentGateway,
  providerReferencePresent: !!row.gatewayTxId,
  itemCount: row._count.items,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});
const projectSubscription = (row: SubscriptionRow) => ({
  kind: "subscriptions" as const,
  id: row.id,
  owner: identity(row.user),
  farm: identity(row.farm),
  plan: row.plan,
  status: row.status,
  currentPeriodStart: row.currentPeriodStart,
  currentPeriodEnd: row.currentPeriodEnd,
  cancelAtPeriodEnd: row.cancelAtPeriodEnd,
  providerManaged: !!row.gatewaySubId,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});
const projectPlan = (row: PlanRow) => ({
  kind: "plans" as const,
  ...row,
  currency: "USD" as const,
});
const projectDunning = (row: DunningRow) => ({
  kind: "dunning" as const,
  id: row.id,
  subscriptionId: row.subscriptionId,
  owner: identity(row.user),
  stage: row.stage,
  status: row.status,
  channel: row.channel,
  attemptCount: row.attemptCount,
  dispatchedDate: row.dispatchedDate,
  dispatchedAt: row.dispatchedAt,
});
const historyActions: Record<BillingKind, string[]> = {
  orders: [
    "ORDER_CREATED",
    "ORDER_COMPLETED",
    "ORDER_PAYMENT_FAILED",
    "ORDER_REFUNDED",
  ],
  subscriptions: [
    "SUBSCRIPTION_PLAN_CHANGE",
    "SUBSCRIPTION_CANCELLATION_SCHEDULED",
    "SUBSCRIPTION_CANCELLATION_REVOKED",
    "SUBSCRIPTION_SUSPENDED",
    "SUBSCRIPTION_PAYMENT_FAILED",
    "SUBSCRIPTION_PAYMENT_SUCCEEDED",
  ],
  plans: ["SUBSCRIPTION_PLAN_UPDATED"],
  dunning: [],
};
const table = {
  orders: "orders",
  subscriptions: "subscriptions",
  plans: "subscription_plans",
  dunning: "subscription_dunning_logs",
} as const;
@Injectable()
export class BillingRepository {
  constructor(private readonly prisma: PrismaService) {}
  async list(kind: BillingKind, q: BillingQuery) {
    const page = { orderBy: { id: "asc" as const }, take: q.limit + 1 };
    const cursor = q.cursor ? { id: { gt: q.cursor } } : {};
    const term = q.search
      ? { contains: q.search, mode: "insensitive" as const }
      : undefined;
    const idSearch =
      q.search && /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(q.search)
        ? [{ id: q.search }]
        : [];
    let items: unknown[];
    if (kind === "orders") {
      const where: Prisma.OrderWhereInput = {
        ...cursor,
        ...(q.status
          ? { status: q.status as Prisma.EnumOrderStatusFilter["equals"] }
          : {}),
        ...(term
          ? {
              OR: [
                ...idSearch,
                { user: { deletedAt: null, name: term } },
                { items: { some: { product: { title: term } } } },
              ],
            }
          : {}),
      };
      items = (
        await this.prisma.order.findMany({
          ...page,
          where,
          select: orderSelect,
        })
      ).map(projectOrder);
    } else if (kind === "subscriptions") {
      const where: Prisma.SubscriptionWhereInput = {
        ...cursor,
        ...(q.status
          ? {
              status: q.status as Prisma.EnumSubscriptionStatusFilter["equals"],
            }
          : {}),
        ...(term
          ? {
              OR: [
                ...idSearch,
                { user: { deletedAt: null, name: term } },
                { farm: { deletedAt: null, name: term } },
                { plan: { name: term } },
              ],
            }
          : {}),
      };
      items = (
        await this.prisma.subscription.findMany({
          ...page,
          where,
          select: subscriptionSelect,
        })
      ).map(projectSubscription);
    } else if (kind === "plans") {
      items = (
        await this.prisma.subscriptionPlan.findMany({
          ...page,
          where: {
            ...cursor,
            ...(q.status ? { isActive: q.status === "ACTIVE" } : {}),
            ...(term ? { OR: [...idSearch, { name: term }] } : {}),
          },
          select: planSelect,
        })
      ).map(projectPlan);
    } else {
      const where: Prisma.SubscriptionDunningLogWhereInput = {
        ...cursor,
        ...(q.status
          ? { status: q.status as Prisma.EnumDunningStatusFilter["equals"] }
          : {}),
        ...(q.subscriptionId ? { subscriptionId: q.subscriptionId } : {}),
        ...(term
          ? { OR: [...idSearch, { user: { deletedAt: null, name: term } }] }
          : {}),
      };
      items = (
        await this.prisma.subscriptionDunningLog.findMany({
          ...page,
          where,
          select: dunningSelect,
        })
      ).map(projectDunning);
    }
    const rows = items
      .slice(0, q.limit)
      .map((row) => billingRowSchema.parse(json(row)));
    return {
      items: rows,
      nextCursor: items.length > q.limit ? rows.at(-1)!.id : null,
    };
  }
  async revision(kind: BillingKind, id: string, tx: Prisma.TransactionClient) {
    // Table identifiers come only from this fixed internal map; values remain parameters.
    const rows = await tx.$queryRaw<Array<{ revision: string }>>(
      Prisma.sql`SELECT xmin::text AS revision FROM ${Prisma.raw(table[kind])} WHERE id=${id}::uuid`,
    );
    return rows[0]
      ? createHash("sha256")
          .update(`${kind}:${id}:${rows[0].revision}`)
          .digest("hex")
      : null;
  }
  async lock(
    kind: "subscriptions" | "plans",
    id: string,
    tx: Prisma.TransactionClient,
  ) {
    await tx.$queryRaw(
      Prisma.sql`SELECT id FROM ${Prisma.raw(table[kind])} WHERE id=${id}::uuid FOR UPDATE`,
    );
  }
  private async history(
    kind: BillingKind,
    id: string,
    tx: Prisma.TransactionClient,
  ) {
    const rows = await tx.auditLog.findMany({
      where: {
        entityId: id,
        entityType:
          kind === "orders"
            ? "Order"
            : kind === "plans"
              ? "SubscriptionPlan"
              : "Subscription",
        action: { in: historyActions[kind] },
      },
      select: { action: true, createdAt: true, newValues: true },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 51,
    });
    return {
      history: rows.slice(0, 50).map((row) => {
        const values = row.newValues;
        const reason =
          values &&
          typeof values === "object" &&
          !Array.isArray(values) &&
          typeof values.reason === "string" &&
          historyActions[kind].includes(row.action) &&
          row.action.startsWith("SUBSCRIPTION_")
            ? values.reason.slice(0, 500)
            : null;
        return { action: row.action, createdAt: row.createdAt, reason };
      }),
      historyTruncated: rows.length > 50,
    };
  }
  async detail(kind: BillingKind, id: string, tx: Prisma.TransactionClient) {
    if (kind === "orders") {
      const row = await tx.order.findUnique({
        where: { id },
        select: {
          ...orderSelect,
          items: {
            orderBy: { id: "asc" },
            take: 51,
            select: {
              id: true,
              productId: true,
              priceCents: true,
              downloadCount: true,
              lastDownloadedAt: true,
              product: { select: { title: true, deletedAt: true } },
            },
          },
        },
      });
      if (!row) return null;
      return billingDetails.orders.parse(
        json({
          ...projectOrder(row),
          items: row.items
            .slice(0, 50)
            .map(({ product, ...item }) => ({
              ...item,
              title: product.deletedAt ? null : product.title,
            })),
          itemsTruncated: row.items.length > 50,
          ...(await this.history(kind, id, tx)),
        }),
      );
    }
    if (kind === "dunning") {
      const row = await tx.subscriptionDunningLog.findUnique({
        where: { id },
        select: dunningSelect,
      });
      return row
        ? billingDetails.dunning.parse(json(projectDunning(row)))
        : null;
    }
    const revision = await this.revision(kind, id, tx);
    if (kind === "plans") {
      const row = await tx.subscriptionPlan.findUnique({
        where: { id },
        select: planSelect,
      });
      return row
        ? billingDetails.plans.parse(
            json({
              ...projectPlan(row),
              revision,
              ...(await this.history(kind, id, tx)),
            }),
          )
        : null;
    }
    const row = await tx.subscription.findUnique({
      where: { id },
      select: subscriptionSelect,
    });
    if (!row) return null;
    const available =
      !row.gatewaySubId &&
      !row.user.deletedAt &&
      ["ACTIVE", "TRIALING"].includes(row.status) &&
      row.currentPeriodEnd > new Date();
    return billingDetails.subscriptions.parse(
      json({
        ...projectSubscription(row),
        revision,
        allowedActions: available
          ? [
              row.cancelAtPeriodEnd
                ? billingSubscriptionActions[1]
                : billingSubscriptionActions[0],
            ]
          : [],
        ...(await this.history(kind, id, tx)),
      }),
    );
  }
  schedule(
    id: string,
    cancelAtPeriodEnd: boolean,
    tx: Prisma.TransactionClient,
  ) {
    return tx.subscription.update({
      where: { id },
      data: { cancelAtPeriodEnd },
    });
  }
  editPlan(
    id: string,
    data: Prisma.SubscriptionPlanUpdateInput,
    tx: Prisma.TransactionClient,
  ) {
    return tx.subscriptionPlan.update({ where: { id }, data });
  }
}
