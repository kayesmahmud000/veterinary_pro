import {
  CostPerLiterResponseDto,
  FeedConversionResponseDto,
} from "@vetralink/shared-types";
import { CostPerLiterQueryDto, FeedConversionQueryDto } from "../dto";

export interface IFarmFeedAnalyticsService {
  computeCostPerLiter(
    farmId: string,
    query: CostPerLiterQueryDto,
    traceId?: string
  ): Promise<CostPerLiterResponseDto>;

  computeFeedConversion(
    farmId: string,
    query: FeedConversionQueryDto,
    traceId?: string
  ): Promise<FeedConversionResponseDto>;
}

export const FARM_FEED_ANALYTICS_SERVICE = Symbol(
  "FARM_FEED_ANALYTICS_SERVICE"
);
