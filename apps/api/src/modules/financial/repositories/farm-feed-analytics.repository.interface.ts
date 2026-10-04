import { Prisma } from "@prisma/client";
import { ProfitLossInterval } from "@vetralink/shared-types";
import { CostPerLiterRawTimelineItem } from "../entities/cost-per-liter.entity";
import { AnimalWeightDataRaw } from "../entities/feed-conversion.entity";

export interface CostPerLiterFilter {
  farmId: string;
  startDate: Date;
  endDate: Date;
  animalId?: string;
  currency?: string;
  interval?: ProfitLossInterval;
}

export interface CostPerLiterRawData {
  currency: string;
  totalMilkYieldLiters: number;
  totalFeedExpense: number;
  totalOperatingExpense: number;
  totalMilkRevenue: number;
  timeline: CostPerLiterRawTimelineItem[];
}

export interface FeedConversionFilter {
  farmId: string;
  startDate: Date;
  endDate: Date;
  animalId?: string;
  assumedFeedKg?: number;
  assumedFeedCostPerKg?: number;
}

export interface FeedConversionRawData {
  currency: string;
  totalFeedConsumedKg: number;
  totalFeedExpense: number;
  totalMilkYieldLiters: number;
  animalWeightData: AnimalWeightDataRaw[];
}

export interface IFarmFeedAnalyticsRepository {
  getCostPerLiterData(
    filter: CostPerLiterFilter,
    tx?: Prisma.TransactionClient
  ): Promise<CostPerLiterRawData>;

  getFeedConversionData(
    filter: FeedConversionFilter,
    tx?: Prisma.TransactionClient
  ): Promise<FeedConversionRawData>;
}

export const FARM_FEED_ANALYTICS_REPOSITORY = Symbol(
  "FARM_FEED_ANALYTICS_REPOSITORY"
);
