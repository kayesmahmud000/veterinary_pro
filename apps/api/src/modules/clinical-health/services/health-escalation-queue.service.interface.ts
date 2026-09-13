import { HealthEscalationJobPayload } from "@vetralink/shared-types";

export const HEALTH_ESCALATION_QUEUE = "health-incident-escalation";
export const HEALTH_ESCALATION_QUEUE_SERVICE = "HEALTH_ESCALATION_QUEUE_SERVICE";

export interface IHealthEscalationQueueService {
  dispatchAllFarmsScan(traceId?: string): Promise<string>;

  dispatchFarmScan(
    farmId: string,
    asOfDate?: string,
    dryRun?: boolean,
    traceId?: string
  ): Promise<string>;

  dispatchEscalation(payload: HealthEscalationJobPayload): Promise<string>;
}
