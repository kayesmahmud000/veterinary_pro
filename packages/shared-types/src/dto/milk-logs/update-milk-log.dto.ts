import { MilkSession } from "../../enums/index.js";

export interface UpdateMilkLogRequestDto {
  readonly yieldLiters?: number;
  readonly fatPercent?: number | null;
  readonly snfPercent?: number | null;
  readonly session?: MilkSession;
  readonly loggedDate?: string;
}
