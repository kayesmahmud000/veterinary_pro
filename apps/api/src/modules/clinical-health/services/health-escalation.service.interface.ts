import {
  EscalationScanResultDto,
  HealthEscalationLogQueryDto,
  PaginatedHealthEscalationLogsDto,
  HealthEscalationLogResponseDto,
} from "@vetralink/shared-types";

export interface IHealthEscalationService {
  processFarmEscalations(
    farmId: string,
    asOfDate?: Date,
    dryRun?: boolean,
    traceId?: string
  ): Promise<EscalationScanResultDto>;

  listEscalationLogs(
    farmId: string,
    query: HealthEscalationLogQueryDto
  ): Promise<PaginatedHealthEscalationLogsDto>;

  listActiveEscalations(
    farmId: string
  ): Promise<HealthEscalationLogResponseDto[]>;
}

export const HEALTH_ESCALATION_SERVICE = "HEALTH_ESCALATION_SERVICE";
