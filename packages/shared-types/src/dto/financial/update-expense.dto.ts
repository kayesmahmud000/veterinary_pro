import { TransactionCategory } from "../../enums/index.js";

export interface UpdateExpenseDto {
  amount?: number;
  category?: TransactionCategory;
  txDate?: string;
  currency?: string;
  referenceNote?: string;
  animalId?: string | null;
  receiptUrl?: string | null;
  metadata?: Record<string, unknown>;
  syncVersion: number;
}
