import { TransactionCategory } from "../../enums/index.js";

export interface ExpenseCategorySummaryDto {
  category: TransactionCategory;
  totalAmount: number;
  transactionCount: number;
  percentage: number; // e.g. 42.5
}

export interface ExpenseTimelineItemDto {
  date: string; // YYYY-MM-DD
  amount: number;
  transactionCount: number;
}

export interface ExpenseSummaryResponseDto {
  startDate: string;
  endDate: string;
  currency: string;
  totalExpense: number;
  totalTransactions: number;
  topCategory: TransactionCategory | null;
  byCategory: ExpenseCategorySummaryDto[];
  timeline: ExpenseTimelineItemDto[];
}
