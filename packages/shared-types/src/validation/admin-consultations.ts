import { z } from "zod";

const uuid = z.string().uuid();
const date = z.string().datetime({ offset: true });
const identity = z.object({ id: uuid, name: z.string().max(255) }).nullable();
export const adminConsultationStatuses = [
  "SUBMITTED",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;
export const adminConsultationTypes = ["ASYNC_TICKET", "LIVE_VIDEO"] as const;
export const adminConsultationActions = [
  "ASSIGN",
  "AUTO_ASSIGN",
  "CANCEL",
] as const;
export const adminConsultationHistoryActions = [
  "CONSULTATION_REQUEST_SUBMITTED",
  "CONSULTATION_CANCELLED_BY_TRIAGE",
  "CONSULTATION_PAYMENT_HOLD_CREATED",
  "CONSULTATION_PAYMENT_HOLD_CONFIRMED",
  "CONSULTATION_PAYMENT_CAPTURED",
  "CONSULTATION_PAYMENT_HOLD_RELEASED",
  "CONSULTATION_CREATED",
  "CONSULTATION_SUBMITTED",
  "CONSULTATION_MANUALLY_ASSIGNED",
  "CONSULTATION_AUTO_ASSIGNED",
  "CONSULTATION_ASSIGNED",
  "CONSULTATION_STARTED",
  "CONSULTATION_COMPLETED",
  "CONSULTATION_CANCELLED",
  "CONSULTATION_ADMIN_ASSIGNED",
  "CONSULTATION_ADMIN_AUTO_ASSIGNED",
  "CONSULTATION_ADMIN_CANCELLED",
] as const;
export const adminConsultationQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: uuid.optional(),
    search: z.string().trim().max(100).optional(),
    status: z.enum(adminConsultationStatuses).optional(),
    type: z.enum(adminConsultationTypes).optional(),
  })
  .strict();
export const adminConsultationRowSchema = z.object({
  id: uuid,
  status: z.enum(adminConsultationStatuses),
  type: z.enum(adminConsultationTypes),
  chiefComplaint: z.string(),
  farmer: identity,
  vet: identity,
  farm: identity,
  animal: z
    .object({
      id: uuid,
      name: z.string().nullable(),
      tagNumber: z.string(),
      species: z.string(),
    })
    .nullable(),
  feeCents: z.number().int().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  paymentStatus: z.enum([
    "UNPAID",
    "AUTHORIZED",
    "CAPTURED",
    "RELEASED",
    "FAILED",
  ]),
  scheduledAt: date.nullable(),
  assignedAt: date.nullable(),
  createdAt: date,
  updatedAt: date,
});
export const adminConsultationListSchema = z.object({
  items: z.array(adminConsultationRowSchema).max(100),
  nextCursor: uuid.nullable(),
});
export const adminConsultationDetailSchema = adminConsultationRowSchema.extend({
  revision: z.string().regex(/^[a-f0-9]{64}$/),
  allowedActions: z.array(z.enum(adminConsultationActions)).max(3),
  history: z
    .array(
      z.object({
        id: uuid,
        action: z.enum(adminConsultationHistoryActions),
        actor: identity,
        reason: z.string().max(1000).nullable(),
        createdAt: date,
      }),
    )
    .max(50),
  historyTruncated: z.boolean(),
  notifications: z
    .array(
      z.object({
        id: uuid,
        channel: z.enum(["IN_APP", "SMS", "EMAIL", "PUSH"]),
        status: z.enum(["PENDING", "SENT", "FAILED"]),
        dispatchedAt: date,
        readAt: date.nullable(),
      }),
    )
    .max(50),
  notificationsTruncated: z.boolean(),
});
export const adminConsultationCandidateSchema = z.object({
  vetId: uuid,
  name: z.string(),
  specialties: z.array(z.string()),
  isAvailable: z.boolean(),
  currentActiveCases: z.number().int().nonnegative(),
  maxActiveCases: z.number().int().nonnegative(),
  totalScore: z.number().int().min(0).max(100),
  isEligible: z.boolean(),
  ineligibilityReason: z
    .enum(["UNAVAILABLE", "CAPACITY", "SCHEDULE", "PROFILE_REQUIRED"])
    .nullable(),
});
export const adminConsultationCandidatesSchema = z.object({
  consultationId: uuid,
  items: z.array(adminConsultationCandidateSchema).max(100),
  truncated: z.boolean(),
});
const confirmation = {
  expectedRevision: z.string().regex(/^[a-f0-9]{64}$/),
  reason: z.string().trim().min(5).max(1000),
  actorPassword: z.string().min(1).max(128),
};
export const adminConsultationActionSchema = z.discriminatedUnion("action", [
  z
    .object({ ...confirmation, action: z.literal("ASSIGN"), vetId: uuid })
    .strict(),
  z.object({ ...confirmation, action: z.literal("AUTO_ASSIGN") }).strict(),
  z.object({ ...confirmation, action: z.literal("CANCEL") }).strict(),
]);
export type AdminConsultationQuery = z.infer<
  typeof adminConsultationQuerySchema
>;
export type AdminConsultationRow = z.infer<typeof adminConsultationRowSchema>;
export type AdminConsultationList = z.infer<typeof adminConsultationListSchema>;
export type AdminConsultationDetail = z.infer<
  typeof adminConsultationDetailSchema
>;
export type AdminConsultationCandidate = z.infer<
  typeof adminConsultationCandidateSchema
>;
export type AdminConsultationCandidates = z.infer<
  typeof adminConsultationCandidatesSchema
>;
export type AdminConsultationAction = z.infer<
  typeof adminConsultationActionSchema
>;
