import {
  Controller,
  Get,
  Headers,
  Inject,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  CostPerLiterResponseDto,
  FarmRole,
  FeedConversionResponseDto,
} from "@vetralink/shared-types";
import {
  CurrentFarm,
  FarmRoles,
  ResponseMessage,
  Tenant,
} from "../../common/decorators";
import { JwtAuthGuard, TenantGuard } from "../../common/guards";
import { CostPerLiterQueryDto, FeedConversionQueryDto } from "./dto";
import {
  FARM_FEED_ANALYTICS_SERVICE,
  IFarmFeedAnalyticsService,
} from "./services/farm-feed-analytics.service.interface";

@ApiTags("Financial - Feed & Cost Analytics")
@Controller("financial/analytics")
@UseGuards(JwtAuthGuard, TenantGuard)
@Tenant()
@ApiBearerAuth()
@ApiHeader({
  name: "x-farm-id",
  required: true,
  description: "Target farm tenant UUID identifier",
})
export class FinancialFeedAnalyticsController {
  constructor(
    @Inject(FARM_FEED_ANALYTICS_SERVICE)
    private readonly feedAnalyticsService: IFarmFeedAnalyticsService
  ) {}

  @Get("cost-per-liter")
  @FarmRoles(FarmRole.OWNER, FarmRole.MANAGER)
  @ResponseMessage("Cost-per-liter milk computation retrieved successfully")
  @ApiOperation({
    summary: "Compute Cost-Per-Liter (CPL) milk metrics",
    description:
      "Aggregates total milk yield, feed costs, overhead operating costs, realized revenue per liter, net margin per liter, and timeline distribution.",
  })
  @ApiOkResponse({
    description: "Cost-per-liter metrics generated successfully",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async getCostPerLiter(
    @CurrentFarm("id") farmId: string,
    @Query() query: CostPerLiterQueryDto,
    @Headers("x-trace-id") traceId?: string
  ): Promise<CostPerLiterResponseDto> {
    return this.feedAnalyticsService.computeCostPerLiter(
      farmId,
      query,
      traceId
    );
  }

  @Get("feed-conversion")
  @FarmRoles(FarmRole.OWNER, FarmRole.MANAGER)
  @ResponseMessage("Feed Conversion Ratio (FCR) analytics retrieved successfully")
  @ApiOperation({
    summary: "Compute Feed Conversion Ratio (FCR) and dairy feed efficiency",
    description:
      "Evaluates livestock growth FCR and dairy feed efficiency against standard AgTech benchmarks.",
  })
  @ApiOkResponse({
    description: "Feed conversion analytics generated successfully",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async getFeedConversion(
    @CurrentFarm("id") farmId: string,
    @Query() query: FeedConversionQueryDto,
    @Headers("x-trace-id") traceId?: string
  ): Promise<FeedConversionResponseDto> {
    return this.feedAnalyticsService.computeFeedConversion(
      farmId,
      query,
      traceId
    );
  }
}
