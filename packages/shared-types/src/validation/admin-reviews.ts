import { z } from "zod";
const uuid = z.string().uuid().toLowerCase();
const date = z.string().datetime({ offset: true });
const identity = z.object({ id: uuid, name: z.string().max(255) }).nullable();
export const adminReviewStatuses = [
  "PENDING",
  "APPROVED",
  "FLAGGED",
  "REJECTED",
] as const;
export const adminReviewActions = ["APPROVED", "FLAGGED", "REJECTED"] as const;
export const adminReviewHistoryActions = [
  "CONSULTATION_REVIEW_SUBMITTED",
  "CONSULTATION_REVIEW_MODERATED",
  "ADMIN_REVIEW_MODERATED",
] as const;
export const adminReviewQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: uuid.optional(),
    search: z.string().trim().max(100).optional(),
    status: z.enum(adminReviewStatuses).optional(),
    vetId: uuid.optional(),
    rating: z.coerce.number().int().min(1).max(5).optional(),
  })
  .strict();
export const adminReviewRowSchema = z.object({
  id: uuid,
  consultationId: uuid,
  farmer: identity,
  vet: identity,
  rating: z.number().int().min(1).max(5),
  feedback: z.string().nullable(),
  tags: z.array(z.string()),
  isPublic: z.boolean(),
  moderationStatus: z.enum(adminReviewStatuses),
  moderatedAt: date.nullable(),
  createdAt: date,
  updatedAt: date,
});
export const adminReviewListSchema = z.object({
  items: z.array(adminReviewRowSchema).max(100),
  nextCursor: uuid.nullable(),
});
export const adminReviewDetailSchema = adminReviewRowSchema.extend({
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  moderationReason: z.string().nullable(),
  moderator: identity,
  allowedStatuses: z.array(z.enum(adminReviewActions)).max(3),
  consultation: z.object({
    id: uuid,
    status: z.enum([
      "SUBMITTED",
      "ASSIGNED",
      "IN_PROGRESS",
      "COMPLETED",
      "CANCELLED",
    ]),
    type: z.enum(["ASYNC_TICKET", "LIVE_VIDEO"]),
    farm: identity,
  }),
  history: z
    .array(
      z.object({
        id: uuid,
        action: z.enum(adminReviewHistoryActions),
        actor: identity,
        reason: z.string().max(1000).nullable(),
        createdAt: date,
      }),
    )
    .max(50),
  historyTruncated: z.boolean(),
});
export const adminReviewModerateSchema = z
  .object({
    status: z.enum(adminReviewActions),
    expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
    reason: z.string().trim().min(5).max(1000),
    actorPassword: z.string().min(1).max(128),
  })
  .strict();
export type AdminReviewQuery = z.infer<typeof adminReviewQuerySchema>;
export type AdminReviewRow = z.infer<typeof adminReviewRowSchema>;
export type AdminReviewDetail = z.infer<typeof adminReviewDetailSchema>;
export type AdminReviewModerate = z.infer<typeof adminReviewModerateSchema>;
