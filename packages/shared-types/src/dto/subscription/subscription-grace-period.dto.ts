import { SubscriptionStatus } from "../../enums/index.js";
import { SubscriptionAccessMode } from "../../enums/subscription-access-mode.enum.js";

export interface SubscriptionAccessStatusDto {
  subscriptionId: string;
  farmId: string | null;
  status: SubscriptionStatus;
  accessMode: SubscriptionAccessMode;
  canRead: boolean;
  canWrite: boolean;
  daysPastDue: number;
  gracePeriodDaysRemaining: number;
  gracePeriodEnd: string | null;
  suspensionDate: string | null;
  portalUrl?: string;
  message: string;
}

export interface SubscriptionSuspensionDetailDto {
  subscriptionId: string;
  userId: string;
  farmId: string | null;
  status: SubscriptionStatus;
  daysPastDue: number;
  message: string;
}

export interface SubscriptionSuspensionResultDto {
  scannedCount: number;
  suspendedCount: number;
  details: SubscriptionSuspensionDetailDto[];
}
