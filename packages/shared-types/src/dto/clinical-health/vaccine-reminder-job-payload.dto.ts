import { ReminderMilestone } from "../../enums/index.js";

export interface VaccineReminderJobPayload {
  readonly jobType: "SCAN_ALL_FARMS" | "SCAN_FARM" | "DISPATCH_REMINDER";
  readonly farmId?: string;
  readonly asOfDate?: string;
  readonly daysAhead?: number;
  readonly dryRun?: boolean;
  readonly reminderDetails?: {
    readonly farmId: string;
    readonly vaccineRecordId: string;
    readonly animalId: string;
    readonly tagNumber: string;
    readonly species: string;
    readonly recordType: string;
    readonly vaccineName: string;
    readonly dueDate: string;
    readonly milestone: ReminderMilestone;
    readonly recipientUserId?: string;
    readonly recipientPhone?: string;
  };
  readonly traceId?: string;
}
