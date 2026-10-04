import {
  ReminderChannel,
  ReminderMilestone,
  ReminderStatus,
} from "../../enums/index.js";

export interface VaccineReminderLogResponseDto {
  readonly id: string;
  readonly farmId: string;
  readonly vaccineRecordId: string;
  readonly animalId: string;
  readonly recipientUserId: string | null;
  readonly recipientPhone: string | null;
  readonly channel: ReminderChannel;
  readonly milestone: ReminderMilestone;
  readonly status: ReminderStatus;
  readonly message: string;
  readonly errorMessage: string | null;
  readonly dispatchedDate: string;
  readonly dispatchedAt: string;
}

export interface PaginatedVaccineReminderLogsDto {
  readonly items: VaccineReminderLogResponseDto[];
  readonly meta: {
    readonly page: number;
    readonly pageSize: number;
    readonly total: number;
    readonly totalPages: number;
  };
}
