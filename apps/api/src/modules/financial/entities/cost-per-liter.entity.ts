import {
  CostPerLiterResponseDto,
  CostPerLiterTimelinePointDto,
  ProfitLossInterval,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

export interface CostPerLiterRawTimelineItem {
  period: string;
  milkYieldLiters: number;
  feedCost: number;
  operatingCost: number;
  milkRevenue: number;
}

export interface CostPerLiterEntityProps {
  farmId: string;
  startDate: string;
  endDate: string;
  currency?: string;
  interval?: ProfitLossInterval;
  totalMilkYieldLiters: number;
  totalFeedExpense: number;
  totalOperatingExpense: number;
  totalMilkRevenue: number;
  timeline?: CostPerLiterRawTimelineItem[];
}

export class CostPerLiterEntity {
  private readonly _farmId: string;
  private readonly _startDate: string;
  private readonly _endDate: string;
  private readonly _currency: string;
  private readonly _interval: ProfitLossInterval;
  private readonly _totalMilkYieldLiters: number;
  private readonly _averageDailyYieldLiters: number;
  private readonly _daysCount: number;
  private readonly _totalFeedExpense: number;
  private readonly _totalOperatingExpense: number;
  private readonly _totalMilkRevenue: number;
  private readonly _feedCostPerLiter: number;
  private readonly _operatingCostPerLiter: number;
  private readonly _revenuePerLiter: number;
  private readonly _netMarginPerLiter: number;
  private readonly _feedCostPercentage: number;
  private readonly _breakEvenMilkPrice: number;
  private readonly _isProfitablePerLiter: boolean;
  private readonly _timeline: CostPerLiterTimelinePointDto[];

  constructor(props: CostPerLiterEntityProps) {
    this.validateDates(props.startDate, props.endDate);

    this._farmId = props.farmId;
    this._startDate = props.startDate;
    this._endDate = props.endDate;
    this._currency = (props.currency || "USD").toUpperCase();
    this._interval = props.interval || ProfitLossInterval.DAY;

    this._totalMilkYieldLiters =
      Math.round(Math.max(0, Number(props.totalMilkYieldLiters)) * 1000) / 1000;
    this._totalFeedExpense =
      Math.round(Math.max(0, Number(props.totalFeedExpense)) * 100) / 100;
    this._totalOperatingExpense =
      Math.round(Math.max(0, Number(props.totalOperatingExpense)) * 100) / 100;
    this._totalMilkRevenue =
      Math.round(Math.max(0, Number(props.totalMilkRevenue)) * 100) / 100;

    // Calculate days count inclusive
    const start = new Date(props.startDate);
    const end = new Date(props.endDate);
    const diffMs = Math.abs(end.getTime() - start.getTime());
    this._daysCount = Math.max(
      1,
      Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1
    );

    this._averageDailyYieldLiters =
      Math.round((this._totalMilkYieldLiters / this._daysCount) * 1000) / 1000;

    // Unit per-liter metrics (safe division)
    if (this._totalMilkYieldLiters > 0) {
      this._feedCostPerLiter =
        Math.round(
          (this._totalFeedExpense / this._totalMilkYieldLiters) * 100
        ) / 100;
      this._operatingCostPerLiter =
        Math.round(
          (this._totalOperatingExpense / this._totalMilkYieldLiters) * 100
        ) / 100;
      this._revenuePerLiter =
        Math.round(
          (this._totalMilkRevenue / this._totalMilkYieldLiters) * 100
        ) / 100;
    } else {
      this._feedCostPerLiter = 0.0;
      this._operatingCostPerLiter = 0.0;
      this._revenuePerLiter = 0.0;
    }

    this._netMarginPerLiter =
      Math.round(
        (this._revenuePerLiter - this._operatingCostPerLiter) * 100
      ) / 100;
    this._breakEvenMilkPrice = this._operatingCostPerLiter;
    this._isProfitablePerLiter = this._netMarginPerLiter > 0;

    // Feed cost share of total operating expenses
    this._feedCostPercentage =
      this._totalOperatingExpense > 0
        ? Math.round(
            (this._totalFeedExpense / this._totalOperatingExpense) * 10000
          ) / 100
        : 0.0;

    // Build timeline points
    this._timeline = (props.timeline || []).map((t) => {
      const milkYieldLiters =
        Math.round(Math.max(0, Number(t.milkYieldLiters)) * 1000) / 1000;
      const feedCost = Math.round(Math.max(0, Number(t.feedCost)) * 100) / 100;
      const operatingCost =
        Math.round(Math.max(0, Number(t.operatingCost)) * 100) / 100;
      const milkRevenue =
        Math.round(Math.max(0, Number(t.milkRevenue)) * 100) / 100;

      let feedCostPerLiter = 0.0;
      let operatingCostPerLiter = 0.0;
      let revenuePerLiter = 0.0;

      if (milkYieldLiters > 0) {
        feedCostPerLiter =
          Math.round((feedCost / milkYieldLiters) * 100) / 100;
        operatingCostPerLiter =
          Math.round((operatingCost / milkYieldLiters) * 100) / 100;
        revenuePerLiter =
          Math.round((milkRevenue / milkYieldLiters) * 100) / 100;
      }

      const netMarginPerLiter =
        Math.round((revenuePerLiter - operatingCostPerLiter) * 100) / 100;

      return {
        period: t.period,
        milkYieldLiters,
        feedCost,
        operatingCost,
        milkRevenue,
        feedCostPerLiter,
        operatingCostPerLiter,
        revenuePerLiter,
        netMarginPerLiter,
      };
    });
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
  public get interval(): ProfitLossInterval {
    return this._interval;
  }
  public get totalMilkYieldLiters(): number {
    return this._totalMilkYieldLiters;
  }
  public get averageDailyYieldLiters(): number {
    return this._averageDailyYieldLiters;
  }
  public get daysCount(): number {
    return this._daysCount;
  }
  public get totalFeedExpense(): number {
    return this._totalFeedExpense;
  }
  public get totalOperatingExpense(): number {
    return this._totalOperatingExpense;
  }
  public get totalMilkRevenue(): number {
    return this._totalMilkRevenue;
  }
  public get feedCostPerLiter(): number {
    return this._feedCostPerLiter;
  }
  public get operatingCostPerLiter(): number {
    return this._operatingCostPerLiter;
  }
  public get revenuePerLiter(): number {
    return this._revenuePerLiter;
  }
  public get netMarginPerLiter(): number {
    return this._netMarginPerLiter;
  }
  public get feedCostPercentage(): number {
    return this._feedCostPercentage;
  }
  public get breakEvenMilkPrice(): number {
    return this._breakEvenMilkPrice;
  }
  public get isProfitablePerLiter(): boolean {
    return this._isProfitablePerLiter;
  }
  public get timeline(): CostPerLiterTimelinePointDto[] {
    return [...this._timeline];
  }

  public toResponseDto(): CostPerLiterResponseDto {
    return {
      farmId: this._farmId,
      startDate: this._startDate,
      endDate: this._endDate,
      currency: this._currency,
      interval: this._interval,
      totalMilkYieldLiters: this._totalMilkYieldLiters,
      averageDailyYieldLiters: this._averageDailyYieldLiters,
      daysCount: this._daysCount,
      totalFeedExpense: this._totalFeedExpense,
      totalOperatingExpense: this._totalOperatingExpense,
      totalMilkRevenue: this._totalMilkRevenue,
      feedCostPerLiter: this._feedCostPerLiter,
      operatingCostPerLiter: this._operatingCostPerLiter,
      revenuePerLiter: this._revenuePerLiter,
      netMarginPerLiter: this._netMarginPerLiter,
      feedCostPercentage: this._feedCostPercentage,
      breakEvenMilkPrice: this._breakEvenMilkPrice,
      isProfitablePerLiter: this._isProfitablePerLiter,
      timeline: this.timeline,
    };
  }
}
