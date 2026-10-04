export type YieldTrendDirection = "INCREASING" | "DECREASING" | "STABLE";

export interface MilkYieldAnalyticsQueryDto {
  readonly animalId?: string;
  readonly startDate?: string; // YYYY-MM-DD
  readonly endDate?: string; // YYYY-MM-DD
  readonly entryType?: "INDIVIDUAL" | "BULK" | "ALL";
}

export interface DailyYieldPointDto {
  readonly date: string; // YYYY-MM-DD
  readonly totalYieldLiters: number;
  readonly morningYieldLiters: number;
  readonly afternoonYieldLiters: number;
  readonly eveningYieldLiters: number;
  readonly recordCount: number;
  readonly averageFatPercent: number | null;
  readonly averageSnfPercent: number | null;
  readonly movingAverage7Day: number;
}

export interface WeeklyYieldPointDto {
  readonly week: string; // e.g. "2026-W37"
  readonly startDate: string; // YYYY-MM-DD
  readonly endDate: string; // YYYY-MM-DD
  readonly totalYieldLiters: number;
  readonly dailyAverageYieldLiters: number;
  readonly activeDaysCount: number;
  readonly recordCount: number;
  readonly averageFatPercent: number | null;
  readonly averageSnfPercent: number | null;
}

export interface MonthlyYieldPointDto {
  readonly month: string; // e.g. "2026-09"
  readonly totalYieldLiters: number;
  readonly dailyAverageYieldLiters: number;
  readonly activeDaysCount: number;
  readonly recordCount: number;
  readonly averageFatPercent: number | null;
  readonly averageSnfPercent: number | null;
}

export interface MilkYieldAnalyticsSummaryDto {
  readonly totalYieldLiters: number;
  readonly dailyAverageLiters: number;
  readonly peakYieldDate: string | null;
  readonly peakYieldLiters: number;
  readonly lowestYieldDate: string | null;
  readonly lowestYieldLiters: number;
  readonly totalRecords: number;
  readonly activeDays: number;
  readonly averageFatPercent: number | null;
  readonly averageSnfPercent: number | null;
  readonly trendPercentage: number | null;
  readonly trendDirection: YieldTrendDirection;
}

export interface MilkYieldAnalyticsResponseDto {
  readonly farmId: string;
  readonly animalId: string | null;
  readonly startDate: string; // YYYY-MM-DD
  readonly endDate: string; // YYYY-MM-DD
  readonly summary: MilkYieldAnalyticsSummaryDto;
  readonly daily: DailyYieldPointDto[];
  readonly weekly: WeeklyYieldPointDto[];
  readonly monthly: MonthlyYieldPointDto[];
}
