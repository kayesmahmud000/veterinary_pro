import { ProfitLossInterval, TransactionCategory } from "../../enums/index.js";

export interface ProfitLossCategoryBreakdownDto {
  category: TransactionCategory;
  amount: number;
  transactionCount: number;
  percentage: number;
}

export interface ProfitLossTimelinePointDto {
  period: string; // ISO date string e.g. "2026-09-01" or year-month e.g. "2026-09"
  revenue: number;
  expense: number;
  netProfit: number;
  marginPercentage: number;
}

export interface ProfitLossComparisonDto {
  previousStartDate: string;
  previousEndDate: string;
  previousRevenue: number;
  previousExpense: number;
  previousNetProfit: number;
  revenueGrowthPercentage: number | null;
  expenseGrowthPercentage: number | null;
  netProfitGrowthPercentage: number | null;
}

export interface ProfitLossStatementResponseDto {
  farmId: string;
  startDate: string;
  endDate: string;
  currency: string;
  interval: ProfitLossInterval;
  totalRevenue: number;
  totalExpense: number;
  netProfit: number;
  isProfitable: boolean;
  profitMarginPercentage: number;
  operatingExpenseRatio: number;
  revenueTransactionsCount: number;
  expenseTransactionsCount: number;
  revenueBreakdown: ProfitLossCategoryBreakdownDto[];
  expenseBreakdown: ProfitLossCategoryBreakdownDto[];
  timeline: ProfitLossTimelinePointDto[];
  comparison?: ProfitLossComparisonDto;
}

export interface ProfitLossSummaryKpiDto {
  farmId: string;
  startDate: string;
  endDate: string;
  currency: string;
  totalRevenue: number;
  totalExpense: number;
  netProfit: number;
  profitMarginPercentage: number;
  operatingExpenseRatio: number;
  isProfitable: boolean;
}
