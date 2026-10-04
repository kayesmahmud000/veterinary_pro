import { Injectable, Logger } from "@nestjs/common";
import {
  Prisma,
  TransactionCategory as PrismaTransactionCategory,
  TransactionType as PrismaTransactionType,
} from "@prisma/client";
import { ProfitLossInterval } from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { CostPerLiterRawTimelineItem } from "../entities/cost-per-liter.entity";
import { AnimalWeightDataRaw } from "../entities/feed-conversion.entity";
import {
  CostPerLiterFilter,
  CostPerLiterRawData,
  FeedConversionFilter,
  FeedConversionRawData,
  IFarmFeedAnalyticsRepository,
} from "./farm-feed-analytics.repository.interface";

@Injectable()
export class FarmFeedAnalyticsRepository
  implements IFarmFeedAnalyticsRepository
{
  private readonly logger = new Logger(FarmFeedAnalyticsRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  public async getCostPerLiterData(
    filter: CostPerLiterFilter,
    tx?: Prisma.TransactionClient
  ): Promise<CostPerLiterRawData> {
    const client = tx ?? this.prisma;
    const interval = filter.interval || ProfitLossInterval.DAY;

    // 1. Query Milk Logs
    const milkLogWhere: Prisma.MilkLogWhereInput = {
      farmId: filter.farmId,
      loggedDate: {
        gte: filter.startDate,
        lte: filter.endDate,
      },
    };
    if (filter.animalId) {
      milkLogWhere.animalId = filter.animalId;
    }

    const milkLogs = await client.milkLog.findMany({
      where: milkLogWhere,
      select: {
        yieldLiters: true,
        loggedDate: true,
      },
      orderBy: {
        loggedDate: "asc",
      },
    });

    // 2. Query Financial Transactions
    const txWhere: Prisma.FarmTransactionWhereInput = {
      farmId: filter.farmId,
      deletedAt: null,
      txDate: {
        gte: filter.startDate,
        lte: filter.endDate,
      },
    };
    if (filter.animalId) {
      txWhere.animalId = filter.animalId;
    }

    const transactions = await client.farmTransaction.findMany({
      where: txWhere,
      select: {
        amount: true,
        type: true,
        category: true,
        currency: true,
        txDate: true,
      },
      orderBy: {
        txDate: "asc",
      },
    });

    const currency =
      transactions[0]?.currency ?? filter.currency ?? "USD";

    // Aggregations
    let totalMilkYieldLiters = 0;
    const milkTimelineMap = new Map<string, number>();

    for (const m of milkLogs) {
      const y = Number(m.yieldLiters);
      totalMilkYieldLiters += y;

      const period = this.formatPeriod(m.loggedDate, interval);
      milkTimelineMap.set(period, (milkTimelineMap.get(period) ?? 0) + y);
    }

    let totalFeedExpense = 0;
    let totalOperatingExpense = 0;
    let totalMilkRevenue = 0;

    const feedTimelineMap = new Map<string, number>();
    const operatingTimelineMap = new Map<string, number>();
    const revenueTimelineMap = new Map<string, number>();

    for (const t of transactions) {
      const amt = Number(t.amount);
      const period = this.formatPeriod(t.txDate, interval);

      if (t.type === PrismaTransactionType.EXPENSE) {
        totalOperatingExpense += amt;
        operatingTimelineMap.set(
          period,
          (operatingTimelineMap.get(period) ?? 0) + amt
        );

        if (t.category === PrismaTransactionCategory.FEED) {
          totalFeedExpense += amt;
          feedTimelineMap.set(
            period,
            (feedTimelineMap.get(period) ?? 0) + amt
          );
        }
      } else if (
        t.type === PrismaTransactionType.INCOME &&
        t.category === PrismaTransactionCategory.MILK_SALES
      ) {
        totalMilkRevenue += amt;
        revenueTimelineMap.set(
          period,
          (revenueTimelineMap.get(period) ?? 0) + amt
        );
      }
    }

    // Build timeline
    const allPeriods = Array.from(
      new Set([
        ...milkTimelineMap.keys(),
        ...feedTimelineMap.keys(),
        ...operatingTimelineMap.keys(),
        ...revenueTimelineMap.keys(),
      ])
    ).sort();

    const timeline: CostPerLiterRawTimelineItem[] = allPeriods.map(
      (period) => ({
        period,
        milkYieldLiters: milkTimelineMap.get(period) ?? 0,
        feedCost: feedTimelineMap.get(period) ?? 0,
        operatingCost: operatingTimelineMap.get(period) ?? 0,
        milkRevenue: revenueTimelineMap.get(period) ?? 0,
      })
    );

    return {
      currency,
      totalMilkYieldLiters: Math.round(totalMilkYieldLiters * 1000) / 1000,
      totalFeedExpense: Math.round(totalFeedExpense * 100) / 100,
      totalOperatingExpense: Math.round(totalOperatingExpense * 100) / 100,
      totalMilkRevenue: Math.round(totalMilkRevenue * 100) / 100,
      timeline,
    };
  }

  public async getFeedConversionData(
    filter: FeedConversionFilter,
    tx?: Prisma.TransactionClient
  ): Promise<FeedConversionRawData> {
    const client = tx ?? this.prisma;

    // 1. Query Feed Transactions
    const feedTxWhere: Prisma.FarmTransactionWhereInput = {
      farmId: filter.farmId,
      deletedAt: null,
      type: PrismaTransactionType.EXPENSE,
      category: PrismaTransactionCategory.FEED,
      txDate: {
        gte: filter.startDate,
        lte: filter.endDate,
      },
    };
    if (filter.animalId) {
      feedTxWhere.animalId = filter.animalId;
    }

    const feedTxs = await client.farmTransaction.findMany({
      where: feedTxWhere,
      select: {
        amount: true,
        currency: true,
        metadata: true,
      },
    });

    const currency = feedTxs[0]?.currency ?? "USD";
    let totalFeedExpense = 0;
    let extractedKg = 0;

    for (const t of feedTxs) {
      totalFeedExpense += Number(t.amount);
      const meta = t.metadata as Record<string, unknown> | null;
      if (meta && typeof meta["quantityKg"] === "number") {
        extractedKg += Number(meta["quantityKg"]);
      }
    }

    let totalFeedConsumedKg = 0;
    if (filter.assumedFeedKg !== undefined && filter.assumedFeedKg > 0) {
      totalFeedConsumedKg = filter.assumedFeedKg;
    } else if (extractedKg > 0) {
      totalFeedConsumedKg = extractedKg;
    } else if (
      filter.assumedFeedCostPerKg &&
      filter.assumedFeedCostPerKg > 0
    ) {
      totalFeedConsumedKg = totalFeedExpense / filter.assumedFeedCostPerKg;
    } else {
      // Default: If no mass metadata and no override, assume standard $0.35/kg or 0 if no expense
      totalFeedConsumedKg =
        totalFeedExpense > 0
          ? Math.round((totalFeedExpense / 0.35) * 100) / 100
          : 0;
    }

    // 2. Query Milk Yield
    const milkLogWhere: Prisma.MilkLogWhereInput = {
      farmId: filter.farmId,
      loggedDate: {
        gte: filter.startDate,
        lte: filter.endDate,
      },
    };
    if (filter.animalId) {
      milkLogWhere.animalId = filter.animalId;
    }

    const milkLogs = await client.milkLog.findMany({
      where: milkLogWhere,
      select: {
        yieldLiters: true,
      },
    });

    let totalMilkYieldLiters = 0;
    for (const m of milkLogs) {
      totalMilkYieldLiters += Number(m.yieldLiters);
    }

    // 3. Query Animal Weight Logs
    const weightWhere: Prisma.AnimalWeightLogWhereInput = {
      farmId: filter.farmId,
      recordedAt: {
        gte: filter.startDate,
        lte: filter.endDate,
      },
    };
    if (filter.animalId) {
      weightWhere.animalId = filter.animalId;
    }

    const weightLogs = await client.animalWeightLog.findMany({
      where: weightWhere,
      select: {
        animalId: true,
        weightKg: true,
        recordedAt: true,
        animal: {
          select: {
            id: true,
            tagNumber: true,
            name: true,
          },
        },
      },
      orderBy: {
        recordedAt: "asc",
      },
    });

    interface AnimalWeightEntry {
      tagNumber?: string;
      name?: string;
      weights: Array<{ weightKg: number; recordedAt: Date }>;
    }

    const animalWeightMap = new Map<string, AnimalWeightEntry>();

    for (const w of weightLogs) {
      let entry = animalWeightMap.get(w.animalId);
      if (!entry) {
        entry = {
          tagNumber: w.animal.tagNumber,
          name: w.animal.name ?? undefined,
          weights: [],
        };
        animalWeightMap.set(w.animalId, entry);
      }
      entry.weights.push({
        weightKg: Number(w.weightKg),
        recordedAt: w.recordedAt,
      });
    }

    const animalWeightData: AnimalWeightDataRaw[] = [];
    for (const [aId, entry] of animalWeightMap.entries()) {
      if (entry.weights.length > 0) {
        const initialWeightKg = entry.weights[0]!.weightKg;
        const finalWeightKg =
          entry.weights[entry.weights.length - 1]!.weightKg;

        animalWeightData.push({
          animalId: aId,
          tagNumber: entry.tagNumber,
          name: entry.name,
          initialWeightKg,
          finalWeightKg,
        });
      }
    }

    return {
      currency,
      totalFeedConsumedKg: Math.round(totalFeedConsumedKg * 100) / 100,
      totalFeedExpense: Math.round(totalFeedExpense * 100) / 100,
      totalMilkYieldLiters: Math.round(totalMilkYieldLiters * 1000) / 1000,
      animalWeightData,
    };
  }

  private formatPeriod(date: Date, interval: ProfitLossInterval): string {
    const isoString = date.toISOString();
    switch (interval) {
      case ProfitLossInterval.YEAR:
        return isoString.slice(0, 4);
      case ProfitLossInterval.MONTH:
        return isoString.slice(0, 7);
      case ProfitLossInterval.WEEK: {
        const d = new Date(date);
        const day = d.getUTCDay();
        const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
        d.setUTCDate(diff);
        return d.toISOString().split("T")[0]!;
      }
      case ProfitLossInterval.DAY:
      default:
        return isoString.split("T")[0]!;
    }
  }
}
