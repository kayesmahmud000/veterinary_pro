import {
  ReminderChannel,
  ReminderMilestone,
  ReminderStatus,
} from "../../enums/index.js";

export interface VaccineReminderLogQueryDto {
  readonly animalId?: string;
  readonly vaccineRecordId?: string;
  readonly channel?: ReminderChannel;
  readonly milestone?: ReminderMilestone;
  readonly status?: ReminderStatus;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly page?: number;
  readonly limit?: number;
}
