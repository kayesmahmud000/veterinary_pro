import { ProfitLossCategoryBreakdownDto } from "./profit-loss-response.dto.js";

export interface MonthlyStatementQueryDto {
  year?: number;
  month?: number;
  currency?: string;
}

export interface MonthlyStatementFarmHeaderDto {
  id: string;
  name: string;
  slug: string;
  farmType: string;
  country: string;
  currency: string;
}

export interface MonthlyStatementPeriodDto {
  year: number;
  month: number;
  startDate: string;
  endDate: string;
}

export interface MonthlyStatementFinancialSummaryDto {
  totalRevenue: number;
  totalExpense: number;
  netProfit: number;
  profitMarginPercentage: number;
  operatingExpenseRatio: number;
  isProfitable: boolean;
}

export interface MonthlyStatementDairyDto {
  totalMilkYieldLiters: number;
  averageDailyYieldLiters: number;
  feedCostPerLiter: number;
  operatingCostPerLiter: number;
  revenuePerLiter: number;
  netMarginPerLiter: number;
  breakEvenMilkPrice: number;
  isProfitablePerLiter: boolean;
}

export interface MonthlyStatementFeedDto {
  totalFeedConsumedKg: number;
  totalFeedExpense: number;
  averageFeedCostPerKg: number;
  dairyFeedToMilkRatioKgPerLiter: number | null;
  growthOverallFcr: number | null;
  growthRating: string;
  dairyRating: string;
}

export interface MonthlyStatementMetadataDto {
  generatedAt: string;
  statementHash: string;
}

export interface MonthlyPerformanceStatementDto {
  farm: MonthlyStatementFarmHeaderDto;
  period: MonthlyStatementPeriodDto;
  financialSummary: MonthlyStatementFinancialSummaryDto;
  revenueBreakdown: ProfitLossCategoryBreakdownDto[];
  expenseBreakdown: ProfitLossCategoryBreakdownDto[];
  dairyMetrics: MonthlyStatementDairyDto;
  feedEfficiencyMetrics: MonthlyStatementFeedDto;
  statementMetadata: MonthlyStatementMetadataDto;
}
