import { MilkSession } from "../../enums/index.js";

export interface CreateBulkMilkLogRequestDto {
  readonly session: MilkSession;
  readonly yieldLiters: number;
  readonly fatPercent?: number | null;
  readonly snfPercent?: number | null;
  readonly loggedDate: string; // YYYY-MM-DD
  readonly milkingAnimalsCount?: number | null;
  readonly tankTemperatureCelsius?: number | null;
  readonly notes?: string | null;
}
