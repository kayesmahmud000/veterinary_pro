import {
  AcknowledgeMilkAnomalyRequestDto,
  AnomalyScanResultDto,
  MilkAnomalyQueryRequestDto,
  MilkAnomalyResponseDto,
  PaginatedMilkAnomaliesDto,
  ResolveMilkAnomalyRequestDto,
  TriggerAnomalyScanRequestDto,
} from "@vetralink/shared-types";

export interface IMilkAnomalyService {
  evaluateAnimalYieldDrop(
    farmId: string,
    animalId: string,
    targetDate: Date,
    traceId?: string
  ): Promise<MilkAnomalyResponseDto | null>;

  runFarmDailyScan(
    farmId: string,
    targetDate: Date,
    actorUserId?: string,
    traceId?: string
  ): Promise<AnomalyScanResultDto>;

  queryAnomalies(
    farmId: string,
    query: MilkAnomalyQueryRequestDto
  ): Promise<PaginatedMilkAnomaliesDto>;

  getAnomalyById(id: string, farmId: string): Promise<MilkAnomalyResponseDto>;

  acknowledgeAnomaly(
    id: string,
    farmId: string,
    userId: string,
    dto: AcknowledgeMilkAnomalyRequestDto
  ): Promise<MilkAnomalyResponseDto>;

  resolveAnomaly(
    id: string,
    farmId: string,
    userId: string,
    dto: ResolveMilkAnomalyRequestDto
  ): Promise<MilkAnomalyResponseDto>;

  triggerFarmScan(
    farmId: string,
    userId: string,
    dto: TriggerAnomalyScanRequestDto
  ): Promise<{ jobId: string; farmId: string; targetDate: string }>;
}

export const MILK_ANOMALY_SERVICE = "MILK_ANOMALY_SERVICE";
