import { MilkSession } from "../../enums/index.js";

export interface CreateMilkLogRequestDto {
  readonly animalId: string;
  readonly session: MilkSession;
  readonly yieldLiters: number;
  readonly fatPercent?: number | null;
  readonly snfPercent?: number | null;
  readonly loggedDate: string; // YYYY-MM-DD
}
