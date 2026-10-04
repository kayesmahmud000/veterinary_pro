import { MilkSession } from "@vetralink/shared-types";
import { MilkLogEntity } from "../entities/milk-log.entity";
import {
  addDays,
  formatDateToYmd,
  getIsoWeekInfo,
  MilkYieldAnalyticsCalculator,
  parseYmdToDate,
  round,
} from "./milk-yield-analytics.util";

describe("MilkYieldAnalyticsCalculator", () => {
  const mockFarmId = "11111111-1111-1111-1111-111111111111";
  const mockUserId = "22222222-2222-2222-2222-222222222222";
  const mockAnimalId = "33333333-3333-3333-3333-333333333333";

  const createMockLog = (
    dateStr: string,
    session: MilkSession,
    yieldLiters: number,
    fat?: number,
    snf?: number
  ): MilkLogEntity => {
    return new MilkLogEntity({
      id: crypto.randomUUID(),
      farmId: mockFarmId,
      animalId: mockAnimalId,
      recordedById: mockUserId,
      session,
      yieldLiters,
      fatPercent: fat ?? null,
      snfPercent: snf ?? null,
      loggedDate: parseYmdToDate(dateStr),
      syncVersion: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  describe("Date and Math Helpers", () => {
    it("should round numbers accurately to 2 decimal places", () => {
      expect(round(12.3456)).toBe(12.35);
      expect(round(12.3444)).toBe(12.34);
      expect(round(0.1 + 0.2)).toBe(0.3);
    });

    it("should format and parse dates to/from YYYY-MM-DD in UTC", () => {
      const ymd = "2026-09-13";
      const date = parseYmdToDate(ymd);
      expect(formatDateToYmd(date)).toBe(ymd);
      expect(date.getUTCFullYear()).toBe(2026);
      expect(date.getUTCMonth()).toBe(8); // September is month index 8
      expect(date.getUTCDate()).toBe(13);
    });

    it("should add days correctly across month boundaries", () => {
      const aug31 = parseYmdToDate("2026-08-31");
      const sep1 = addDays(aug31, 1);
      expect(formatDateToYmd(sep1)).toBe("2026-09-01");

      const sep7 = addDays(sep1, 6);
      expect(formatDateToYmd(sep7)).toBe("2026-09-07");
    });

    it("should compute ISO week string and bounds", () => {
      // 2026-09-13 is Sunday of week 37
      const sunday = parseYmdToDate("2026-09-13");
      const info = getIsoWeekInfo(sunday);
      expect(info.week).toBe("2026-W37");
      expect(info.startDate).toBe("2026-09-07"); // Monday
      expect(info.endDate).toBe("2026-09-13"); // Sunday
    });
  });

  describe("Daily Yield Points & 7-Day Moving Average", () => {
    it("should aggregate multiple sessions on the same date and compute 7-SMA using lookback window", () => {
      // Create 7 days of historical logs: 2026-09-01 to 2026-09-07 (each day 10L morning + 10L afternoon = 20L)
      const logs: MilkLogEntity[] = [];

      for (let i = 1; i <= 7; i++) {
        const dayStr = `2026-09-0${i}`;
        logs.push(
          createMockLog(dayStr, MilkSession.MORNING, 10, 3.8, 8.5),
          createMockLog(dayStr, MilkSession.AFTERNOON, 10, 4.0, 8.7)
        );
      }

      // Query range: 2026-09-07 to 2026-09-07 (1 day, with 6 days lookback 2026-09-01 to 2026-09-06)
      const startDate = parseYmdToDate("2026-09-07");
      const endDate = parseYmdToDate("2026-09-07");

      const points = MilkYieldAnalyticsCalculator.computeDailyYieldPoints(
        logs,
        startDate,
        endDate
      );

      expect(points).toHaveLength(1);
      const point = points[0]!;
      expect(point.date).toBe("2026-09-07");
      expect(point.morningYieldLiters).toBe(10);
      expect(point.afternoonYieldLiters).toBe(10);
      expect(point.eveningYieldLiters).toBe(0);
      expect(point.totalYieldLiters).toBe(20);
      expect(point.recordCount).toBe(2);
      expect(point.averageFatPercent).toBe(3.9);
      expect(point.averageSnfPercent).toBe(8.6);
      // All 7 days had 20L yield -> 7-SMA must be 20L
      expect(point.movingAverage7Day).toBe(20);
    });

    it("should fill missing dates with zero yield and correctly calculate 7-SMA over calendar days", () => {
      // Only 2026-09-07 has 14L of milk, all previous 6 days had 0
      const logs = [createMockLog("2026-09-07", MilkSession.MORNING, 14)];

      const startDate = parseYmdToDate("2026-09-07");
      const endDate = parseYmdToDate("2026-09-07");

      const points = MilkYieldAnalyticsCalculator.computeDailyYieldPoints(
        logs,
        startDate,
        endDate
      );

      expect(points).toHaveLength(1);
      expect(points[0]!.totalYieldLiters).toBe(14);
      // 14 / 7 days = 2.0
      expect(points[0]!.movingAverage7Day).toBe(2.0);
    });

    it("should handle empty logs gracefully across a multi-day range", () => {
      const startDate = parseYmdToDate("2026-09-01");
      const endDate = parseYmdToDate("2026-09-03");

      const points = MilkYieldAnalyticsCalculator.computeDailyYieldPoints(
        [],
        startDate,
        endDate
      );

      expect(points).toHaveLength(3);
      expect(points[0]!.totalYieldLiters).toBe(0);
      expect(points[0]!.movingAverage7Day).toBe(0);
      expect(points[0]!.averageFatPercent).toBeNull();
      expect(points[0]!.averageSnfPercent).toBeNull();
    });
  });

  describe("Weekly Yield Aggregation", () => {
    it("should group daily points into ISO calendar weeks", () => {
      // 2026-09-07 (Mon) to 2026-09-13 (Sun) is week 2026-W37
      const dailyPoints = [
        {
          date: "2026-09-07",
          totalYieldLiters: 25,
          morningYieldLiters: 15,
          afternoonYieldLiters: 10,
          eveningYieldLiters: 0,
          recordCount: 2,
          averageFatPercent: 3.8,
          averageSnfPercent: 8.5,
          movingAverage7Day: 25,
        },
        {
          date: "2026-09-08",
          totalYieldLiters: 30,
          morningYieldLiters: 15,
          afternoonYieldLiters: 15,
          eveningYieldLiters: 0,
          recordCount: 2,
          averageFatPercent: 4.0,
          averageSnfPercent: 8.6,
          movingAverage7Day: 26,
        },
        // A day with zero milk
        {
          date: "2026-09-09",
          totalYieldLiters: 0,
          morningYieldLiters: 0,
          afternoonYieldLiters: 0,
          eveningYieldLiters: 0,
          recordCount: 0,
          averageFatPercent: null,
          averageSnfPercent: null,
          movingAverage7Day: 20,
        },
      ];

      const weekly = MilkYieldAnalyticsCalculator.computeWeeklyYieldPoints(dailyPoints);

      expect(weekly).toHaveLength(1);
      const w = weekly[0]!;
      expect(w.week).toBe("2026-W37");
      expect(w.startDate).toBe("2026-09-07");
      expect(w.endDate).toBe("2026-09-13");
      expect(w.totalYieldLiters).toBe(55);
      expect(w.recordCount).toBe(4);
      expect(w.activeDaysCount).toBe(2);
      expect(w.dailyAverageYieldLiters).toBe(27.5); // 55 / 2 active days
      expect(w.averageFatPercent).toBe(3.9);
      expect(w.averageSnfPercent).toBe(8.55);
    });
  });

  describe("Monthly Yield Aggregation", () => {
    it("should group daily points into calendar months YYYY-MM", () => {
      const dailyPoints = [
        {
          date: "2026-08-31",
          totalYieldLiters: 20,
          morningYieldLiters: 20,
          afternoonYieldLiters: 0,
          eveningYieldLiters: 0,
          recordCount: 1,
          averageFatPercent: 3.8,
          averageSnfPercent: 8.5,
          movingAverage7Day: 20,
        },
        {
          date: "2026-09-01",
          totalYieldLiters: 30,
          morningYieldLiters: 15,
          afternoonYieldLiters: 15,
          eveningYieldLiters: 0,
          recordCount: 2,
          averageFatPercent: 4.0,
          averageSnfPercent: 8.7,
          movingAverage7Day: 22,
        },
      ];

      const monthly = MilkYieldAnalyticsCalculator.computeMonthlyYieldPoints(dailyPoints);

      expect(monthly).toHaveLength(2);
      expect(monthly[0]!.month).toBe("2026-08");
      expect(monthly[0]!.totalYieldLiters).toBe(20);
      expect(monthly[0]!.activeDaysCount).toBe(1);

      expect(monthly[1]!.month).toBe("2026-09");
      expect(monthly[1]!.totalYieldLiters).toBe(30);
      expect(monthly[1]!.activeDaysCount).toBe(1);
    });
  });

  describe("Summary Statistics & Trend Trajectory", () => {
    it("should identify peak, lowest, averages, and trend direction INCREASING", () => {
      const dailyPoints = [
        {
          date: "2026-09-01",
          totalYieldLiters: 20,
          morningYieldLiters: 10,
          afternoonYieldLiters: 10,
          eveningYieldLiters: 0,
          recordCount: 2,
          averageFatPercent: 3.8,
          averageSnfPercent: 8.5,
          movingAverage7Day: 20,
        },
        {
          date: "2026-09-02",
          totalYieldLiters: 35, // Peak
          morningYieldLiters: 20,
          afternoonYieldLiters: 15,
          eveningYieldLiters: 0,
          recordCount: 2,
          averageFatPercent: 4.0,
          averageSnfPercent: 8.7,
          movingAverage7Day: 23,
        },
        {
          date: "2026-09-03",
          totalYieldLiters: 15, // Lowest
          morningYieldLiters: 15,
          afternoonYieldLiters: 0,
          eveningYieldLiters: 0,
          recordCount: 1,
          averageFatPercent: 3.9,
          averageSnfPercent: 8.6,
          movingAverage7Day: 25, // 25 vs 20 = +25%
        },
      ];

      const summary = MilkYieldAnalyticsCalculator.computeSummaryStatistics(
        dailyPoints,
        5
      );

      expect(summary.totalYieldLiters).toBe(70);
      expect(summary.activeDays).toBe(3);
      expect(summary.dailyAverageLiters).toBe(23.33);
      expect(summary.peakYieldDate).toBe("2026-09-02");
      expect(summary.peakYieldLiters).toBe(35);
      expect(summary.lowestYieldDate).toBe("2026-09-03");
      expect(summary.lowestYieldLiters).toBe(15);
      expect(summary.totalRecords).toBe(5);
      expect(summary.trendPercentage).toBe(25);
      expect(summary.trendDirection).toBe("INCREASING");
    });

    it("should detect DECREASING trend when moving average drops by >= 3%", () => {
      const dailyPoints = [
        {
          date: "2026-09-01",
          totalYieldLiters: 30,
          morningYieldLiters: 30,
          afternoonYieldLiters: 0,
          eveningYieldLiters: 0,
          recordCount: 1,
          averageFatPercent: 3.8,
          averageSnfPercent: 8.5,
          movingAverage7Day: 30,
        },
        {
          date: "2026-09-02",
          totalYieldLiters: 20,
          morningYieldLiters: 20,
          afternoonYieldLiters: 0,
          eveningYieldLiters: 0,
          recordCount: 1,
          averageFatPercent: 3.8,
          averageSnfPercent: 8.5,
          movingAverage7Day: 27, // -10% drop
        },
      ];

      const summary = MilkYieldAnalyticsCalculator.computeSummaryStatistics(
        dailyPoints,
        2
      );
      expect(summary.trendPercentage).toBe(-10);
      expect(summary.trendDirection).toBe("DECREASING");
    });

    it("should detect STABLE trend when change is within [-3%, +3%]", () => {
      const dailyPoints = [
        {
          date: "2026-09-01",
          totalYieldLiters: 100,
          morningYieldLiters: 100,
          afternoonYieldLiters: 0,
          eveningYieldLiters: 0,
          recordCount: 1,
          averageFatPercent: null,
          averageSnfPercent: null,
          movingAverage7Day: 100,
        },
        {
          date: "2026-09-02",
          totalYieldLiters: 101,
          morningYieldLiters: 101,
          afternoonYieldLiters: 0,
          eveningYieldLiters: 0,
          recordCount: 1,
          averageFatPercent: null,
          averageSnfPercent: null,
          movingAverage7Day: 101, // +1% change
        },
      ];

      const summary = MilkYieldAnalyticsCalculator.computeSummaryStatistics(
        dailyPoints,
        2
      );
      expect(summary.trendPercentage).toBe(1);
      expect(summary.trendDirection).toBe("STABLE");
    });

    it("should return clean zeroed summary when daily points array is empty", () => {
      const summary = MilkYieldAnalyticsCalculator.computeSummaryStatistics([], 0);
      expect(summary.totalYieldLiters).toBe(0);
      expect(summary.dailyAverageLiters).toBe(0);
      expect(summary.peakYieldDate).toBeNull();
      expect(summary.lowestYieldDate).toBeNull();
      expect(summary.trendPercentage).toBeNull();
      expect(summary.trendDirection).toBe("STABLE");
    });
  });
});
