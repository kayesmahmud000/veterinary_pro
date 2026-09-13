import { VaccineReminderJobPayload } from "@vetralink/shared-types";

export const VACCINE_REMINDER_QUEUE = "vaccine-preventative-reminders";
export const VACCINE_REMINDER_QUEUE_SERVICE = "VACCINE_REMINDER_QUEUE_SERVICE";

export interface IVaccineReminderQueueService {
  dispatchAllFarmsScan(traceId?: string): Promise<string>;

  dispatchFarmScan(
    farmId: string,
    asOfDate?: string,
    daysAhead?: number,
    dryRun?: boolean,
    traceId?: string
  ): Promise<string>;

  dispatchReminder(payload: VaccineReminderJobPayload): Promise<string>;
}
