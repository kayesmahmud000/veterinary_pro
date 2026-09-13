import { HealthEscalationLevel } from "../../enums/index.js";

export interface HealthEscalationJobPayload {
  readonly jobType: "SCAN_ALL_FARMS" | "SCAN_FARM" | "ESCALATE_INCIDENT";
  readonly farmId?: string;
  readonly asOfDate?: string;
  readonly dryRun?: boolean;
  readonly incidentDetails?: {
    readonly farmId: string;
    readonly healthRecordId: string;
    readonly animalId: string;
    readonly tagNumber: string;
    readonly species: string;
    readonly severity: string;
    readonly symptoms: string;
    readonly diagnosis: string | null;
    readonly targetLevel: HealthEscalationLevel;
    readonly hoursUnresolved: number;
  };
  readonly traceId?: string;
}
