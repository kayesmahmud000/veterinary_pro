import {
  HealthEscalationLevel,
  ReminderChannel,
  ReminderStatus,
} from "../../enums/index.js";

export interface HealthEscalationLogQueryDto {
  readonly animalId?: string;
  readonly healthRecordId?: string;
  readonly level?: HealthEscalationLevel;
  readonly channel?: ReminderChannel;
  readonly status?: ReminderStatus;
  readonly startDate?: string;
  readonly endDate?: string;
  readonly page?: number;
  readonly limit?: number;
}
