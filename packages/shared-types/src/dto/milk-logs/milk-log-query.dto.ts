import { MilkSession } from "../../enums/index.js";

export interface MilkLogQueryRequestDto {
  readonly animalId?: string;
  readonly session?: MilkSession;
  readonly startDate?: string; // YYYY-MM-DD
  readonly endDate?: string; // YYYY-MM-DD
  readonly page?: number;
  readonly limit?: number;
  readonly sortBy?: "loggedDate" | "yieldLiters" | "createdAt";
  readonly sortOrder?: "asc" | "desc";
  readonly entryType?: "INDIVIDUAL" | "BULK" | "ALL";
}
