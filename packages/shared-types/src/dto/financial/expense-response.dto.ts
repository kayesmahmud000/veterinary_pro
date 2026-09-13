import {
  AnimalSpecies,
  TransactionCategory,
  TransactionType,
} from "../../enums/index.js";

export interface ExpenseRecorderSummary {
  id: string;
  name: string;
  email: string;
}

export interface ExpenseAnimalSummary {
  id: string;
  tagNumber: string;
  name: string | null;
  species: AnimalSpecies;
}

export interface ExpenseResponseDto {
  id: string;
  farmId: string;
  recordedById: string;
  animalId: string | null;
  type: TransactionType; // Always EXPENSE
  category: TransactionCategory;
  amount: number;
  currency: string;
  referenceNote: string | null;
  receiptUrl: string | null;
  metadata: Record<string, unknown>;
  txDate: string; // ISO 8601 YYYY-MM-DD
  syncVersion: number;
  createdAt: string;
  updatedAt: string;
  recordedBy?: ExpenseRecorderSummary;
  animal?: ExpenseAnimalSummary | null;
}

export interface PaginatedExpensesDto {
  items: ExpenseResponseDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}
