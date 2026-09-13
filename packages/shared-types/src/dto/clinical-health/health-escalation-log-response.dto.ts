import {
  HealthEscalationAction,
  HealthEscalationLevel,
  ReminderChannel,
  ReminderStatus,
} from "../../enums/index.js";

export interface HealthEscalationLogResponseDto {
  readonly id: string;
  readonly farmId: string;
  readonly healthRecordId: string;
  readonly animalId: string;
  readonly level: HealthEscalationLevel;
  readonly actionTaken: HealthEscalationAction;
  readonly recipientUserId: string | null;
  readonly recipientPhone: string | null;
  readonly channel: ReminderChannel;
  readonly status: ReminderStatus;
  readonly notes: string | null;
  readonly hoursUnresolved: number;
  readonly dispatchedAt: string;
}

export interface PaginatedHealthEscalationLogsDto {
  readonly items: HealthEscalationLogResponseDto[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}
