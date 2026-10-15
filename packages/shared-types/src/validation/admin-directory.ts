import { z } from "zod";
import { UserRole, UserStatus, FarmType } from "../enums/index.js";
export const directoryKinds = [
  "users",
  "veterinarians",
  "farms",
  "audit",
] as const;
export type DirectoryKind = (typeof directoryKinds)[number];
const instant = z
  .string()
  .datetime({ offset: true })
  .refine((v) => Number.isFinite(Date.parse(v)));
const paging = {
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
};
const search = z.string().trim().max(100).optional();
export const directoryQueries = {
  users: z
    .object({
      ...paging,
      search,
      role: z.nativeEnum(UserRole).optional(),
      status: z.nativeEnum(UserStatus).optional(),
    })
    .strict(),
  veterinarians: z
    .object({ ...paging, search, status: z.nativeEnum(UserStatus).optional() })
    .strict(),
  farms: z
    .object({ ...paging, search, farmType: z.nativeEnum(FarmType).optional() })
    .strict(),
  audit: z
    .object({
      ...paging,
      actorId: z.string().uuid().optional(),
      entityId: z.string().uuid().optional(),
      action: z.string().trim().min(1).max(50).optional(),
      entityType: z.string().trim().min(1).max(100).optional(),
      from: instant.optional(),
      to: instant.optional(),
    })
    .strict()
    .refine((v) => !v.from || !v.to || Date.parse(v.from) <= Date.parse(v.to), {
      path: ["to"],
    }),
};
export type DirectoryQuery = {
  limit: number;
  cursor?: string;
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  farmType?: FarmType;
  actorId?: string;
  entityId?: string;
  action?: string;
  entityType?: string;
  from?: string;
  to?: string;
};
export const accountActionSchema = z
  .object({
    action: z.enum(["SUSPEND", "REACTIVATE", "REVOKE_SESSIONS"]),
    expectedAuthorizationVersion: z.number().int().nonnegative(),
    reason: z.string().trim().min(10).max(500),
    actorPassword: z.string().min(1).max(128),
  })
  .strict();
export type AccountActionInput = z.infer<typeof accountActionSchema>;
const identity = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  role: z.nativeEnum(UserRole),
  status: z.nativeEnum(UserStatus),
  authorizationVersion: z.number().int().nonnegative(),
  createdAt: instant,
});
const veterinarian = identity.extend({ role: z.literal(UserRole.VET) });
const farm = z.object({
  id: z.string().uuid(),
  name: z.string(),
  farmType: z.nativeEnum(FarmType),
  country: z.string(),
  owner: z.object({ id: z.string().uuid(), name: z.string() }).nullable(),
  createdAt: instant,
});
const auditSnapshot = z.object({
  status: z.nativeEnum(UserStatus).optional(),
  role: z.nativeEnum(UserRole).optional(),
  roleVersion: z.number().int().nonnegative().optional(),
  authorizationVersion: z.number().int().nonnegative().optional(),
  reason: z.string().max(500).optional(),
});
const audit = z.object({
  id: z.string().uuid(),
  actorId: z.string().uuid().nullable(),
  action: z.string(),
  entityType: z.string(),
  entityId: z.string().uuid(),
  traceId: z.string().uuid(),
  createdAt: instant,
});
export const directoryRows = {
  users: identity,
  veterinarians: veterinarian,
  farms: farm,
  audit,
};
export const directoryLists = {
  users: z.object({
    items: z.array(identity),
    nextCursor: z.string().uuid().nullable(),
  }),
  veterinarians: z.object({
    items: z.array(veterinarian),
    nextCursor: z.string().uuid().nullable(),
  }),
  farms: z.object({
    items: z.array(farm),
    nextCursor: z.string().uuid().nullable(),
  }),
  audit: z.object({
    items: z.array(audit),
    nextCursor: z.string().uuid().nullable(),
  }),
};
const related = {
  farms: z
    .array(
      z.object({
        id: z.string().uuid(),
        name: z.string(),
        relation: z.enum(["OWNER", "MEMBER"]),
      }),
    )
    .max(40),
  farmCount: z.number().int().nonnegative(),
  applications: z
    .array(
      z.object({
        id: z.string().uuid(),
        targetRole: z.string(),
        status: z.string(),
      }),
    )
    .max(20),
  applicationCount: z.number().int().nonnegative(),
  orderCount: z.number().int().nonnegative(),
};
export const directoryDetails = {
  users: identity.extend(related),
  veterinarians: veterinarian.extend({
    ...related,
    profile: z
      .object({
        licenseNumber: z.string().nullable(),
        specialties: z.array(z.string()).max(100),
        isAvailable: z.boolean(),
        maxActiveCases: z.number().int().nonnegative(),
      })
      .nullable(),
    consultationCount: z.number().int().nonnegative(),
  }),
  farms: farm.extend({
    members: z
      .array(
        z.object({
          userId: z.string().uuid(),
          name: z.string(),
          role: z.string(),
        }),
      )
      .max(100),
    memberCount: z.number().int().nonnegative(),
    animalCount: z.number().int().nonnegative(),
    subscription: z
      .object({
        status: z.string(),
        plan: z.string(),
        currentPeriodEnd: instant,
      })
      .nullable(),
  }),
  audit: audit.extend({
    oldValues: auditSnapshot.nullable(),
    newValues: auditSnapshot.nullable(),
  }),
};
export const accountActionResultSchema = identity;
