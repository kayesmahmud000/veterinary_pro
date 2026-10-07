import { z } from "zod";
import {
  authUserSchema,
  roleRequestSchema,
  farmMemberSchema,
  farmOnboardingStatusSchema,
  ProfessionalRole,
  RoleRequestStatus,
  UserRole,
  UserStatus,
} from "@vetralink/shared-types";
export const listQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().uuid().optional(),
    status: z.nativeEnum(RoleRequestStatus).optional(),
    targetRole: z.nativeEnum(ProfessionalRole).optional(),
  })
  .strict();
export const adminUserQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: z.string().uuid().optional(),
    role: z.enum([UserRole.ADMIN, UserRole.SUPER_ADMIN]).optional(),
    search: z.string().trim().max(100).optional(),
  })
  .strict();
export const emptyQuerySchema = z.object({}).strict();
export const questionSchema = z.object({
  key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9]{0,49}$/),
  type: z.enum(["text", "number", "select", "multiselect", "consent"]),
  required: z.boolean(),
  label: z.object({ bn: z.string().max(300), en: z.string().max(300) }),
  options: z.array(z.string().max(100)).max(20).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});
export const questionnaireSchema = z.object({
  targetRole: z.nativeEnum(ProfessionalRole),
  version: z.literal(1),
  fields: z.array(questionSchema).max(25),
});
export type Questionnaire = z.infer<typeof questionnaireSchema>;
export type Question = z.infer<typeof questionSchema>;
export const requestListSchema = z.object({
  requests: z.array(roleRequestSchema).max(100),
  nextCursor: z.string().uuid().nullable(),
});
export const queueItemSchema = z.object({
  id: z.string().uuid(),
  targetRole: z.nativeEnum(ProfessionalRole),
  status: z.nativeEnum(RoleRequestStatus),
  submittedAt: z.string().datetime(),
  applicant: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().email(),
  }),
});
export const reviewQueueSchema = z.object({
  requests: z.array(queueItemSchema).max(100),
  nextCursor: z.string().uuid().nullable(),
});
export const reviewDetailSchema = z.object({
  request: roleRequestSchema.extend({
    privateReviewNote: z.string().nullable(),
    qualificationVerificationNote: z.string().nullable(),
  }),
  applicant: authUserSchema.extend({ isDeleted: z.boolean() }),
  history: z.array(roleRequestSchema).max(20),
});
export const decisionResponseSchema = z.object({
  request: roleRequestSchema,
  applicant: authUserSchema,
});
export const adminTargetSchema = authUserSchema.extend({
  fallbackRole: z.nativeEnum(UserRole),
});
export const adminUserListSchema = z.object({
  users: z
    .array(
      z.object({
        id: z.string().uuid(),
        email: z.string().email(),
        name: z.string(),
        role: z.nativeEnum(UserRole),
        status: z.nativeEnum(UserStatus),
        roleVersion: z.number().int().nonnegative(),
      }),
    )
    .max(100),
  nextCursor: z.string().uuid().nullable(),
});
export const memberListSchema = z.object({
  items: z.array(farmMemberSchema),
  total: z.number().int().nonnegative(),
});
export { farmOnboardingStatusSchema };
export type WorkspaceResult<T> = {
  data?: T;
  code?: string;
  status: number;
  fields?: string[];
};
export const workspaceErrorSchema = z.object({
  code: z.string().regex(/^[A-Z_]{1,80}$/),
  fields: z.array(z.string().max(100)).max(30).optional(),
});
