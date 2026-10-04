import { TransactionCategory } from "../../enums/index.js";

export interface RevenueCategorySummaryDto {
  category: TransactionCategory;
  totalAmount: number;
  transactionCount: number;
  percentage: number;
}

export interface RevenueTimelineItemDto {
  date: string; // YYYY-MM-DD
  amount: number;
  transactionCount: number;
}

export interface RevenueSummaryResponseDto {
  startDate: string;
  endDate: string;
  currency: string;
  totalRevenue: number;
  totalTransactions: number;
  topCategory: TransactionCategory | null;
  byCategory: RevenueCategorySummaryDto[];
  timeline: RevenueTimelineItemDto[];
}
