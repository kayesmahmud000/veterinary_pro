import { TransactionCategory } from "../../enums/index.js";

export interface RecordExpenseDto {
  amount: number;
  category: TransactionCategory;
  txDate: string; // ISO 8601 date string, e.g. "2026-09-13"
  currency?: string; // Default: "USD"
  referenceNote?: string;
  animalId?: string;
  receiptUrl?: string;
  metadata?: Record<string, unknown>;
}
