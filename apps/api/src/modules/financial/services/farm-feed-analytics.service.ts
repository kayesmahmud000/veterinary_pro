import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  CostPerLiterResponseDto,
  FeedConversionResponseDto,
  ProfitLossInterval,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import { CostPerLiterQueryDto, FeedConversionQueryDto } from "../dto";
import { CostPerLiterEntity } from "../entities/cost-per-liter.entity";
import { FeedConversionEntity } from "../entities/feed-conversion.entity";
import {
  FARM_FEED_ANALYTICS_REPOSITORY,
  IFarmFeedAnalyticsRepository,
} from "../repositories/farm-feed-analytics.repository.interface";
import { IFarmFeedAnalyticsService } from "./farm-feed-analytics.service.interface";

@Injectable()
export class FarmFeedAnalyticsService implements IFarmFeedAnalyticsService {
  private readonly logger = new Logger(FarmFeedAnalyticsService.name);

  constructor(
    @Inject(FARM_FEED_ANALYTICS_REPOSITORY)
    private readonly feedRepo: IFarmFeedAnalyticsRepository
  ) {}

  public async computeCostPerLiter(
    farmId: string,
    query: CostPerLiterQueryDto,
    traceId?: string
  ): Promise<CostPerLiterResponseDto> {
    const { startDate, endDate, startDateStr, endDateStr } =
      this.resolveDateRange(query.startDate, query.endDate);

    const interval =
      query.interval || this.resolveDefaultInterval(startDate, endDate);

    this.logger.log(
      `[${traceId || "NO-TRACE"}] Computing Cost-Per-Liter for farm '${farmId}' (${startDateStr} to ${endDateStr}, interval: ${interval})`
    );

    const rawData = await this.feedRepo.getCostPerLiterData({
      farmId,
      startDate,
      endDate,
      animalId: query.animalId,
      currency: query.currency,
      interval,
    });

    const entity = new CostPerLiterEntity({
      farmId,
      startDate: startDateStr,
      endDate: endDateStr,
      currency: rawData.currency,
      interval,
      totalMilkYieldLiters: rawData.totalMilkYieldLiters,
      totalFeedExpense: rawData.totalFeedExpense,
      totalOperatingExpense: rawData.totalOperatingExpense,
      totalMilkRevenue: rawData.totalMilkRevenue,
      timeline: rawData.timeline,
    });

    return entity.toResponseDto();
  }

  public async computeFeedConversion(
    farmId: string,
    query: FeedConversionQueryDto,
    traceId?: string
  ): Promise<FeedConversionResponseDto> {
    const { startDate, endDate, startDateStr, endDateStr } =
      this.resolveDateRange(query.startDate, query.endDate);

    this.logger.log(
      `[${traceId || "NO-TRACE"}] Computing Feed Conversion Ratio for farm '${farmId}' (${startDateStr} to ${endDateStr})`
    );

    const rawData = await this.feedRepo.getFeedConversionData({
      farmId,
      startDate,
      endDate,
      animalId: query.animalId,
      assumedFeedKg: query.assumedFeedKg,
      assumedFeedCostPerKg: query.assumedFeedCostPerKg,
    });

    const entity = new FeedConversionEntity({
      farmId,
      startDate: startDateStr,
      endDate: endDateStr,
      currency: rawData.currency,
      totalFeedConsumedKg: rawData.totalFeedConsumedKg,
      totalFeedExpense: rawData.totalFeedExpense,
      totalMilkYieldLiters: rawData.totalMilkYieldLiters,
      animalWeightData: rawData.animalWeightData,
    });

    return entity.toResponseDto();
  }

  private resolveDateRange(
    startInput?: string,
    endInput?: string
  ): {
    startDate: Date;
    endDate: Date;
    startDateStr: string;
    endDateStr: string;
  } {
    const now = new Date();

    let startDateStr: string;
    if (startInput) {
      startDateStr = startInput;
    } else {
      const y = now.getUTCFullYear();
      const m = String(now.getUTCMonth() + 1).padStart(2, "0");
      startDateStr = `${y}-${m}-01`;
    }

    let endDateStr: string;
    if (endInput) {
      endDateStr = endInput;
    } else {
      const y = now.getUTCFullYear();
      const m = String(now.getUTCMonth() + 1).padStart(2, "0");
      const d = String(now.getUTCDate()).padStart(2, "0");
      endDateStr = `${y}-${m}-${d}`;
    }

    const startDate = new Date(`${startDateStr}T00:00:00.000Z`);
    const endDate = new Date(`${endDateStr}T23:59:59.999Z`);

    if (isNaN(startDate.getTime())) {
      throw new ValidationDomainException(
        `Invalid startDate: '${startInput}'. Expected YYYY-MM-DD`
      );
    }
    if (isNaN(endDate.getTime())) {
      throw new ValidationDomainException(
        `Invalid endDate: '${endInput}'. Expected YYYY-MM-DD`
      );
    }

    if (startDate.getTime() > endDate.getTime()) {
      throw new ValidationDomainException(
        `startDate (${startDateStr}) cannot be after endDate (${endDateStr})`
      );
    }

    return { startDate, endDate, startDateStr, endDateStr };
  }

  private resolveDefaultInterval(start: Date, end: Date): ProfitLossInterval {
    const diffDays = Math.ceil(
      (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (diffDays <= 31) {
      return ProfitLossInterval.DAY;
    }
    if (diffDays <= 180) {
      return ProfitLossInterval.WEEK;
    }
    return ProfitLossInterval.MONTH;
  }
}
