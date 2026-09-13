import {
  AnimalSpecies,
  TransactionCategory,
  TransactionType,
} from "../../enums/index.js";

export interface RevenueRecorderSummary {
  id: string;
  name: string;
  email: string;
}

export interface RevenueAnimalSummary {
  id: string;
  tagNumber: string;
  name: string | null;
  species: AnimalSpecies;
}

export interface RevenueResponseDto {
  id: string;
  farmId: string;
  recordedById: string;
  animalId: string | null;
  type: TransactionType; // Always INCOME
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
  recordedBy?: RevenueRecorderSummary;
  animal?: RevenueAnimalSummary | null;
}

export interface PaginatedRevenuesDto {
  items: RevenueResponseDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}
