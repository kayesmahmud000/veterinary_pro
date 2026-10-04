import {
  Controller,
  Get,
  Inject,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  SaasMetricsSummaryDto,
  SaasMetricsTrendDto,
  UserRole,
} from "@vetralink/shared-types";
import { ResponseMessage, Roles } from "../../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../../common/guards";
import { QuerySaasMetricsRequestDto } from "../dto/query-saas-metrics.dto";
import {
  ISubscriptionMetricsService,
  SUBSCRIPTION_METRICS_SERVICE,
} from "../services/subscription-metrics.service.interface";

@ApiTags("Subscriptions - Metrics")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
@Controller("subscriptions/metrics")
export class SubscriptionMetricsController {
  constructor(
    @Inject(SUBSCRIPTION_METRICS_SERVICE)
    private readonly metricsService: ISubscriptionMetricsService,
  ) {}

  @Get("summary")
  @ApiOperation({
    summary: "Get real-time SaaS subscription metrics summary (Admin only)",
    description:
      "Computes MRR, ARR, ARPU, LTV, customer/revenue churn rates, tier breakdown, status breakdown, and dunning risk exposure across all farm tenants.",
  })
  @ApiQuery({
    name: "asOfDate",
    required: false,
    type: String,
    description: "Optional reference date for snapshot computation (ISO 8601)",
    example: "2026-09-20T00:00:00.000Z",
  })
  @ApiOkResponse({
    description: "SaaS metrics summary retrieved successfully",
  })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({ description: "Requires SUPER_ADMIN or ADMIN role" })
  @ResponseMessage("SaaS metrics summary retrieved successfully")
  public async getSummary(
    @Query("asOfDate") asOfDate?: string,
  ): Promise<SaasMetricsSummaryDto> {
    return this.metricsService.getSummary(
      asOfDate ? new Date(asOfDate) : undefined,
    );
  }

  @Get("trends")
  @ApiOperation({
    summary: "Get historical SaaS subscription monthly trend cohorts (Admin only)",
    description:
      "Aggregates monthly trend cohorts containing MRR, ARR, active counts, new signups, churned accounts, and net growth.",
  })
  @ApiOkResponse({
    description: "SaaS metrics trends retrieved successfully",
  })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({ description: "Requires SUPER_ADMIN or ADMIN role" })
  @ResponseMessage("SaaS metrics trends retrieved successfully")
  public async getTrends(
    @Query() query?: QuerySaasMetricsRequestDto,
  ): Promise<SaasMetricsTrendDto> {
    return this.metricsService.getTrends(query);
  }
}
