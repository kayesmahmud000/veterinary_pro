import { ProfitLossInterval } from "../../enums/index.js";

export interface ProfitLossQueryDto {
  startDate?: string;
  endDate?: string;
  interval?: ProfitLossInterval;
  animalId?: string;
  currency?: string;
  includePreviousPeriod?: boolean;
}

export interface ProfitLossSummaryQueryDto {
  startDate?: string;
  endDate?: string;
  currency?: string;
}
