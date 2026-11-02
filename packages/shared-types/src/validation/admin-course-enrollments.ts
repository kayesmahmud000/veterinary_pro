import { z } from "zod";
import { UserRole, UserStatus } from "../enums/index.js";
const uuid = z.string().uuid(),
  instant = z.string().datetime({ offset: true });
const status = z.enum(["ACTIVE", "REVOKED"]);
const identity = z.object({
  id: uuid,
  name: z.string(),
  email: z.string().email(),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(UserStatus),
});
export const adminEnrollmentFields = {
  id: uuid,
  userId: uuid,
  productId: uuid,
  status,
  version: z.number().int().nonnegative(),
  source: z.enum(["SELF", "ADMIN"]),
  createdAt: instant,
  activatedAt: instant,
  revokedAt: instant.nullable(),
};
export const adminCourseEnrollmentSchema = z.object({
  ...adminEnrollmentFields,
  user: identity,
});
const course = z.object({
  id: uuid,
  title: z.string(),
  slug: z.string(),
  isPublished: z.boolean(),
  deletedAt: instant.nullable(),
});
const page = {
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: uuid.optional(),
  status: z.enum(["ACTIVE", "REVOKED", "ALL"]).default("ACTIVE"),
};
export const adminUserCourseQuerySchema = z.object(page).strict();
export const adminCourseEnrollmentQuerySchema = z
  .object({ ...page, search: z.string().trim().max(100).optional() })
  .strict();
export const adminCourseEnrollmentListSchema = z.object({
  course,
  activeCount: z.number().int().nonnegative(),
  revokedCount: z.number().int().nonnegative(),
  items: z.array(adminCourseEnrollmentSchema).max(100),
  nextCursor: uuid.nullable(),
});
export const adminUserCourseSchema = z.object({
  ...adminEnrollmentFields,
  course,
});
export const adminUserCourseListSchema = z.object({
  user: identity,
  items: z.array(adminUserCourseSchema).max(100),
  nextCursor: uuid.nullable(),
});
export const adminCourseCandidateQuerySchema = z
  .object({
    search: z.string().trim().min(2).max(100).optional(),
    email: z.string().trim().toLowerCase().email().max(254).optional(),
    limit: z.coerce.number().int().min(1).max(20).default(20),
    cursor: uuid.optional(),
  })
  .strict()
  .refine((v) => !!v.search !== !!v.email, {
    message: "Choose search or exact email.",
  });
export const adminCourseCandidateSchema = identity.extend({
  enrollment: z
    .object({ status, version: z.number().int().nonnegative() })
    .nullable(),
  canAdd: z.boolean(),
  canRestore: z.boolean(),
  denialCode: z.string().nullable(),
});
export const adminCourseCandidateListSchema = z.object({
  items: z.array(adminCourseCandidateSchema).max(20),
  nextCursor: uuid.nullable(),
});
const confirmation = {
  reason: z.string().trim().min(10).max(500),
  actorPassword: z.string().min(1).max(128),
};
export const adminEnrollmentAddSchema = z
  .object({ ...confirmation, userId: uuid, expectedVersion: z.null() })
  .strict();
export const adminEnrollmentActionSchema = z
  .object({
    ...confirmation,
    action: z.enum(["REMOVE", "RESTORE"]),
    expectedVersion: z.number().int().nonnegative(),
  })
  .strict();
export const adminEnrollmentMutationResultSchema = z.object({
  enrollment: adminCourseEnrollmentSchema,
  changed: z.boolean(),
});
export const adminCourseUserCreateSchema = z
  .object({
    ...confirmation,
    name: z.string().trim().min(2).max(100),
    email: z.string().trim().toLowerCase().email().max(254),
    newUserPassword: z
      .string()
      .min(8)
      .max(128)
      .refine((v) => new TextEncoder().encode(v).length <= 72, {
        message: "Password must be at most 72 UTF-8 bytes.",
      }),
  })
  .strict();
export const adminCourseUserCreateResultSchema = z.object({
  accountCreated: z.literal(true),
  enrollment: adminCourseEnrollmentSchema,
});
export type AdminCourseEnrollment = z.infer<typeof adminCourseEnrollmentSchema>;
export type AdminCourseEnrollmentQuery = z.infer<
  typeof adminCourseEnrollmentQuerySchema
>;
export type AdminCourseEnrollmentList = z.infer<
  typeof adminCourseEnrollmentListSchema
>;
export type AdminUserCourseList = z.infer<typeof adminUserCourseListSchema>;
export type AdminCourseCandidateQuery = z.infer<
  typeof adminCourseCandidateQuerySchema
>;
export type AdminCourseCandidateList = z.infer<
  typeof adminCourseCandidateListSchema
>;
export type AdminEnrollmentAddInput = z.infer<typeof adminEnrollmentAddSchema>;
export type AdminEnrollmentActionInput = z.infer<
  typeof adminEnrollmentActionSchema
>;
export type AdminEnrollmentMutationResult = z.infer<
  typeof adminEnrollmentMutationResultSchema
>;
export type AdminCourseUserCreateInput = z.infer<
  typeof adminCourseUserCreateSchema
>;
export type AdminCourseUserCreateResult = z.infer<
  typeof adminCourseUserCreateResultSchema
>;
