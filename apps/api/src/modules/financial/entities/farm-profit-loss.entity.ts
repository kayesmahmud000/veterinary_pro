import {
  ProfitLossCategoryBreakdownDto,
  ProfitLossComparisonDto,
  ProfitLossInterval,
  ProfitLossStatementResponseDto,
  ProfitLossSummaryKpiDto,
  ProfitLossTimelinePointDto,
  TransactionCategory,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";

export interface CategoryAggregateRaw {
  category: TransactionCategory;
  amount: number;
  transactionCount: number;
}

export interface TimelinePointRaw {
  period: string; // ISO date string "YYYY-MM-DD" or month "YYYY-MM"
  amount: number;
  transactionCount: number;
}

export interface PreviousPeriodAggregateRaw {
  startDate: string;
  endDate: string;
  totalRevenue: number;
  totalExpense: number;
}

export interface FarmProfitLossEntityProps {
  farmId: string;
  startDate: string;
  endDate: string;
  currency?: string;
  interval?: ProfitLossInterval;
  revenueAggregates: CategoryAggregateRaw[];
  expenseAggregates: CategoryAggregateRaw[];
  revenueTimeline: TimelinePointRaw[];
  expenseTimeline: TimelinePointRaw[];
  previousPeriod?: PreviousPeriodAggregateRaw | null;
}

export class FarmProfitLossEntity {
  private readonly _farmId: string;
  private readonly _startDate: string;
  private readonly _endDate: string;
  private readonly _currency: string;
  private readonly _interval: ProfitLossInterval;
  private readonly _totalRevenue: number;
  private readonly _totalExpense: number;
  private readonly _netProfit: number;
  private readonly _isProfitable: boolean;
  private readonly _profitMarginPercentage: number;
  private readonly _operatingExpenseRatio: number;
  private readonly _revenueTransactionsCount: number;
  private readonly _expenseTransactionsCount: number;
  private readonly _revenueBreakdown: ProfitLossCategoryBreakdownDto[];
  private readonly _expenseBreakdown: ProfitLossCategoryBreakdownDto[];
  private readonly _timeline: ProfitLossTimelinePointDto[];
  private readonly _comparison?: ProfitLossComparisonDto;

  constructor(props: FarmProfitLossEntityProps) {
    this.validateDates(props.startDate, props.endDate);

    this._farmId = props.farmId;
    this._startDate = props.startDate;
    this._endDate = props.endDate;
    this._currency = (props.currency || "USD").toUpperCase();
    this._interval = props.interval || ProfitLossInterval.DAY;

    // Aggregate revenues
    let revSum = 0;
    let revCount = 0;
    for (const item of props.revenueAggregates) {
      revSum += Number(item.amount);
      revCount += Number(item.transactionCount);
    }
    this._totalRevenue = Math.round(revSum * 100) / 100;
    this._revenueTransactionsCount = revCount;

    // Aggregate expenses
    let expSum = 0;
    let expCount = 0;
    for (const item of props.expenseAggregates) {
      expSum += Number(item.amount);
      expCount += Number(item.transactionCount);
    }
    this._totalExpense = Math.round(expSum * 100) / 100;
    this._expenseTransactionsCount = expCount;

    // Net Profit & Profitability
    this._netProfit =
      Math.round((this._totalRevenue - this._totalExpense) * 100) / 100;
    this._isProfitable = this._netProfit > 0;

    // Profit Margin %: (Net Profit / Total Revenue) * 100
    if (this._totalRevenue > 0) {
      this._profitMarginPercentage =
        Math.round((this._netProfit / this._totalRevenue) * 10000) / 100;
    } else if (this._totalExpense > 0) {
      this._profitMarginPercentage = -100.0;
    } else {
      this._profitMarginPercentage = 0.0;
    }

    // Operating Expense Ratio %: (Total Expense / Total Revenue) * 100
    if (this._totalRevenue > 0) {
      this._operatingExpenseRatio =
        Math.round((this._totalExpense / this._totalRevenue) * 10000) / 100;
    } else if (this._totalExpense > 0) {
      this._operatingExpenseRatio = 100.0;
    } else {
      this._operatingExpenseRatio = 0.0;
    }

    // Category Breakdowns
    this._revenueBreakdown = this.computeCategoryBreakdown(
      props.revenueAggregates,
      this._totalRevenue
    );
    this._expenseBreakdown = this.computeCategoryBreakdown(
      props.expenseAggregates,
      this._totalExpense
    );

    // Synchronized Timeline
    this._timeline = this.synchronizeTimelines(
      props.revenueTimeline,
      props.expenseTimeline
    );

    // Previous Period Comparison
    if (props.previousPeriod) {
      this._comparison = this.computeComparison(props.previousPeriod);
    }
  }

  private validateDates(startDateStr: string, endDateStr: string): void {
    if (!startDateStr || !endDateStr) {
      throw new ValidationDomainException(
        "Both startDate and endDate are required"
      );
    }

    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    if (isNaN(start.getTime())) {
      throw new ValidationDomainException(
        `Invalid startDate format: ${startDateStr}. Expected YYYY-MM-DD`
      );
    }

    if (isNaN(end.getTime())) {
      throw new ValidationDomainException(
        `Invalid endDate format: ${endDateStr}. Expected YYYY-MM-DD`
      );
    }

    if (start.getTime() > end.getTime()) {
      throw new ValidationDomainException(
        `startDate (${startDateStr}) cannot be after endDate (${endDateStr})`
      );
    }

    const diffDays = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays > 1830) {
      throw new ValidationDomainException(
        "Date range exceeds maximum allowed span of 5 years (1830 days)"
      );
    }
  }

  private computeCategoryBreakdown(
    aggregates: CategoryAggregateRaw[],
    totalAmount: number
  ): ProfitLossCategoryBreakdownDto[] {
    return aggregates
      .map((item) => {
        const amount = Math.round(Number(item.amount) * 100) / 100;
        const transactionCount = Number(item.transactionCount);
        const percentage =
          totalAmount > 0
            ? Math.round((amount / totalAmount) * 10000) / 100
            : 0.0;

        return {
          category: item.category,
          amount,
          transactionCount,
          percentage,
        };
      })
      .sort((a, b) => b.amount - a.amount);
  }

  private synchronizeTimelines(
    revenueTimeline: TimelinePointRaw[],
    expenseTimeline: TimelinePointRaw[]
  ): ProfitLossTimelinePointDto[] {
    const revMap = new Map<string, number>();
    for (const r of revenueTimeline) {
      revMap.set(r.period, Math.round(Number(r.amount) * 100) / 100);
    }

    const expMap = new Map<string, number>();
    for (const e of expenseTimeline) {
      expMap.set(e.period, Math.round(Number(e.amount) * 100) / 100);
    }

    const allPeriods = Array.from(
      new Set([...revMap.keys(), ...expMap.keys()])
    ).sort();

    return allPeriods.map((period) => {
      const revenue = revMap.get(period) ?? 0.0;
      const expense = expMap.get(period) ?? 0.0;
      const netProfit = Math.round((revenue - expense) * 100) / 100;
      const marginPercentage =
        revenue > 0
          ? Math.round((netProfit / revenue) * 10000) / 100
          : expense > 0
          ? -100.0
          : 0.0;

      return {
        period,
        revenue,
        expense,
        netProfit,
        marginPercentage,
      };
    });
  }

  private computeComparison(
    prev: PreviousPeriodAggregateRaw
  ): ProfitLossComparisonDto {
    const prevRev = Math.round(Number(prev.totalRevenue) * 100) / 100;
    const prevExp = Math.round(Number(prev.totalExpense) * 100) / 100;
    const prevNet = Math.round((prevRev - prevExp) * 100) / 100;

    return {
      previousStartDate: prev.startDate,
      previousEndDate: prev.endDate,
      previousRevenue: prevRev,
      previousExpense: prevExp,
      previousNetProfit: prevNet,
      revenueGrowthPercentage: this.calcGrowth(this._totalRevenue, prevRev),
      expenseGrowthPercentage: this.calcGrowth(this._totalExpense, prevExp),
      netProfitGrowthPercentage: this.calcGrowth(this._netProfit, prevNet),
    };
  }

  private calcGrowth(current: number, previous: number): number | null {
    if (previous === 0) {
      return current === 0 ? 0.0 : null;
    }
    return (
      Math.round(((current - previous) / Math.abs(previous)) * 10000) / 100
    );
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

  public get totalRevenue(): number {
    return this._totalRevenue;
  }

  public get totalExpense(): number {
    return this._totalExpense;
  }

  public get netProfit(): number {
    return this._netProfit;
  }

  public get isProfitable(): boolean {
    return this._isProfitable;
  }

  public get profitMarginPercentage(): number {
    return this._profitMarginPercentage;
  }

  public get operatingExpenseRatio(): number {
    return this._operatingExpenseRatio;
  }

  public get revenueTransactionsCount(): number {
    return this._revenueTransactionsCount;
  }

  public get expenseTransactionsCount(): number {
    return this._expenseTransactionsCount;
  }

  public get revenueBreakdown(): ProfitLossCategoryBreakdownDto[] {
    return [...this._revenueBreakdown];
  }

  public get expenseBreakdown(): ProfitLossCategoryBreakdownDto[] {
    return [...this._expenseBreakdown];
  }

  public get timeline(): ProfitLossTimelinePointDto[] {
    return [...this._timeline];
  }

  public get comparison(): ProfitLossComparisonDto | undefined {
    return this._comparison ? { ...this._comparison } : undefined;
  }

  public toResponseDto(): ProfitLossStatementResponseDto {
    return {
      farmId: this._farmId,
      startDate: this._startDate,
      endDate: this._endDate,
      currency: this._currency,
      interval: this._interval,
      totalRevenue: this._totalRevenue,
      totalExpense: this._totalExpense,
      netProfit: this._netProfit,
      isProfitable: this._isProfitable,
      profitMarginPercentage: this._profitMarginPercentage,
      operatingExpenseRatio: this._operatingExpenseRatio,
      revenueTransactionsCount: this._revenueTransactionsCount,
      expenseTransactionsCount: this._expenseTransactionsCount,
      revenueBreakdown: this.revenueBreakdown,
      expenseBreakdown: this.expenseBreakdown,
      timeline: this.timeline,
      ...(this._comparison ? { comparison: this._comparison } : {}),
    };
  }

  public toSummaryKpiDto(): ProfitLossSummaryKpiDto {
    return {
      farmId: this._farmId,
      startDate: this._startDate,
      endDate: this._endDate,
      currency: this._currency,
      totalRevenue: this._totalRevenue,
      totalExpense: this._totalExpense,
      netProfit: this._netProfit,
      profitMarginPercentage: this._profitMarginPercentage,
      operatingExpenseRatio: this._operatingExpenseRatio,
      isProfitable: this._isProfitable,
    };
  }
}
