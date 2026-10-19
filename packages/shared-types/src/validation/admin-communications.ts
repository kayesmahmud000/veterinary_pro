import { z } from "zod";

const uuid = z.string().uuid().toLowerCase();
const version = z.number().int().positive().max(2147483646);
const date = z.string().datetime({ offset: true });
const text = (max: number, min = 0) =>
  z
    .string()
    .trim()
    .min(min)
    .max(max)
    .refine((s) => !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s));
export const editorialKinds = ["BLOG", "PAGE", "FAQ", "GUIDE", "VET"] as const;
export const editorialKindSchema = z.enum(editorialKinds);
export const editorialSlugSchema = z
  .string()
  .min(3)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
export const editorialTextSchema = z
  .object({ title: text(200, 1), summary: text(600), body: text(20000) })
  .strict();
export const editorialDraftSchema = z
  .object({ bn: editorialTextSchema, en: editorialTextSchema })
  .strict();
export const communicationsQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(20).default(20),
    cursor: uuid.optional(),
    search: text(100).optional(),
  })
  .strict();
export const editorialQuerySchema = communicationsQuerySchema
  .extend({ kind: editorialKindSchema.optional() })
  .strict();
export const editorialCreateSchema = z
  .object({
    id: uuid,
    kind: editorialKindSchema,
    slug: editorialSlugSchema,
    draft: editorialDraftSchema,
    subjectUserId: uuid.optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if ((v.kind === "VET") !== !!v.subjectUserId)
      ctx.addIssue({
        code: "custom",
        path: ["subjectUserId"],
        message: "Only veterinarian entries require a subject.",
      });
  });
export const editorialSaveSchema = z
  .object({ expectedVersion: version, draft: editorialDraftSchema })
  .strict();
export const communicationsConfirmationSchema = z
  .object({
    actorPassword: z.string().min(1).max(128),
    reason: text(1000, 10),
    confirmed: z.literal(true),
  })
  .strict();
export const editorialActionSchema = communicationsConfirmationSchema
  .extend({
    expectedVersion: version,
    action: z.enum(["PUBLISH", "UNPUBLISH"]),
    verified: z.literal(true).optional(),
    verificationNote: text(1000, 10).optional(),
  })
  .strict();
const editorialRowSchema = z.object({
  id: uuid,
  kind: editorialKindSchema,
  slug: editorialSlugSchema,
  title: z.object({ bn: text(200, 1), en: text(200, 1) }),
  version,
  publishedAt: date.nullable(),
  updatedAt: date,
});
export const editorialListSchema = z.object({
  items: z.array(editorialRowSchema).max(20),
  nextCursor: uuid.nullable(),
});
export const editorialDetailSchema = editorialRowSchema.extend({
  draft: editorialDraftSchema,
  published: editorialDraftSchema.nullable(),
  subjectUserId: uuid.nullable(),
  revisions: z
    .array(z.object({ version, draft: editorialDraftSchema, createdAt: date }))
    .max(20),
  revisionsTruncated: z.boolean(),
});
export const publicEditorialSchema = z.object({
  id: uuid,
  kind: editorialKindSchema,
  slug: editorialSlugSchema,
  content: editorialDraftSchema,
  publishedAt: date,
  verified: z.boolean(),
});
export const publicEditorialListSchema = z.object({
  items: z.array(publicEditorialSchema).max(20),
  nextCursor: uuid.nullable(),
});

export const notificationSources = ["ROLE_EMAIL", "CONSULTATION"] as const;
export const notificationStates = [
  "PENDING",
  "ACCEPTED",
  "FAILED",
  "SKIPPED",
  "RECORDED_UNVERIFIED",
] as const;
export const notificationQuerySchema = communicationsQuerySchema
  .omit({ search: true })
  .extend({
    source: z.enum(notificationSources).default("ROLE_EMAIL"),
    status: z.enum(notificationStates).optional(),
  })
  .strict();
export const communicationIdentitySchema = z
  .object({ id: uuid, name: text(200) })
  .nullable();
export const notificationRowSchema = z.object({
  id: uuid,
  source: z.enum(notificationSources),
  status: z.enum(notificationStates),
  recipient: communicationIdentitySchema,
  channel: z.enum(["EMAIL", "SMS", "PUSH", "IN_APP"]),
  category: text(80, 1),
  attempts: z.number().int().nonnegative(),
  createdAt: date,
  acceptedAt: date.nullable(),
  generation: z.number().int().nonnegative(),
  canRetry: z.boolean(),
});
export const notificationListSchema = z.object({
  items: z.array(notificationRowSchema).max(20),
  nextCursor: uuid.nullable(),
});
export const notificationRetrySchema = communicationsConfirmationSchema
  .extend({
    expectedGeneration: z.number().int().nonnegative().max(2147483646),
  })
  .strict();

