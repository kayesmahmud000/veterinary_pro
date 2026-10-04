import { ProfitLossInterval } from "../../enums/index.js";

export interface CostPerLiterQueryDto {
  startDate?: string;
  endDate?: string;
  animalId?: string;
  currency?: string;
  interval?: ProfitLossInterval;
}

export interface CostPerLiterTimelinePointDto {
  period: string; // ISO date or Year-Month (e.g. "2026-09-01")
  milkYieldLiters: number;
  feedCost: number;
  operatingCost: number;
  milkRevenue: number;
  feedCostPerLiter: number;
  operatingCostPerLiter: number;
  revenuePerLiter: number;
  netMarginPerLiter: number;
}

export interface CostPerLiterResponseDto {
  farmId: string;
  startDate: string;
  endDate: string;
  currency: string;
  interval: ProfitLossInterval;
  totalMilkYieldLiters: number;
  averageDailyYieldLiters: number;
  daysCount: number;
  totalFeedExpense: number;
  totalOperatingExpense: number;
  totalMilkRevenue: number;
  feedCostPerLiter: number;
  operatingCostPerLiter: number;
  revenuePerLiter: number;
  netMarginPerLiter: number;
  feedCostPercentage: number;
  breakEvenMilkPrice: number;
  isProfitablePerLiter: boolean;
  timeline: CostPerLiterTimelinePointDto[];
}
