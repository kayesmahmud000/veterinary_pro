export interface TriggerReminderScanDto {
  readonly asOfDate?: string;
  readonly daysAhead?: number;
  readonly dryRun?: boolean;
}
