import {
  ProfitLossStatementResponseDto,
  ProfitLossSummaryKpiDto,
} from "@vetralink/shared-types";
import { ProfitLossQueryDto, ProfitLossSummaryQueryDto } from "../dto";

export interface IFarmProfitLossService {
  generateProfitLoss(
    farmId: string,
    query: ProfitLossQueryDto,
    traceId?: string
  ): Promise<ProfitLossStatementResponseDto>;

  getSummaryKpi(
    farmId: string,
    query: ProfitLossSummaryQueryDto
  ): Promise<ProfitLossSummaryKpiDto>;
}

export const FARM_PROFIT_LOSS_SERVICE = Symbol("FARM_PROFIT_LOSS_SERVICE");
