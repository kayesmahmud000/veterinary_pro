import { Injectable, Logger } from "@nestjs/common";
import {
  Prisma,
  TransactionType as PrismaTransactionType,
} from "@prisma/client";
import {
  ProfitLossInterval,
  TransactionCategory,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import {
  CategoryAggregateRaw,
  PreviousPeriodAggregateRaw,
  TimelinePointRaw,
} from "../entities/farm-profit-loss.entity";
import {
  IFarmProfitLossRepository,
  ProfitLossDataFilter,
  ProfitLossRawData,
} from "./farm-profit-loss.repository.interface";

@Injectable()
export class FarmProfitLossRepository implements IFarmProfitLossRepository {
  private readonly logger = new Logger(FarmProfitLossRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  public async getProfitLossData(
    filter: ProfitLossDataFilter,
    tx?: Prisma.TransactionClient
  ): Promise<ProfitLossRawData> {
    const client = tx ?? this.prisma;
    const interval = filter.interval || ProfitLossInterval.DAY;

    const where: Prisma.FarmTransactionWhereInput = {
      farmId: filter.farmId,
      deletedAt: null,
      txDate: {
        gte: filter.startDate,
        lte: filter.endDate,
      },
    };

    if (filter.animalId) {
      where.animalId = filter.animalId;
    }

    // Fetch primary period records
    const records = await client.farmTransaction.findMany({
      where,
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

    const currency = records[0]?.currency ?? filter.currency ?? "USD";

    // Category aggregation maps
    const revCategoryMap = new Map<
      TransactionCategory,
      { amount: number; count: number }
    >();
    const expCategoryMap = new Map<
      TransactionCategory,
      { amount: number; count: number }
    >();

    // Timeline maps
    const revTimelineMap = new Map<
      string,
      { amount: number; count: number }
    >();
    const expTimelineMap = new Map<
      string,
      { amount: number; count: number }
    >();

    for (const rec of records) {
      const amt = Number(rec.amount);
      const cat = rec.category as unknown as TransactionCategory;
      const periodKey = this.formatPeriod(rec.txDate, interval);

      if (rec.type === PrismaTransactionType.INCOME) {
        // Category
        const cEntry = revCategoryMap.get(cat) ?? { amount: 0, count: 0 };
        cEntry.amount += amt;
        cEntry.count += 1;
        revCategoryMap.set(cat, cEntry);

        // Timeline
        const tEntry = revTimelineMap.get(periodKey) ?? { amount: 0, count: 0 };
        tEntry.amount += amt;
        tEntry.count += 1;
        revTimelineMap.set(periodKey, tEntry);
      } else if (rec.type === PrismaTransactionType.EXPENSE) {
        // Category
        const cEntry = expCategoryMap.get(cat) ?? { amount: 0, count: 0 };
        cEntry.amount += amt;
        cEntry.count += 1;
        expCategoryMap.set(cat, cEntry);

        // Timeline
        const tEntry = expTimelineMap.get(periodKey) ?? { amount: 0, count: 0 };
        tEntry.amount += amt;
        tEntry.count += 1;
        expTimelineMap.set(periodKey, tEntry);
      }
    }

    const revenueAggregates: CategoryAggregateRaw[] = Array.from(
      revCategoryMap.entries()
    ).map(([category, data]) => ({
      category,
      amount: Math.round(data.amount * 100) / 100,
      transactionCount: data.count,
    }));

    const expenseAggregates: CategoryAggregateRaw[] = Array.from(
      expCategoryMap.entries()
    ).map(([category, data]) => ({
      category,
      amount: Math.round(data.amount * 100) / 100,
      transactionCount: data.count,
    }));

    const revenueTimeline: TimelinePointRaw[] = Array.from(
      revTimelineMap.entries()
    ).map(([period, data]) => ({
      period,
      amount: Math.round(data.amount * 100) / 100,
      transactionCount: data.count,
    }));

    const expenseTimeline: TimelinePointRaw[] = Array.from(
      expTimelineMap.entries()
    ).map(([period, data]) => ({
      period,
      amount: Math.round(data.amount * 100) / 100,
      transactionCount: data.count,
    }));

    // Previous period query if requested
    let previousPeriod: PreviousPeriodAggregateRaw | null = null;
    if (filter.previousStartDate && filter.previousEndDate) {
      const prevWhere: Prisma.FarmTransactionWhereInput = {
        farmId: filter.farmId,
        deletedAt: null,
        txDate: {
          gte: filter.previousStartDate,
          lte: filter.previousEndDate,
        },
      };

      if (filter.animalId) {
        prevWhere.animalId = filter.animalId;
      }

      const prevRecords = await client.farmTransaction.findMany({
        where: prevWhere,
        select: {
          amount: true,
          type: true,
        },
      });

      let prevRev = 0;
      let prevExp = 0;
      for (const r of prevRecords) {
        const amt = Number(r.amount);
        if (r.type === PrismaTransactionType.INCOME) {
          prevRev += amt;
        } else if (r.type === PrismaTransactionType.EXPENSE) {
          prevExp += amt;
        }
      }

      previousPeriod = {
        startDate: filter.previousStartDate.toISOString().split("T")[0]!,
        endDate: filter.previousEndDate.toISOString().split("T")[0]!,
        totalRevenue: Math.round(prevRev * 100) / 100,
        totalExpense: Math.round(prevExp * 100) / 100,
      };
    }

    return {
      currency,
      revenueAggregates,
      expenseAggregates,
      revenueTimeline,
      expenseTimeline,
      previousPeriod,
    };
  }

  private formatPeriod(date: Date, interval: ProfitLossInterval): string {
    const isoString = date.toISOString();
    switch (interval) {
      case ProfitLossInterval.YEAR:
        return isoString.slice(0, 4); // YYYY
      case ProfitLossInterval.MONTH:
        return isoString.slice(0, 7); // YYYY-MM
      case ProfitLossInterval.WEEK: {
        // Return Monday date of that week YYYY-MM-DD
        const d = new Date(date);
        const day = d.getUTCDay(); // 0 is Sunday, 1 is Monday, etc.
        const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
        d.setUTCDate(diff);
        return d.toISOString().split("T")[0]!;
      }
      case ProfitLossInterval.DAY:
      default:
        return isoString.split("T")[0]!; // YYYY-MM-DD
    }
  }
}
