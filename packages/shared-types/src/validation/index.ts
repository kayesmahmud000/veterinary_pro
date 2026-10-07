import { z } from "zod";
import {
  AnimalSpecies,
  FarmRole,
  FarmType,
  ProfessionalRole,
  PUBLIC_REGISTRATION_ROLES,
  RoleRequestStatus,
  UserRole,
  UserStatus,
} from "../enums/index.js";

export const publicRoleSchema = z.enum(PUBLIC_REGISTRATION_ROLES);
const boundedText = (min = 2, max = 100) => z.string().trim().min(min).max(max);
export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().max(254).email(),
    password: z.string().min(1).max(128),
  })
  .strict();
export const registerSchema = loginSchema
  .extend({
    name: boundedText(),
    password: z.string().min(8).max(128),
    phone: z.string().trim().max(40).optional(),
    role: publicRoleSchema.optional(),
  })
  .strict();
export const authUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string(),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(UserStatus),
  isEmailVerified: z.boolean(),
  maskedPhone: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  createdAt: z.string().datetime(),
  roleVersion: z.number().int().nonnegative().optional(),
  farmerOnboardingRequired: z.boolean().optional(),
});
const species = z
  .array(z.nativeEnum(AnimalSpecies))
  .min(1)
  .max(7)
  .refine((v) => new Set(v).size === v.length, "duplicate_species");
export const createFarmOnboardingSchema = z
  .object({
    mode: z.literal("create"),
    submissionKey: z.string().uuid(),
    name: boundedText(),
    farmType: z.nativeEnum(FarmType),
    country: boundedText(2, 100),
    district: boundedText(2, 100),
    upazila: boundedText(2, 100),
    address: boundedText(5, 500),
    species,
    animalCount: z.number().int().min(0).max(100000),
    experienceYears: z.number().int().min(0).max(80),
    gpsLat: z.number().min(-90).max(90).optional(),
    gpsLng: z.number().min(-180).max(180).optional(),
  })
  .strict();
export const joinFarmOnboardingSchema = z
  .object({
    mode: z.literal("join"),
    submissionKey: z.string().uuid(),
    farmId: z.string().uuid(),
    confirmed: z.literal(true),
  })
  .strict();
export const farmOnboardingSchema = z
  .discriminatedUnion("mode", [
    createFarmOnboardingSchema,
    joinFarmOnboardingSchema,
  ])
  .superRefine((v, ctx) => {
    if (
      v.mode === "create" &&
      (v.gpsLat === undefined) !== (v.gpsLng === undefined)
    )
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["gpsLat"],
        message: "coordinates_required_together",
      });
  });
export type FarmOnboardingInput = z.infer<typeof farmOnboardingSchema>;
export const addFarmMemberSchema = z
  .object({
    userId: z.string().uuid().optional(),
    email: z.string().trim().toLowerCase().email().max(254).optional(),
    role: z.nativeEnum(FarmRole).default(FarmRole.HERDSMAN),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (!!v.userId === !!v.email)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["email"],
        message: "provide_email_or_user_id",
      });
  });
export type AddFarmMemberInput = z.input<typeof addFarmMemberSchema>;
export const farmSummarySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  farmType: z.nativeEnum(FarmType),
  country: z.string(),
  address: z.string().nullable(),
  role: z.nativeEnum(FarmRole),
  ownerId: z.string().uuid(),
});
export const farmOnboardingStatusSchema = z.object({
  required: z.boolean(),
  farms: z.array(farmSummarySchema),
});
export const farmMemberSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  farmId: z.string().uuid(),
  role: z.nativeEnum(FarmRole),
  createdAt: z.string(),
  displayName: z.string().optional(),
});
const commonAnswers = {
  reason: boundedText(20, 1000),
  consent: z.literal(true),
};
export const farmerApplicationSchema = z
  .object({
    ...commonAnswers,
    farmName: boundedText(),
    district: boundedText(),
    upazila: boundedText(),
    farmType: z.nativeEnum(FarmType),
    species,
    animalCount: z.number().int().min(0).max(100000),
    experienceYears: z.number().int().min(0).max(80),
    description: boundedText(0, 1000).optional(),
  })
  .strict();
export const vetApplicationSchema = z
  .object({
    ...commonAnswers,
    professionalName: boundedText(),
    qualification: boundedText(2, 200),
    licensingBody: boundedText(),
    licenseNumber: boundedText(2, 100),
    district: boundedText(),
    experienceYears: z.number().int().min(0).max(80),
    species,
    specialties: boundedText(2, 500),
    organization: boundedText(0, 100).optional(),
  })
  .strict();
export const buyerApplicationSchema = z
  .object({
    ...commonAnswers,
    use: z.enum(["PERSONAL", "BUSINESS"]),
    district: boundedText(),
    interests: boundedText(2, 500),
    organization: boundedText(0, 100).optional(),
  })
  .strict();
export const applicationSchemas = {
  FARMER: farmerApplicationSchema,
  VET: vetApplicationSchema,
  BUYER: buyerApplicationSchema,
};
export const submitRoleRequestSchema = z
  .object({
    targetRole: z.nativeEnum(ProfessionalRole),
    questionnaireVersion: z.literal(1),
    locale: z.enum(["bn", "en"]).default("bn"),
    submissionKey: z.string().uuid(),
    answers: z.record(z.unknown()),
  })
  .strict()
  .superRefine((v, ctx) => {
    const result = applicationSchemas[v.targetRole].safeParse(v.answers);
    if (!result.success)
      for (const issue of result.error.issues)
        ctx.addIssue({ ...issue, path: ["answers", ...issue.path] });
  });
export type SubmitRoleRequestInput = z.infer<typeof submitRoleRequestSchema>;
export const roleDecisionSchema = z
  .object({
    decision: z.enum(["APPROVED", "REJECTED"]),
    expectedRequestVersion: z.number().int().positive(),
    expectedApplicantRoleVersion: z.number().int().nonnegative(),
    publicReason: boundedText(2, 500).optional(),
    privateNote: boundedText(0, 1000).optional(),
    qualificationVerificationNote: boundedText(10, 1000).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.decision === "REJECTED" && !v.publicReason)
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["publicReason"],
        message: "required",
      });
  });
export type RoleDecisionInput = z.infer<typeof roleDecisionSchema>;
export const privilegedRoleSchema = z
  .object({
    action: z.enum(["GRANT_ADMIN", "GRANT_SUPER_ADMIN", "REMOVE_PRIVILEGE"]),
    expectedRoleVersion: z.number().int().nonnegative(),
    reason: boundedText(10, 500),
    actorPassword: z.string().min(1).max(128),
  })
  .strict();
export type PrivilegedRoleInput = z.infer<typeof privilegedRoleSchema>;
export const roleRequestSchema = z.object({
  id: z.string().uuid(),
  applicantUserId: z.string().uuid(),
  targetRole: z.nativeEnum(ProfessionalRole),
  status: z.nativeEnum(RoleRequestStatus),
  questionnaireVersion: z.number().int(),
  answers: z.record(z.unknown()),
  locale: z.enum(["bn", "en"]),
  requestVersion: z.number().int(),
  submittedAt: z.string(),
  decidedAt: z.string().nullable(),
  publicDecisionReason: z.string().nullable(),
});
export type RoleRequestSummary = z.infer<typeof roleRequestSchema>;
