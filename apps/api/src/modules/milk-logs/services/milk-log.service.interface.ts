import {
  CreateBulkMilkLogRequestDto,
  CreateMilkLogRequestDto,
  MilkLogQueryRequestDto,
  MilkLogResponseDto,
  MilkYieldAnalyticsQueryDto,
  MilkYieldAnalyticsResponseDto,
  PaginatedMilkLogsDto,
  UpdateMilkLogRequestDto,
} from "@vetralink/shared-types";

export interface IMilkLogService {
  createMilkLog(
    farmId: string,
    actorUserId: string,
    dto: CreateMilkLogRequestDto,
    traceId?: string
  ): Promise<MilkLogResponseDto>;

  createBulkMilkLog(
    farmId: string,
    actorUserId: string,
    dto: CreateBulkMilkLogRequestDto,
    traceId?: string
  ): Promise<MilkLogResponseDto>;

  updateMilkLog(
    id: string,
    farmId: string,
    actorUserId: string,
    dto: UpdateMilkLogRequestDto,
    traceId?: string
  ): Promise<MilkLogResponseDto>;

  deleteMilkLog(
    id: string,
    farmId: string,
    actorUserId: string,
    traceId?: string
  ): Promise<void>;

  getMilkLogById(id: string, farmId: string): Promise<MilkLogResponseDto>;

  queryMilkLogs(
    farmId: string,
    query: MilkLogQueryRequestDto
  ): Promise<PaginatedMilkLogsDto>;

  getYieldAnalytics(
    farmId: string,
    query: MilkYieldAnalyticsQueryDto
  ): Promise<MilkYieldAnalyticsResponseDto>;
}

export const MILK_LOGS_SERVICE = "MILK_LOGS_SERVICE";