export const supportStatuses = [
  "OPEN",
  "IN_PROGRESS",
  "WAITING",
  "RESOLVED",
  "CLOSED",
] as const;
export const supportCategorySchema = z.enum([
  "ACCOUNT",
  "FARM",
  "ORDER",
  "OTHER",
]);
export const supportQuerySchema = communicationsQuerySchema
  .extend({ status: z.enum(supportStatuses).optional() })
  .strict();
export const supportCreateSchema = z
  .object({
    id: uuid,
    messageId: uuid,
    subject: text(160, 5),
    category: supportCategorySchema,
    body: text(4000, 1),
    farmId: uuid.optional(),
    orderId: uuid.optional(),
  })
  .strict();
export const supportReplySchema = z
  .object({ expectedVersion: version, messageId: uuid, body: text(4000, 1) })
  .strict();
export const supportActionSchema = communicationsConfirmationSchema
  .extend({
    expectedVersion: version,
    action: z.enum(["ASSIGN", "STATUS", "REPLY"]),
    assigneeId: uuid.nullable().optional(),
    status: z.enum(supportStatuses).optional(),
    messageId: uuid.optional(),
    body: text(4000, 1).optional(),
    internal: z.boolean().optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    const permitted =
      v.action === "ASSIGN"
        ? ["assigneeId"]
        : v.action === "STATUS"
          ? ["status"]
          : ["messageId", "body", "internal"];
    if (
      (v.action === "ASSIGN" && v.assigneeId === undefined) ||
      (v.action === "STATUS" && !v.status) ||
      (v.action === "REPLY" &&
        (!v.messageId || !v.body || v.internal === undefined))
    )
      ctx.addIssue({
        code: "custom",
        path: ["action"],
        message: "Action fields are required.",
      });
    for (const key of [
      "assigneeId",
      "status",
      "messageId",
      "body",
      "internal",
    ] as const)
      if (v[key] !== undefined && !permitted.includes(key))
        ctx.addIssue({
          code: "custom",
          path: [key],
          message: "Unexpected action field.",
        });
  });
export const supportRowSchema = z.object({
  id: uuid,
  subject: text(160, 5),
  category: supportCategorySchema,
  status: z.enum(supportStatuses),
  version,
  requester: communicationIdentitySchema,
  assignee: communicationIdentitySchema,
  farmId: uuid.nullable(),
  orderId: uuid.nullable(),
  createdAt: date,
  updatedAt: date,
});
export const supportListSchema = z.object({
  items: z.array(supportRowSchema).max(20),
  nextCursor: uuid.nullable(),
});
export const supportDetailSchema = supportRowSchema.extend({
  messages: z
    .array(
      z.object({
        id: uuid,
        author: communicationIdentitySchema,
        internal: z.boolean(),
        body: text(4000, 1),
        createdAt: date,
      }),
    )
    .max(50),
  messagesTruncated: z.boolean(),
  events: z
    .array(
      z.object({
        id: uuid,
        action: z.enum(["CREATED", "MESSAGE", "ASSIGN", "STATUS", "REPLY"]),
        actor: communicationIdentitySchema,
        status: z.enum(supportStatuses).nullable(),
        assigneeId: uuid.nullable(),
        createdAt: date,
      }),
    )
    .max(20)
    .default([]),
  eventsTruncated: z.boolean().default(false),
});
export type EditorialCreate = z.infer<typeof editorialCreateSchema>;
export type EditorialSave = z.infer<typeof editorialSaveSchema>;
export type EditorialAction = z.infer<typeof editorialActionSchema>;
export type EditorialQuery = z.infer<typeof editorialQuerySchema>;
export type EditorialDraft = z.infer<typeof editorialDraftSchema>;
export type EditorialDetail = z.infer<typeof editorialDetailSchema>;
export type PublicEditorial = z.infer<typeof publicEditorialSchema>;
export type CommunicationsQuery = z.infer<typeof communicationsQuerySchema>;
export type NotificationQuery = z.infer<typeof notificationQuerySchema>;
export type NotificationRetry = z.infer<typeof notificationRetrySchema>;
export type SupportQuery = z.infer<typeof supportQuerySchema>;
export type SupportCreate = z.infer<typeof supportCreateSchema>;
export type SupportReply = z.infer<typeof supportReplySchema>;
export type SupportAction = z.infer<typeof supportActionSchema>;
export type SupportDetail = z.infer<typeof supportDetailSchema>;
