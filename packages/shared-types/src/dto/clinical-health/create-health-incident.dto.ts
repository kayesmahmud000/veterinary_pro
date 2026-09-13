import { HealthEventType, SeverityLevel } from "../../enums/index.js";

export interface CreateHealthIncidentRequestDto {
  readonly animalId: string;
  readonly eventType: HealthEventType;
  readonly severity?: SeverityLevel;
  readonly symptoms: string;
  readonly diagnosis?: string | null;
  readonly treatment?: string | null;
  readonly cost?: number;
  readonly attendingVetId?: string | null;
  readonly resolvedAt?: string | null; // ISO 8601 string
}
