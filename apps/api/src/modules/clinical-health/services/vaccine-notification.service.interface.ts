import {
  PaginatedVaccineReminderLogsDto,
  ReminderChannel,
  ReminderDispatchDetailDto,
  ReminderMilestone,
  ScheduleScanResultDto,
  VaccineReminderLogQueryDto,
} from "@vetralink/shared-types";

export interface IVaccineNotificationService {
  processFarmDueReminders(
    farmId: string,
    asOfDate?: Date,
    daysAhead?: number,
    dryRun?: boolean,
    traceId?: string
  ): Promise<ScheduleScanResultDto>;

  dispatchReminderForRecord(
    vaccineRecordId: string,
    farmId: string,
    milestone: ReminderMilestone,
    channel?: ReminderChannel,
    asOfDate?: Date,
    traceId?: string
  ): Promise<ReminderDispatchDetailDto[]>;

  listReminderLogs(
    farmId: string,
    query: VaccineReminderLogQueryDto
  ): Promise<PaginatedVaccineReminderLogsDto>;
}

export const VACCINE_NOTIFICATION_SERVICE = "VACCINE_NOTIFICATION_SERVICE";
