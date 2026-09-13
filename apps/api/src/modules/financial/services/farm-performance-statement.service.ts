import { Inject, Injectable, Logger } from "@nestjs/common";
import * as crypto from "crypto";
import {
  MonthlyPerformanceStatementDto,
  ProfitLossInterval,
} from "@vetralink/shared-types";
import {
  EntityNotFoundException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import { PrismaService } from "../../prisma/prisma.service";
import { MonthlyStatementQueryDto } from "../dto";
import { FarmPerformancePdfGenerator } from "../pdf/farm-performance-pdf.generator";
import {
  FARM_FEED_ANALYTICS_SERVICE,
  IFarmFeedAnalyticsService,
} from "./farm-feed-analytics.service.interface";
import {
  FARM_PERFORMANCE_STATEMENT_SERVICE,
  IFarmPerformanceStatementService,
  MonthlyPdfResult,
} from "./farm-performance-statement.service.interface";
import {
  FARM_PROFIT_LOSS_SERVICE,
  IFarmProfitLossService,
} from "./farm-profit-loss.service.interface";

@Injectable()
export class FarmPerformanceStatementService
  implements IFarmPerformanceStatementService
{
  private readonly logger = new Logger(FarmPerformanceStatementService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(FARM_PROFIT_LOSS_SERVICE)
    private readonly profitLossService: IFarmProfitLossService,
    @Inject(FARM_FEED_ANALYTICS_SERVICE)
    private readonly feedAnalyticsService: IFarmFeedAnalyticsService,
    private readonly pdfGenerator: FarmPerformancePdfGenerator
  ) {}

  public async generateMonthlyPdf(
    farmId: string,
    query: MonthlyStatementQueryDto,
    traceId?: string
  ): Promise<MonthlyPdfResult> {
    const statement = await this.getMonthlyStatementData(
      farmId,
      query,
      traceId
    );

    const pdfBuffer = await this.pdfGenerator.generatePdf(statement);

    const monthPadded = String(statement.period.month).padStart(2, "0");
    const filename = `farm-statement-${statement.farm.slug}-${statement.period.year}-${monthPadded}.pdf`;

    return {
      pdfBuffer,
      filename,
    };
  }

  public async getMonthlyStatementData(
    farmId: string,
    query: MonthlyStatementQueryDto,
    traceId?: string
  ): Promise<MonthlyPerformanceStatementDto> {
    const { year, month, startDate, endDate } = this.resolvePeriod(
      query.year,
      query.month
    );

    // 1. Fetch Farm Details
    const farm = await this.prisma.farm.findUnique({
      where: { id: farmId },
      select: {
        id: true,
        name: true,
        slug: true,
        farmType: true,
        country: true,
        settings: true,
      },
    });

    if (!farm) {
      throw new EntityNotFoundException("Farm", farmId);
    }

    const settings = (farm.settings as Record<string, unknown>) || {};
    const currency =
      (query.currency || (settings["currency"] as string) || "USD").toUpperCase();

    this.logger.log(
      `[${traceId || "NO-TRACE"}] Generating monthly statement data for farm '${farm.name}' (${startDate} to ${endDate}, currency: ${currency})`
    );

    // 2. Query Financial P&L
    const pnl = await this.profitLossService.generateProfitLoss(
      farmId,
      {
        startDate,
        endDate,
        currency,
        interval: ProfitLossInterval.MONTH,
      },
      traceId
    );

    // 3. Query Dairy & Cost-Per-Liter
    const cpl = await this.feedAnalyticsService.computeCostPerLiter(
      farmId,
      {
        startDate,
        endDate,
        currency,
        interval: ProfitLossInterval.MONTH,
      },
      traceId
    );

    // 4. Query Feed Conversion & Biological FCR
    const fcr = await this.feedAnalyticsService.computeFeedConversion(
      farmId,
      {
        startDate,
        endDate,
      },
      traceId
    );

    // 5. Generate Verification Hash & Timestamp
    const timestamp = new Date().toISOString().replace("T", " ").slice(0, 19);
    const hashPayload = {
      farmId,
      year,
      month,
      totalRevenue: pnl.totalRevenue,
      totalExpense: pnl.totalExpense,
      netProfit: pnl.netProfit,
      milkYield: cpl.totalMilkYieldLiters,
      feedConsumed: fcr.totalFeedConsumedKg,
      timestamp,
    };

    const statementHash = crypto
      .createHash("sha256")
      .update(JSON.stringify(hashPayload))
      .digest("hex")
      .slice(0, 32);

    return {
      farm: {
        id: farm.id,
        name: farm.name,
        slug: farm.slug,
        farmType: farm.farmType,
        country: farm.country,
        currency,
      },
      period: {
        year,
        month,
        startDate,
        endDate,
      },
      financialSummary: {
        totalRevenue: pnl.totalRevenue,
        totalExpense: pnl.totalExpense,
        netProfit: pnl.netProfit,
        profitMarginPercentage: pnl.profitMarginPercentage,
        operatingExpenseRatio: pnl.operatingExpenseRatio,
        isProfitable: pnl.isProfitable,
      },
      revenueBreakdown: pnl.revenueBreakdown,
      expenseBreakdown: pnl.expenseBreakdown,
      dairyMetrics: {
        totalMilkYieldLiters: cpl.totalMilkYieldLiters,
        averageDailyYieldLiters: cpl.averageDailyYieldLiters,
        feedCostPerLiter: cpl.feedCostPerLiter,
        operatingCostPerLiter: cpl.operatingCostPerLiter,
        revenuePerLiter: cpl.revenuePerLiter,
        netMarginPerLiter: cpl.netMarginPerLiter,
        breakEvenMilkPrice: cpl.breakEvenMilkPrice,
        isProfitablePerLiter: cpl.isProfitablePerLiter,
      },
      feedEfficiencyMetrics: {
        totalFeedConsumedKg: fcr.totalFeedConsumedKg,
        totalFeedExpense: fcr.totalFeedExpense,
        averageFeedCostPerKg: fcr.averageFeedCostPerKg,
        dairyFeedToMilkRatioKgPerLiter:
          fcr.dairyFeedEfficiency.feedToMilkRatioKgPerLiter,
        growthOverallFcr: fcr.growthFcr.overallFcr,
        growthRating: fcr.growthFcr.rating,
        dairyRating: fcr.dairyFeedEfficiency.rating,
      },
      statementMetadata: {
        generatedAt: timestamp,
        statementHash,
      },
    };
  }

  private resolvePeriod(
    yearInput?: number,
    monthInput?: number
  ): {
    year: number;
    month: number;
    startDate: string;
    endDate: string;
  } {
    const now = new Date();
    const year = yearInput ?? now.getUTCFullYear();
    const month = monthInput ?? now.getUTCMonth() + 1;

    if (month < 1 || month > 12) {
      throw new ValidationDomainException(
        `Invalid month: ${month}. Month must be between 1 and 12.`
      );
    }

    if (year < 2000 || year > 2100) {
      throw new ValidationDomainException(
        `Invalid year: ${year}. Year must be between 2000 and 2100.`
      );
    }

    const monthStr = String(month).padStart(2, "0");
    const startDate = `${year}-${monthStr}-01`;

    // Last day of month: day 0 of the next month
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const endDate = `${year}-${monthStr}-${String(lastDay).padStart(2, "0")}`;

    return { year, month, startDate, endDate };
  }
}
