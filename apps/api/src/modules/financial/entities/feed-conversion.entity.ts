import {
  AnimalFcrItemDto,
  DairyFeedEfficiencySummaryDto,
  FeedConversionResponseDto,
  FeedEfficiencyRating,
  GrowthFcrSummaryDto,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

export interface AnimalWeightDataRaw {
  animalId: string;
  tagNumber?: string;
  name?: string;
  initialWeightKg: number;
  finalWeightKg: number;
  assignedFeedKg?: number;
  assignedFeedCost?: number;
}

export interface FeedConversionEntityProps {
  farmId: string;
  startDate: string;
  endDate: string;
  currency?: string;
  totalFeedConsumedKg: number;
  totalFeedExpense: number;
  totalMilkYieldLiters: number;
  animalWeightData?: AnimalWeightDataRaw[];
}

export class FeedConversionEntity {
  private readonly _farmId: string;
  private readonly _startDate: string;
  private readonly _endDate: string;
  private readonly _currency: string;
  private readonly _totalFeedConsumedKg: number;
  private readonly _totalFeedExpense: number;
  private readonly _averageFeedCostPerKg: number;
  private readonly _totalMilkYieldLiters: number;
  private readonly _growthFcr: GrowthFcrSummaryDto;
  private readonly _dairyFeedEfficiency: DairyFeedEfficiencySummaryDto;

  constructor(props: FeedConversionEntityProps) {
    this.validateDates(props.startDate, props.endDate);

    this._farmId = props.farmId;
    this._startDate = props.startDate;
    this._endDate = props.endDate;
    this._currency = (props.currency || "USD").toUpperCase();

    this._totalFeedConsumedKg =
      Math.round(Math.max(0, Number(props.totalFeedConsumedKg)) * 100) / 100;
    this._totalFeedExpense =
      Math.round(Math.max(0, Number(props.totalFeedExpense)) * 100) / 100;
    this._totalMilkYieldLiters =
      Math.round(Math.max(0, Number(props.totalMilkYieldLiters)) * 1000) / 1000;

    this._averageFeedCostPerKg =
      this._totalFeedConsumedKg > 0
        ? Math.round(
            (this._totalFeedExpense / this._totalFeedConsumedKg) * 100
          ) / 100
        : 0.0;

    // 1. Process Animal Growth FCR
    const animalsRaw = props.animalWeightData || [];
    const animalItems: AnimalFcrItemDto[] = [];
    let cumulativeWeightGain = 0;

    const animalCount = animalsRaw.length;
    const defaultFeedPerHead =
      animalCount > 0
        ? Math.round((this._totalFeedConsumedKg / animalCount) * 100) / 100
        : 0;

    for (const a of animalsRaw) {
      const initW = Math.round(Math.max(0, Number(a.initialWeightKg)) * 100) / 100;
      const finW = Math.round(Math.max(0, Number(a.finalWeightKg)) * 100) / 100;
      const gain = Math.max(0, Math.round((finW - initW) * 100) / 100);
      cumulativeWeightGain += gain;

      const feedKg =
        a.assignedFeedKg !== undefined
          ? Math.round(Math.max(0, Number(a.assignedFeedKg)) * 100) / 100
          : defaultFeedPerHead;

      const feedCost =
        a.assignedFeedCost !== undefined
          ? Math.round(Math.max(0, Number(a.assignedFeedCost)) * 100) / 100
          : Math.round(feedKg * this._averageFeedCostPerKg * 100) / 100;

      const fcr = gain > 0 ? Math.round((feedKg / gain) * 100) / 100 : null;
      const costPerKgGain =
        gain > 0 ? Math.round((feedCost / gain) * 100) / 100 : null;

      animalItems.push({
        animalId: a.animalId,
        tagNumber: a.tagNumber,
        name: a.name,
        initialWeightKg: initW,
        finalWeightKg: finW,
        weightGainKg: gain,
        feedConsumedKg: feedKg,
        fcr,
        feedCost,
        costPerKgGain,
        rating: this.evaluateGrowthRating(fcr),
      });
    }

    cumulativeWeightGain = Math.round(cumulativeWeightGain * 100) / 100;
    const overallFcr =
      cumulativeWeightGain > 0
        ? Math.round((this._totalFeedConsumedKg / cumulativeWeightGain) * 100) /
          100
        : null;

    const overallCostPerKgGain =
      cumulativeWeightGain > 0
        ? Math.round((this._totalFeedExpense / cumulativeWeightGain) * 100) / 100
        : null;

    this._growthFcr = {
      totalWeightGainKg: cumulativeWeightGain,
      overallFcr,
      feedCostPerKgGain: overallCostPerKgGain,
      animalsEvaluatedCount: animalCount,
      rating: this.evaluateGrowthRating(overallFcr),
      animals: animalItems,
    };

    // 2. Process Dairy Feed Efficiency
    const feedToMilkRatioKgPerLiter =
      this._totalMilkYieldLiters > 0
        ? Math.round(
            (this._totalFeedConsumedKg / this._totalMilkYieldLiters) * 100
          ) / 100
        : null;

    const milkPerKgFeedLiters =
      this._totalFeedConsumedKg > 0
        ? Math.round(
            (this._totalMilkYieldLiters / this._totalFeedConsumedKg) * 100
          ) / 100
        : null;

    this._dairyFeedEfficiency = {
      totalMilkYieldLiters: this._totalMilkYieldLiters,
      feedToMilkRatioKgPerLiter,
      milkPerKgFeedLiters,
      rating: this.evaluateDairyRating(milkPerKgFeedLiters),
    };
  }

  private evaluateGrowthRating(fcr: number | null): FeedEfficiencyRating {
    if (fcr === null) return FeedEfficiencyRating.AVERAGE;
    if (fcr <= 3.5) return FeedEfficiencyRating.EXCELLENT;
    if (fcr <= 6.0) return FeedEfficiencyRating.GOOD;
    if (fcr <= 8.5) return FeedEfficiencyRating.AVERAGE;
    if (fcr <= 11.0) return FeedEfficiencyRating.POOR;
    return FeedEfficiencyRating.CRITICAL;
  }

  private evaluateDairyRating(
    milkPerKgFeed: number | null
  ): FeedEfficiencyRating {
    if (milkPerKgFeed === null) return FeedEfficiencyRating.AVERAGE;
    if (milkPerKgFeed >= 1.5) return FeedEfficiencyRating.EXCELLENT;
    if (milkPerKgFeed >= 1.3) return FeedEfficiencyRating.GOOD;
    if (milkPerKgFeed >= 1.0) return FeedEfficiencyRating.AVERAGE;
    if (milkPerKgFeed >= 0.7) return FeedEfficiencyRating.POOR;
    return FeedEfficiencyRating.CRITICAL;
  }

  private validateDates(startDateStr: string, endDateStr: string): void {
    if (!startDateStr || !endDateStr) {
      throw new ValidationDomainException(
        "Both startDate and endDate are required"
      );
    }
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new ValidationDomainException(
        "Invalid date format for startDate or endDate. Expected YYYY-MM-DD"
      );
    }

    if (start.getTime() > end.getTime()) {
      throw new ValidationDomainException(
        `startDate (${startDateStr}) cannot be after endDate (${endDateStr})`
      );
    }
  }

  // Getters
  public get farmId(): string {
    return this._farmId;
  }
  public get startDate(): string {
    return this._startDate;
  }
  public get endDate(): string {
    return this._endDate;
  }
  public get currency(): string {
    return this._currency;
  }
  public get totalFeedConsumedKg(): number {
    return this._totalFeedConsumedKg;
  }
  public get totalFeedExpense(): number {
    return this._totalFeedExpense;
  }
  public get averageFeedCostPerKg(): number {
    return this._averageFeedCostPerKg;
  }
  public get totalMilkYieldLiters(): number {
    return this._totalMilkYieldLiters;
  }
  public get growthFcr(): GrowthFcrSummaryDto {
    return { ...this._growthFcr };
  }
  public get dairyFeedEfficiency(): DairyFeedEfficiencySummaryDto {
    return { ...this._dairyFeedEfficiency };
  }

  public toResponseDto(): FeedConversionResponseDto {
    return {
      farmId: this._farmId,
      startDate: this._startDate,
      endDate: this._endDate,
      currency: this._currency,
      totalFeedConsumedKg: this._totalFeedConsumedKg,
      totalFeedExpense: this._totalFeedExpense,
      averageFeedCostPerKg: this._averageFeedCostPerKg,
      growthFcr: this.growthFcr,
      dairyFeedEfficiency: this.dairyFeedEfficiency,
    };
  }
}
