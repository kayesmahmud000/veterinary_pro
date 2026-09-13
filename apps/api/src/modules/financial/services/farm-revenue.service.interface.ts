import {
  PaginatedRevenuesDto,
  RevenueResponseDto,
  RevenueSummaryResponseDto,
} from "@vetralink/shared-types";
import {
  RecordRevenueDto,
  RevenueQueryDto,
  RevenueSummaryQueryDto,
  UpdateRevenueDto,
} from "../dto";

export interface IFarmRevenueService {
  recordRevenue(
    farmId: string,
    actorUserId: string,
    dto: RecordRevenueDto,
    traceId?: string
  ): Promise<RevenueResponseDto>;

  updateRevenue(
    farmId: string,
    id: string,
    actorUserId: string,
    dto: UpdateRevenueDto,
    traceId?: string
  ): Promise<RevenueResponseDto>;

  getRevenueById(farmId: string, id: string): Promise<RevenueResponseDto>;

  getRevenues(
    farmId: string,
    query: RevenueQueryDto
  ): Promise<PaginatedRevenuesDto>;

  getRevenueSummary(
    farmId: string,
    query: RevenueSummaryQueryDto
  ): Promise<RevenueSummaryResponseDto>;

  deleteRevenue(
    farmId: string,
    id: string,
    actorUserId: string,
    traceId?: string
  ): Promise<void>;
}

export const FARM_REVENUE_SERVICE = "FARM_REVENUE_SERVICE";
