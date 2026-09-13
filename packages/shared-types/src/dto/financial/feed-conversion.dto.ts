import { FeedEfficiencyRating } from "../../enums/index.js";

export interface FeedConversionQueryDto {
  startDate?: string;
  endDate?: string;
  animalId?: string;
  assumedFeedKg?: number;
  assumedFeedCostPerKg?: number;
}

export interface AnimalFcrItemDto {
  animalId: string;
  tagNumber?: string;
  name?: string;
  initialWeightKg: number;
  finalWeightKg: number;
  weightGainKg: number;
  feedConsumedKg: number;
  fcr: number | null;
  feedCost: number;
  costPerKgGain: number | null;
  rating: FeedEfficiencyRating;
}

export interface GrowthFcrSummaryDto {
  totalWeightGainKg: number;
  overallFcr: number | null;
  feedCostPerKgGain: number | null;
  animalsEvaluatedCount: number;
  rating: FeedEfficiencyRating;
  animals: AnimalFcrItemDto[];
}

export interface DairyFeedEfficiencySummaryDto {
  totalMilkYieldLiters: number;
  feedToMilkRatioKgPerLiter: number | null; // kg feed consumed per liter milk produced
  milkPerKgFeedLiters: number | null; // liters milk produced per kg feed consumed
  rating: FeedEfficiencyRating;
}

export interface FeedConversionResponseDto {
  farmId: string;
  startDate: string;
  endDate: string;
  currency: string;
  totalFeedConsumedKg: number;
  totalFeedExpense: number;
  averageFeedCostPerKg: number;
  growthFcr: GrowthFcrSummaryDto;
  dairyFeedEfficiency: DairyFeedEfficiencySummaryDto;
}
