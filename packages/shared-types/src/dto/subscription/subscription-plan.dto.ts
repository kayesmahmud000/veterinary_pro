import { SubscriptionTier } from "../../enums/index.js";

export interface SubscriptionPlanFeaturesDto {
  maxAnimals: number;
  maxStaff: number;
  teleVetPriority: "STANDARD" | "EXPEDITED" | "PRIORITY";
  advancedAnalytics: boolean;
  bulkImportExport: boolean;
  customReports: boolean;
  [key: string]: unknown;
}

export interface SubscriptionPlanDto {
  id: string;
  name: string;
  tier: SubscriptionTier;
  priceMonthlyCents: number;
  priceAnnualCents: number;
  maxAnimals: number;
  features: SubscriptionPlanFeaturesDto;
  isActive: boolean;
  createdAt: string;
}

export const UNLIMITED_ANIMALS_SENTINEL = -1;

export function isUnlimitedQuota(limit: number): boolean {
  return limit < 0 || limit >= 999999;
}

export interface DefaultSubscriptionPlanConfig {
  name: string;
  tier: SubscriptionTier;
  priceMonthlyCents: number;
  priceAnnualCents: number;
  maxAnimals: number;
  features: SubscriptionPlanFeaturesDto;
  isActive: boolean;
}

export const DEFAULT_SUBSCRIPTION_PLANS: readonly DefaultSubscriptionPlanConfig[] = [
  {
    name: "Starter",
    tier: SubscriptionTier.STARTER,
    priceMonthlyCents: 0,
    priceAnnualCents: 0,
    maxAnimals: 5,
    features: {
      maxAnimals: 5,
      maxStaff: 1,
      teleVetPriority: "STANDARD",
      advancedAnalytics: false,
      bulkImportExport: false,
      customReports: false,
    },
    isActive: true,
  },
  {
    name: "Pro Farmer",
    tier: SubscriptionTier.PRO,
    priceMonthlyCents: 900, // $9.00 / mo
    priceAnnualCents: 8900, // $89.00 / yr (~$7.42/mo)
    maxAnimals: 30,
    features: {
      maxAnimals: 30,
      maxStaff: 3,
      teleVetPriority: "EXPEDITED",
      advancedAnalytics: true,
      bulkImportExport: true,
      customReports: false,
    },
    isActive: true,
  },
  {
    name: "Commercial Enterprise",
    tier: SubscriptionTier.ENTERPRISE,
    priceMonthlyCents: 2900, // $29.00 / mo
    priceAnnualCents: 28900, // $289.00 / yr (~$24.08/mo)
    maxAnimals: UNLIMITED_ANIMALS_SENTINEL,
    features: {
      maxAnimals: UNLIMITED_ANIMALS_SENTINEL,
      maxStaff: UNLIMITED_ANIMALS_SENTINEL,
      teleVetPriority: "PRIORITY",
      advancedAnalytics: true,
      bulkImportExport: true,
      customReports: true,
    },
    isActive: true,
  },
] as const;
