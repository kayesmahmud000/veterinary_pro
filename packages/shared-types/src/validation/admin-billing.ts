import { z } from "zod";
import {
  OrderStatus,
  SubscriptionStatus,
  SubscriptionTier,
} from "../enums/index.js";
import { DunningStatus } from "../enums/dunning-status.enum.js";
import { DunningStage } from "../enums/dunning-stage.enum.js";
export const billingKinds = [
  "orders",
  "subscriptions",
  "plans",
  "dunning",
] as const;
export type BillingKind = (typeof billingKinds)[number];
const uuid = z.string().uuid(),
  date = z.string().datetime({ offset: true });
const cents = z.number().int().min(0).max(2147483647);
const identity = z.object({ id: uuid, name: z.string().max(255) }).nullable();
const baseQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: uuid.optional(),
    search: z.string().trim().max(100).optional(),
  })
  .strict();
export const billingQueries = {
  orders: baseQuery.extend({ status: z.nativeEnum(OrderStatus).optional() }),
  subscriptions: baseQuery.extend({
    status: z.nativeEnum(SubscriptionStatus).optional(),
  }),
  plans: baseQuery.extend({
    status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  }),
  dunning: baseQuery.extend({
    status: z.nativeEnum(DunningStatus).optional(),
    subscriptionId: uuid.optional(),
  }),
};
export type BillingQuery = z.infer<typeof baseQuery> & {
  status?: string;
  subscriptionId?: string;
};
export const billingOrderSchema = z.object({
  kind: z.literal("orders"),
  id: uuid,
  owner: identity,
  status: z.nativeEnum(OrderStatus),
  totalCents: cents,
  currency: z.string().regex(/^[A-Z]{3}$/),
  paymentGateway: z.string().max(50),
  providerReferencePresent: z.boolean(),
  itemCount: z.number().int().nonnegative(),
  createdAt: date,
  updatedAt: date,
});
export const billingSubscriptionSchema = z.object({
  kind: z.literal("subscriptions"),
  id: uuid,
  owner: identity,
  farm: identity,
  plan: z.object({
    id: uuid,
    name: z.string().max(100),
    tier: z.nativeEnum(SubscriptionTier),
  }),
  status: z.nativeEnum(SubscriptionStatus),
  currentPeriodStart: date,
  currentPeriodEnd: date,
  cancelAtPeriodEnd: z.boolean(),
  providerManaged: z.boolean(),
  createdAt: date,
  updatedAt: date,
});
export const billingPlanSchema = z.object({
  kind: z.literal("plans"),
  id: uuid,
  name: z.string().min(1).max(100),
  tier: z.nativeEnum(SubscriptionTier),
  currency: z.literal("USD"),
  priceMonthlyCents: cents,
  priceAnnualCents: cents,
  maxAnimals: z.number().int().min(-1),
  isActive: z.boolean(),
  createdAt: date,
});
export const billingDunningSchema = z.object({
  kind: z.literal("dunning"),
  id: uuid,
  subscriptionId: uuid,
  owner: identity,
  stage: z.nativeEnum(DunningStage),
  status: z.nativeEnum(DunningStatus),
  channel: z.enum(["EMAIL", "SMS", "IN_APP"]),
  attemptCount: z.number().int().nonnegative(),
  dispatchedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  dispatchedAt: date,
});
export const billingRowSchema = z.discriminatedUnion("kind", [
  billingOrderSchema,
  billingSubscriptionSchema,
  billingPlanSchema,
  billingDunningSchema,
]);
export type BillingRow = z.infer<typeof billingRowSchema>;
export const billingListSchema = z.object({
  items: z.array(billingRowSchema).max(100),
  nextCursor: uuid.nullable(),
});
export const billingLists = {
  orders: billingListSchema.extend({
    items: z.array(billingOrderSchema).max(100),
  }),
  subscriptions: billingListSchema.extend({
    items: z.array(billingSubscriptionSchema).max(100),
  }),
  plans: billingListSchema.extend({
    items: z.array(billingPlanSchema).max(100),
  }),
  dunning: billingListSchema.extend({
    items: z.array(billingDunningSchema).max(100),
  }),
};
const history = z
  .array(
    z.object({
      action: z.string().max(100),
      createdAt: date,
      reason: z.string().max(500).nullable(),
    }),
  )
  .max(50);
const revision = z.string().regex(/^[a-f0-9]{64}$/);
export const billingSubscriptionActions = [
  "SCHEDULE_CANCELLATION",
  "REVOKE_CANCELLATION",
] as const;
export const billingDetails = {
  orders: billingOrderSchema.extend({
    items: z
      .array(
        z.object({
          id: uuid,
          productId: uuid,
          title: z.string().max(255).nullable(),
          priceCents: cents,
          downloadCount: z.number().int().nonnegative(),
          lastDownloadedAt: date.nullable(),
        }),
      )
      .max(50),
    itemsTruncated: z.boolean(),
    history,
    historyTruncated: z.boolean(),
  }),
  subscriptions: billingSubscriptionSchema.extend({
    revision,
    allowedActions: z.array(z.enum(billingSubscriptionActions)).max(2),
    history,
    historyTruncated: z.boolean(),
  }),
  plans: billingPlanSchema.extend({
    revision,
    history,
    historyTruncated: z.boolean(),
  }),
  dunning: billingDunningSchema,
};
export const billingDetailSchema = z.discriminatedUnion("kind", [
  billingDetails.orders,
  billingDetails.subscriptions,
  billingDetails.plans,
  billingDetails.dunning,
]);
export type BillingDetail = z.infer<typeof billingDetailSchema>;
const confirmation = {
  expectedRevision: revision,
  reason: z.string().trim().min(10).max(500),
  actorPassword: z.string().min(1).max(1024),
};
export const billingSubscriptionActionSchema = z
  .object({ ...confirmation, action: z.enum(billingSubscriptionActions) })
  .strict();
export const billingPlanEditSchema = z
  .object({
    ...confirmation,
    name: z.string().trim().min(3).max(100),
    priceMonthlyCents: cents,
    priceAnnualCents: cents,
    maxAnimals: z.number().int().min(-1).max(2147483647),
    isActive: z.boolean(),
  })
  .strict();
export type BillingSubscriptionAction = z.infer<
  typeof billingSubscriptionActionSchema
>;
export type BillingPlanEdit = z.infer<typeof billingPlanEditSchema>;
