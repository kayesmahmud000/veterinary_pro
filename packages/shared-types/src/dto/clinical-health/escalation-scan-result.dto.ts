import {
  HealthEscalationAction,
  HealthEscalationLevel,
  ReminderChannel,
  ReminderStatus,
} from "../../enums/index.js";

export interface EscalationDispatchDetailDto {
  readonly healthRecordId: string;
  readonly tagNumber: string;
  readonly diagnosis: string | null;
  readonly severity: string;
  readonly hoursUnresolved: number;
  readonly level: HealthEscalationLevel;
  readonly actionTaken: HealthEscalationAction;
  readonly channel: ReminderChannel;
  readonly status: ReminderStatus;
  readonly recipientPhone?: string;
  readonly reason?: string;
}

export interface EscalationScanResultDto {
  readonly farmId: string;
  readonly scanDate: string;
  readonly totalUnresolvedScanned: number;
  readonly totalEligibleForEscalation: number;
  readonly escalationsDispatched: number;
  readonly escalationsSkipped: number;
  readonly escalationsFailed: number;
  readonly details: EscalationDispatchDetailDto[];
}
