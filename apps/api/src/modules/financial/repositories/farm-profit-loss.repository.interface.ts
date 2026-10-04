import { Prisma } from "@prisma/client";
import { ProfitLossInterval } from "@vetralink/shared-types";
import {
  CategoryAggregateRaw,
  PreviousPeriodAggregateRaw,
  TimelinePointRaw,
} from "../entities/farm-profit-loss.entity";

export interface ProfitLossDataFilter {
  farmId: string;
  startDate: Date;
  endDate: Date;
  interval?: ProfitLossInterval;
  animalId?: string;
  currency?: string;
  previousStartDate?: Date;
  previousEndDate?: Date;
}

export interface ProfitLossRawData {
  currency: string;
  revenueAggregates: CategoryAggregateRaw[];
  expenseAggregates: CategoryAggregateRaw[];
  revenueTimeline: TimelinePointRaw[];
  expenseTimeline: TimelinePointRaw[];
  previousPeriod?: PreviousPeriodAggregateRaw | null;
}

export interface IFarmProfitLossRepository {
  getProfitLossData(
    filter: ProfitLossDataFilter,
    tx?: Prisma.TransactionClient
  ): Promise<ProfitLossRawData>;
}

export const FARM_PROFIT_LOSS_REPOSITORY = Symbol(
  "FARM_PROFIT_LOSS_REPOSITORY"
);
