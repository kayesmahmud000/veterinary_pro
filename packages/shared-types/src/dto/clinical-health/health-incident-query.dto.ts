import { HealthEventType, SeverityLevel } from "../../enums/index.js";

export interface HealthIncidentQueryDto {
  readonly animalId?: string;
  readonly eventType?: HealthEventType;
  readonly severity?: SeverityLevel;
  readonly isResolved?: boolean;
  readonly startDate?: string; // ISO 8601 or YYYY-MM-DD
  readonly endDate?: string; // ISO 8601 or YYYY-MM-DD
  readonly page?: number;
  readonly limit?: number;
  readonly sortBy?: "createdAt" | "severity" | "cost" | "resolvedAt";
  readonly sortOrder?: "asc" | "desc";
}
