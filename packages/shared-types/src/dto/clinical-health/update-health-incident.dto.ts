import { HealthEventType, SeverityLevel } from "../../enums/index.js";

export interface UpdateHealthIncidentRequestDto {
  readonly eventType?: HealthEventType;
  readonly severity?: SeverityLevel;
  readonly symptoms?: string;
  readonly diagnosis?: string | null;
  readonly treatment?: string | null;
  readonly cost?: number;
  readonly attendingVetId?: string | null;
  readonly resolvedAt?: string | null;
  readonly syncVersion?: number;
}
