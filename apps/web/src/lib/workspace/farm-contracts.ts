import { z } from "zod";
import {
  AnimalGender,
  AnimalSpecies,
  AnimalStatus,
  SubscriptionAccessMode,
  SubscriptionStatus,
  SubscriptionTier,
  SubscriptionQuotaType,
} from "@vetralink/shared-types";
const count = z.number().int().nonnegative(),
  number = z.number().finite(),
  amount = number.nonnegative(),
  uuid = z.string().uuid();
export const businessDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return (
      !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    );
  });
export const animalQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(100000).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(100).optional(),
    species: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.nativeEnum(AnimalSpecies).optional(),
    ),
    gender: z.nativeEnum(AnimalGender).optional(),
    status: z.preprocess(
      (value) => (value === "" ? undefined : value),
      z.nativeEnum(AnimalStatus).optional(),
    ),
    sortBy: z
      .enum(["tagNumber", "name", "createdAt", "dateOfBirth", "weightKg"])
      .optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  })
  .strict();
export const animalSchema = z.object({
  id: uuid,
  farmId: uuid,
  tagNumber: z.string().min(1).max(50),
  rfidNumber: z.string().nullable(),
  name: z.string().nullable(),
  species: z.nativeEnum(AnimalSpecies),
  breed: z.string().nullable(),
  gender: z.nativeEnum(AnimalGender),
  dateOfBirth: z.string().nullable(),
  ageMonths: count.nullable(),
  weightKg: amount.nullable(),
  status: z.nativeEnum(AnimalStatus),
  sireId: uuid.nullable(),
  damId: uuid.nullable(),
  metadata: z.record(z.unknown()),
  syncVersion: count,
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export const animalListSchema = z.object({
  items: z.array(animalSchema).max(100),
  meta: z.object({
    page: count.min(1),
    pageSize: count.min(1).max(100),
    total: count,
    totalPages: count,
  }),
});
const periodFields = {
  startDate: businessDateSchema,
  endDate: businessDateSchema,
};
const validPeriod = (value: { startDate: string; endDate: string }) =>
  value.startDate <= value.endDate;
export const milkQuerySchema = z
  .object({
    ...periodFields,
    entryType: z.enum(["INDIVIDUAL", "BULK", "ALL"]).default("ALL"),
  })
  .strict()
  .refine(validPeriod)
  .refine(
    (v) => (Date.parse(v.endDate) - Date.parse(v.startDate)) / 86400000 <= 730,
  );
export const milkAnalyticsSchema = z.object({
  farmId: uuid,
  startDate: businessDateSchema,
  endDate: businessDateSchema,
  summary: z.object({ totalYieldLiters: amount, totalRecords: count }),
});
export const vaccinationQuerySchema = z
  .object({
    daysAhead: z.coerce.number().int().min(1).max(365).default(7),
    asOfDate: businessDateSchema,
  })
  .strict();
export const vaccinationScheduleSchema = z.object({
  totalRecords: count,
  totalVaccinations: count,
  totalDewormings: count,
  dueNext7Days: count,
  dueNext30Days: count,
  overdueCount: count,
  upcomingEvents: z
    .array(
      z.object({
        id: uuid,
        farmId: uuid,
        animalId: uuid,
        vaccineName: z.string(),
        nextDueDate: z.string().nullable(),
        scheduleStatus: z.string(),
      }),
    )
    .max(10),
});
export const financeQuerySchema = z
  .object({
    ...periodFields,
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/)
      .optional(),
  })
  .strict()
  .refine(validPeriod);
export const financeSummarySchema = z.object({
  farmId: uuid,
  startDate: businessDateSchema,
  endDate: businessDateSchema,
  currency: z.string().regex(/^[A-Z]{3}$/),
  totalRevenue: number,
  totalExpense: number,
  netProfit: number,
  profitMarginPercentage: number,
  operatingExpenseRatio: number,
  isProfitable: z.boolean(),
});
export const accessStatusSchema = z.object({
  subscriptionId: z.string(),
  farmId: uuid.nullable(),
  status: z.nativeEnum(SubscriptionStatus),
  accessMode: z.nativeEnum(SubscriptionAccessMode),
  canRead: z.boolean(),
  canWrite: z.boolean(),
  daysPastDue: count,
  gracePeriodDaysRemaining: count,
  gracePeriodEnd: z.string().nullable(),
  suspensionDate: z.string().nullable(),
});
const quotaUsageSchema = z.object({
  quotaType: z.nativeEnum(SubscriptionQuotaType),
  currentUsage: count,
  limit: z.number().int(),
  remaining: z.number().int(),
  isUnlimited: z.boolean(),
  canAccommodate: z.boolean(),
  planTier: z.nativeEnum(SubscriptionTier),
  upgradeTier: z.nativeEnum(SubscriptionTier).nullable(),
});
export const quotaSchema = z.object({
  farmId: uuid,
  planTier: z.nativeEnum(SubscriptionTier),
  planName: z.string(),
  isSubscriptionActive: z.boolean(),
  quotas: z.object({ animals: quotaUsageSchema, staff: quotaUsageSchema }),
});
export type Animal = z.infer<typeof animalSchema>;
const animalWriteFields = {
  tagNumber: z.string().trim().min(1).max(50),
  rfidNumber: z.string().trim().max(50).nullable().optional(),
  name: z.string().trim().max(100).nullable().optional(),
  species: z.nativeEnum(AnimalSpecies),
  breed: z.string().trim().max(100).nullable().optional(),
  gender: z.nativeEnum(AnimalGender),
  dateOfBirth: businessDateSchema
    .refine((value) => value <= new Date().toISOString().slice(0, 10))
    .nullable()
    .optional(),
  weightKg: z
    .number()
    .finite()
    .min(0.01)
    .max(9999.99)
    .refine(
      (value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.000001,
    )
    .nullable()
    .optional(),
  status: z.nativeEnum(AnimalStatus).optional(),
};
export const registerAnimalSchema = z.object(animalWriteFields).strict();
export const updateAnimalSchema = z
  .object(animalWriteFields)
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0);
