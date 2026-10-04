import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  ProfitLossInterval,
  ProfitLossStatementResponseDto,
  ProfitLossSummaryKpiDto,
} from "@vetralink/shared-types";
import { ValidationDomainException } from "../../../common/exceptions/domain.exception";
import { ProfitLossQueryDto, ProfitLossSummaryQueryDto } from "../dto";
import { FarmProfitLossEntity } from "../entities/farm-profit-loss.entity";
import {
  FARM_PROFIT_LOSS_REPOSITORY,
  IFarmProfitLossRepository,
} from "../repositories/farm-profit-loss.repository.interface";
import { IFarmProfitLossService } from "./farm-profit-loss.service.interface";

@Injectable()
export class FarmProfitLossService implements IFarmProfitLossService {
  private readonly logger = new Logger(FarmProfitLossService.name);

  constructor(
    @Inject(FARM_PROFIT_LOSS_REPOSITORY)
    private readonly profitLossRepo: IFarmProfitLossRepository
  ) {}

  public async generateProfitLoss(
    farmId: string,
    query: ProfitLossQueryDto,
    traceId?: string
  ): Promise<ProfitLossStatementResponseDto> {
    const { startDate, endDate, startDateStr, endDateStr } =
      this.resolveDateRange(query.startDate, query.endDate);

    const interval =
      query.interval || this.resolveDefaultInterval(startDate, endDate);

    let previousStartDate: Date | undefined;
    let previousEndDate: Date | undefined;

    if (query.includePreviousPeriod) {
      const durationMs = endDate.getTime() - startDate.getTime();
      previousEndDate = new Date(startDate.getTime() - 1);
      previousStartDate = new Date(previousEndDate.getTime() - durationMs);
    }

    this.logger.log(
      `[${traceId || "NO-TRACE"}] Generating P&L statement for farm '${farmId}' between ${startDateStr} and ${endDateStr} (interval: ${interval})`
    );

    const rawData = await this.profitLossRepo.getProfitLossData({
      farmId,
      startDate,
      endDate,
      interval,
      animalId: query.animalId,
      currency: query.currency,
      previousStartDate,
      previousEndDate,
    });

    const entity = new FarmProfitLossEntity({
      farmId,
      startDate: startDateStr,
      endDate: endDateStr,
      currency: rawData.currency,
      interval,
      revenueAggregates: rawData.revenueAggregates,
      expenseAggregates: rawData.expenseAggregates,
      revenueTimeline: rawData.revenueTimeline,
      expenseTimeline: rawData.expenseTimeline,
      previousPeriod: rawData.previousPeriod,
    });

    return entity.toResponseDto();
  }

  public async getSummaryKpi(
    farmId: string,
    query: ProfitLossSummaryQueryDto
  ): Promise<ProfitLossSummaryKpiDto> {
    const { startDate, endDate, startDateStr, endDateStr } =
      this.resolveDateRange(query.startDate, query.endDate);

    const rawData = await this.profitLossRepo.getProfitLossData({
      farmId,
      startDate,
      endDate,
      interval: ProfitLossInterval.DAY,
      currency: query.currency,
    });

    const entity = new FarmProfitLossEntity({
      farmId,
      startDate: startDateStr,
      endDate: endDateStr,
      currency: rawData.currency,
      interval: ProfitLossInterval.DAY,
      revenueAggregates: rawData.revenueAggregates,
      expenseAggregates: rawData.expenseAggregates,
      revenueTimeline: rawData.revenueTimeline,
      expenseTimeline: rawData.expenseTimeline,
    });

    return entity.toSummaryKpiDto();
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
      // Default: 1st of current month
      const y = now.getUTCFullYear();
      const m = String(now.getUTCMonth() + 1).padStart(2, "0");
      startDateStr = `${y}-${m}-01`;
    }

    let endDateStr: string;
    if (endInput) {
      endDateStr = endInput;
    } else {
      // Default: Current date
      const y = now.getUTCFullYear();
      const m = String(now.getUTCMonth() + 1).padStart(2, "0");
      const d = String(now.getUTCDate()).padStart(2, "0");
      endDateStr = `${y}-${m}-${d}`;
    }

    const startDate = new Date(`${startDateStr}T00:00:00.000Z`);
    const endDate = new Date(`${endDateStr}T23:59:59.999Z`);

    if (isNaN(startDate.getTime())) {
      throw new ValidationDomainException(
        `Invalid startDate: '${startInput}'. Expected format YYYY-MM-DD`
      );
    }
    if (isNaN(endDate.getTime())) {
      throw new ValidationDomainException(
        `Invalid endDate: '${endInput}'. Expected format YYYY-MM-DD`
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
