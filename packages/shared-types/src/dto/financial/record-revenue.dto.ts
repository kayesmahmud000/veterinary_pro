import { TransactionCategory } from "../../enums/index.js";

export interface RecordRevenueDto {
  amount: number;
  category: TransactionCategory;
  txDate: string; // ISO 8601 date string, e.g. "2026-09-13"
  currency?: string; // Default: "USD"
  referenceNote?: string;
  animalId?: string;
  markAnimalAsSold?: boolean; // When selling livestock, optionally transition status to SOLD automatically (default: true)
  receiptUrl?: string;
  metadata?: Record<string, unknown>;
}
