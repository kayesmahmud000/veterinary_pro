import {
  ReminderChannel,
  ReminderMilestone,
  ReminderStatus,
} from "../../enums/index.js";

export interface ReminderDispatchDetailDto {
  readonly vaccineRecordId: string;
  readonly tagNumber: string;
  readonly vaccineName: string;
  readonly milestone: ReminderMilestone;
  readonly channel: ReminderChannel;
  readonly status: ReminderStatus;
  readonly reason?: string;
}

export interface ScheduleScanResultDto {
  readonly farmId: string;
  readonly scanDate: string;
  readonly totalScanned: number;
  readonly dueWithinHorizon: number;
  readonly remindersDispatched: number;
  readonly remindersSkipped: number;
  readonly remindersFailed: number;
  readonly details: ReminderDispatchDetailDto[];
}
