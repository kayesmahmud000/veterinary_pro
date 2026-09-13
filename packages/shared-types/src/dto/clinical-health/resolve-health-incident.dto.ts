export interface ResolveHealthIncidentRequestDto {
  readonly resolvedAt?: string | null; // ISO 8601 string, defaults to current timestamp if omitted
  readonly diagnosis?: string | null;
  readonly treatment?: string | null;
  readonly cost?: number;
  readonly syncVersion?: number;
}
