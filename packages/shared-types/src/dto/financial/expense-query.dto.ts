import { TransactionCategory } from "../../enums/index.js";

export interface ExpenseQueryDto {
  startDate?: string;
  endDate?: string;
  category?: TransactionCategory;
  animalId?: string;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: "txDate" | "amount" | "createdAt";
  sortOrder?: "asc" | "desc";
}
