import {
  DailyYieldPointDto,
  MilkYieldAnalyticsSummaryDto,
  MonthlyYieldPointDto,
  WeeklyYieldPointDto,
  YieldTrendDirection,
} from "@vetralink/shared-types";
import { MilkSession } from "@vetralink/shared-types";
import { MilkLogEntity } from "../entities/milk-log.entity";

export function round(value: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function formatDateToYmd(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function parseYmdToDate(ymd: string): Date {
  const [yearStr, monthStr, dayStr] = ymd.split("-");
  const year = parseInt(yearStr ?? "1970", 10);
  const month = parseInt(monthStr ?? "1", 10) - 1;
  const day = parseInt(dayStr ?? "1", 10);
  return new Date(Date.UTC(year, month, day, 0, 0, 0, 0));
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/**
 * Returns ISO week info (week string e.g. "2026-W37", week Monday, week Sunday)
 */
export function getIsoWeekInfo(date: Date): {
  week: string;
  startDate: string;
  endDate: string;
} {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  // In JS, 0 is Sunday, 1 is Monday... 6 is Saturday
  const dayOfWeek = d.getUTCDay();
  // Monday is 1, Sunday is 7
  const isoDay = dayOfWeek === 0 ? 7 : dayOfWeek;

  // Monday of this week
  const monday = new Date(d.getTime());
  monday.setUTCDate(d.getUTCDate() - (isoDay - 1));

  // Sunday of this week
  const sunday = new Date(monday.getTime());
  sunday.setUTCDate(monday.getUTCDate() + 6);

  // ISO week year calculation (Thursday determines the year)
  const thursday = new Date(monday.getTime());
  thursday.setUTCDate(monday.getUTCDate() + 3);
  const year = thursday.getUTCFullYear();

  const firstThursday = new Date(Date.UTC(year, 0, 4));
  const firstThursdayDay = firstThursday.getUTCDay() === 0 ? 7 : firstThursday.getUTCDay();
  const firstMonday = new Date(firstThursday.getTime());
  firstMonday.setUTCDate(firstThursday.getUTCDate() - (firstThursdayDay - 1));

  const diffMs = monday.getTime() - firstMonday.getTime();
  const weekNum = 1 + Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
  const weekString = `${year}-W${String(weekNum).padStart(2, "0")}`;

  return {
    week: weekString,
    startDate: formatDateToYmd(monday),
    endDate: formatDateToYmd(sunday),
  };
}

interface InternalDayBucket {
  date: string;
  morningYield: number;
  afternoonYield: number;
  eveningYield: number;
  totalYield: number;
  recordCount: number;
  fatValues: number[];
  snfValues: number[];
}

export class MilkYieldAnalyticsCalculator {
  /**
   * Aggregates raw milk logs into daily yield points with 7-day Simple Moving Average (7-SMA).
   * @param logs Milk logs covering the requested range PLUS a 6-day lookback window prior to startDate.
   * @param startDate Start date of requested range.
   * @param endDate End date of requested range.
   */
  public static computeDailyYieldPoints(
    logs: MilkLogEntity[],
    startDate: Date,
    endDate: Date
  ): DailyYieldPointDto[] {
    const lookbackStart = addDays(startDate, -6);

    // 1. Group logs by YYYY-MM-DD
    const bucketMap = new Map<string, InternalDayBucket>();

    for (const log of logs) {
      const dateKey = formatDateToYmd(log.loggedDate);
      let bucket = bucketMap.get(dateKey);
      if (!bucket) {
        bucket = {
          date: dateKey,
          morningYield: 0,
          afternoonYield: 0,
          eveningYield: 0,
          totalYield: 0,
          recordCount: 0,
          fatValues: [],
          snfValues: [],
        };
        bucketMap.set(dateKey, bucket);
      }

      bucket.recordCount += 1;
      const yieldLiters = log.yieldLiters;
      bucket.totalYield += yieldLiters;

      if (log.session === MilkSession.MORNING) {
        bucket.morningYield += yieldLiters;
      } else if (log.session === MilkSession.AFTERNOON) {
        bucket.afternoonYield += yieldLiters;
      } else if (log.session === MilkSession.EVENING) {
        bucket.eveningYield += yieldLiters;
      }

      if (log.fatPercent !== null && log.fatPercent !== undefined) {
        bucket.fatValues.push(log.fatPercent);
      }
      if (log.snfPercent !== null && log.snfPercent !== undefined) {
        bucket.snfValues.push(log.snfPercent);
      }
    }

    // 2. Generate a continuous daily lookup covering [lookbackStart, endDate]
    const continuousYields = new Map<string, number>();
    let iterDate = new Date(lookbackStart.getTime());
    while (iterDate <= endDate) {
      const dateKey = formatDateToYmd(iterDate);
      const bucket = bucketMap.get(dateKey);
      continuousYields.set(dateKey, bucket ? bucket.totalYield : 0);
      iterDate = addDays(iterDate, 1);
    }

    // 3. Construct DailyYieldPointDto for [startDate, endDate] with 7-SMA
    const result: DailyYieldPointDto[] = [];
    let curDate = new Date(startDate.getTime());

    while (curDate <= endDate) {
      const dateKey = formatDateToYmd(curDate);
      const bucket = bucketMap.get(dateKey);

      // Compute 7-day moving average: sum of previous 6 days + current day, divided by 7
      let sum7Days = 0;
      for (let k = 0; k < 7; k++) {
        const pastDateKey = formatDateToYmd(addDays(curDate, -k));
        sum7Days += continuousYields.get(pastDateKey) ?? 0;
      }
      const movingAverage7Day = round(sum7Days / 7);

      const totalYield = bucket ? round(bucket.totalYield) : 0;
      const morningYield = bucket ? round(bucket.morningYield) : 0;
      const afternoonYield = bucket ? round(bucket.afternoonYield) : 0;
      const eveningYield = bucket ? round(bucket.eveningYield) : 0;
      const recordCount = bucket ? bucket.recordCount : 0;

      let averageFatPercent: number | null = null;
      if (bucket && bucket.fatValues.length > 0) {
        const fatSum = bucket.fatValues.reduce((a, b) => a + b, 0);
        averageFatPercent = round(fatSum / bucket.fatValues.length);
      }

      let averageSnfPercent: number | null = null;
      if (bucket && bucket.snfValues.length > 0) {
        const snfSum = bucket.snfValues.reduce((a, b) => a + b, 0);
        averageSnfPercent = round(snfSum / bucket.snfValues.length);
      }

      result.push({
        date: dateKey,
        totalYieldLiters: totalYield,
        morningYieldLiters: morningYield,
        afternoonYieldLiters: afternoonYield,
        eveningYieldLiters: eveningYield,
        recordCount,
        averageFatPercent,
        averageSnfPercent,
        movingAverage7Day,
      });

      curDate = addDays(curDate, 1);
    }

    return result;
  }

  /**
   * Groups daily yield points into weekly aggregations by ISO calendar week.
   */
  public static computeWeeklyYieldPoints(
    dailyPoints: DailyYieldPointDto[]
  ): WeeklyYieldPointDto[] {
    const weekMap = new Map<
      string,
      {
        week: string;
        startDate: string;
        endDate: string;
        totalYield: number;
        activeDaysCount: number;
        recordCount: number;
        fatValues: number[];
        snfValues: number[];
      }
    >();

    for (const point of dailyPoints) {
      const pointDate = parseYmdToDate(point.date);
      const isoInfo = getIsoWeekInfo(pointDate);

      let group = weekMap.get(isoInfo.week);
      if (!group) {
        group = {
          week: isoInfo.week,
          startDate: isoInfo.startDate,
          endDate: isoInfo.endDate,
          totalYield: 0,
          activeDaysCount: 0,
          recordCount: 0,
          fatValues: [],
          snfValues: [],
        };
        weekMap.set(isoInfo.week, group);
      }

      group.totalYield += point.totalYieldLiters;
      group.recordCount += point.recordCount;
      if (point.recordCount > 0 || point.totalYieldLiters > 0) {
        group.activeDaysCount += 1;
      }
      if (point.averageFatPercent !== null) {
        group.fatValues.push(point.averageFatPercent);
      }
      if (point.averageSnfPercent !== null) {
        group.snfValues.push(point.averageSnfPercent);
      }
    }

    const result: WeeklyYieldPointDto[] = [];
    for (const group of weekMap.values()) {
      const dailyAverageYieldLiters =
        group.activeDaysCount > 0
          ? round(group.totalYield / group.activeDaysCount)
          : 0;

      let averageFatPercent: number | null = null;
      if (group.fatValues.length > 0) {
        averageFatPercent = round(
          group.fatValues.reduce((a, b) => a + b, 0) / group.fatValues.length
        );
      }

      let averageSnfPercent: number | null = null;
      if (group.snfValues.length > 0) {
        averageSnfPercent = round(
          group.snfValues.reduce((a, b) => a + b, 0) / group.snfValues.length
        );
      }

      result.push({
        week: group.week,
        startDate: group.startDate,
        endDate: group.endDate,
        totalYieldLiters: round(group.totalYield),
        dailyAverageYieldLiters,
        activeDaysCount: group.activeDaysCount,
        recordCount: group.recordCount,
        averageFatPercent,
        averageSnfPercent,
      });
    }

    return result;
  }

  /**
   * Groups daily yield points into monthly aggregations by calendar month (YYYY-MM).
   */
  public static computeMonthlyYieldPoints(
    dailyPoints: DailyYieldPointDto[]
  ): MonthlyYieldPointDto[] {
    const monthMap = new Map<
      string,
      {
        month: string;
        totalYield: number;
        activeDaysCount: number;
        recordCount: number;
        fatValues: number[];
        snfValues: number[];
      }
    >();

    for (const point of dailyPoints) {
      const monthKey = point.date.substring(0, 7); // YYYY-MM
      let group = monthMap.get(monthKey);
      if (!group) {
        group = {
          month: monthKey,
          totalYield: 0,
          activeDaysCount: 0,
          recordCount: 0,
          fatValues: [],
          snfValues: [],
        };
        monthMap.set(monthKey, group);
      }

      group.totalYield += point.totalYieldLiters;
      group.recordCount += point.recordCount;
      if (point.recordCount > 0 || point.totalYieldLiters > 0) {
        group.activeDaysCount += 1;
      }
      if (point.averageFatPercent !== null) {
        group.fatValues.push(point.averageFatPercent);
      }
      if (point.averageSnfPercent !== null) {
        group.snfValues.push(point.averageSnfPercent);
      }
    }

    const result: MonthlyYieldPointDto[] = [];
    for (const group of monthMap.values()) {
      const dailyAverageYieldLiters =
        group.activeDaysCount > 0
          ? round(group.totalYield / group.activeDaysCount)
          : 0;

      let averageFatPercent: number | null = null;
      if (group.fatValues.length > 0) {
        averageFatPercent = round(
          group.fatValues.reduce((a, b) => a + b, 0) / group.fatValues.length
        );
      }

      let averageSnfPercent: number | null = null;
      if (group.snfValues.length > 0) {
        averageSnfPercent = round(
          group.snfValues.reduce((a, b) => a + b, 0) / group.snfValues.length
        );
      }

      result.push({
        month: group.month,
        totalYieldLiters: round(group.totalYield),
        dailyAverageYieldLiters,
        activeDaysCount: group.activeDaysCount,
        recordCount: group.recordCount,
        averageFatPercent,
        averageSnfPercent,
      });
    }

    return result;
  }

  /**
   * Computes executive macro summary KPIs and rolling trend trajectory across the period.
   */
  public static computeSummaryStatistics(
    dailyPoints: DailyYieldPointDto[],
    totalRawRecords: number
  ): MilkYieldAnalyticsSummaryDto {
    if (dailyPoints.length === 0) {
      return {
        totalYieldLiters: 0,
        dailyAverageLiters: 0,
        peakYieldDate: null,
        peakYieldLiters: 0,
        lowestYieldDate: null,
        lowestYieldLiters: 0,
        totalRecords: totalRawRecords,
        activeDays: 0,
        averageFatPercent: null,
        averageSnfPercent: null,
        trendPercentage: null,
        trendDirection: "STABLE",
      };
    }

    let totalYield = 0;
    let activeDays = 0;
    let peakYieldDate: string | null = null;
    let peakYieldLiters = 0;
    let lowestYieldDate: string | null = null;
    let lowestYieldLiters = Infinity;

    const fatValues: number[] = [];
    const snfValues: number[] = [];

    for (const point of dailyPoints) {
      totalYield += point.totalYieldLiters;

      if (point.recordCount > 0 || point.totalYieldLiters > 0) {
        activeDays += 1;

        if (point.totalYieldLiters > peakYieldLiters) {
          peakYieldLiters = point.totalYieldLiters;
          peakYieldDate = point.date;
        }

        if (point.totalYieldLiters < lowestYieldLiters) {
          lowestYieldLiters = point.totalYieldLiters;
          lowestYieldDate = point.date;
        }
      }

      if (point.averageFatPercent !== null) {
        fatValues.push(point.averageFatPercent);
      }
      if (point.averageSnfPercent !== null) {
        snfValues.push(point.averageSnfPercent);
      }
    }

    if (lowestYieldLiters === Infinity) {
      lowestYieldLiters = 0;
    }

    const dailyAverageLiters =
      activeDays > 0 ? round(totalYield / activeDays) : 0;

    let averageFatPercent: number | null = null;
    if (fatValues.length > 0) {
      averageFatPercent = round(
        fatValues.reduce((a, b) => a + b, 0) / fatValues.length
      );
    }

    let averageSnfPercent: number | null = null;
    if (snfValues.length > 0) {
      averageSnfPercent = round(
        snfValues.reduce((a, b) => a + b, 0) / snfValues.length
      );
    }

    // Trend calculation based on 7-SMA start vs end
    const firstDay = dailyPoints[0]!;
    const lastDay = dailyPoints[dailyPoints.length - 1]!;
    const startSMA = firstDay.movingAverage7Day;
    const endSMA = lastDay.movingAverage7Day;

    let trendPercentage: number | null = null;
    let trendDirection: YieldTrendDirection = "STABLE";

    if (startSMA > 0) {
      trendPercentage = round(((endSMA - startSMA) / startSMA) * 100);
      if (trendPercentage >= 3) {
        trendDirection = "INCREASING";
      } else if (trendPercentage <= -3) {
        trendDirection = "DECREASING";
      } else {
        trendDirection = "STABLE";
      }
    } else if (endSMA > 0) {
      trendPercentage = 100;
      trendDirection = "INCREASING";
    } else {
      trendPercentage = 0;
      trendDirection = "STABLE";
    }

    return {
      totalYieldLiters: round(totalYield),
      dailyAverageLiters,
      peakYieldDate,
      peakYieldLiters: round(peakYieldLiters),
      lowestYieldDate,
      lowestYieldLiters: round(lowestYieldLiters),
      totalRecords: totalRawRecords,
      activeDays,
      averageFatPercent,
      averageSnfPercent,
      trendPercentage,
      trendDirection,
    };
  }
}
