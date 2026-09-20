import {
  DunningChannel,
  DunningStage,
  DunningStatus,
} from "../../enums/index.js";

export interface SubscriptionDunningLogDto {
  id: string;
  subscriptionId: string;
  userId: string;
  farmId: string | null;
  stage: DunningStage;
  channel: DunningChannel;
  status: DunningStatus;
  recipientEmail: string;
  subject: string;
  message: string;
  errorMessage: string | null;
  attemptCount: number;
  gatewayInvoiceId: string | null;
  dispatchedDate: string;
  dispatchedAt: string;
}

export interface TriggerDunningScanDto {
  dryRun?: boolean;
  targetSubscriptionId?: string;
  asOfDate?: string;
}

export interface DunningScanDetailDto {
  subscriptionId: string;
  userId: string;
  farmId?: string | null;
  stage: DunningStage;
  status: DunningStatus;
  daysPastDue: number;
  recipientEmail?: string;
  message?: string;
}

export interface DunningScanResultDto {
  scannedCount: number;
  eligibleCount: number;
  dispatchedCount: number;
  skippedCount: number;
  failedCount: number;
  details: DunningScanDetailDto[];
}

export interface QueryDunningLogsDto {
  subscriptionId?: string;
  userId?: string;
  farmId?: string;
  stage?: DunningStage;
  channel?: DunningChannel;
  status?: DunningStatus;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface DispatchDunningStageRequestDto {
  subscriptionId: string;
  stage: DunningStage;
  channel?: DunningChannel;
  gatewayInvoiceId?: string;
  customMessage?: string;
}

export interface DunningJobPayload {
  jobType: "SCAN_ALL_PAST_DUE" | "DISPATCH_DUNNING_STAGE";
  subscriptionId?: string;
  stage?: DunningStage;
  channel?: DunningChannel;
  gatewayInvoiceId?: string;
  traceId?: string;
  dryRun?: boolean;
  asOfDate?: string;
}
