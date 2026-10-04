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
  FarmRole,
  ProfitLossStatementResponseDto,
  ProfitLossSummaryKpiDto,
} from "@vetralink/shared-types";
import {
  CurrentFarm,
  FarmRoles,
  ResponseMessage,
  Tenant,
} from "../../common/decorators";
import { JwtAuthGuard, TenantGuard } from "../../common/guards";
import { ProfitLossQueryDto, ProfitLossSummaryQueryDto } from "./dto";
import {
  FARM_PROFIT_LOSS_SERVICE,
  IFarmProfitLossService,
} from "./services/farm-profit-loss.service.interface";

@ApiTags("Financial - Profit & Loss")
@Controller("financial/profit-loss")
@UseGuards(JwtAuthGuard, TenantGuard)
@Tenant()
@ApiBearerAuth()
@ApiHeader({
  name: "x-farm-id",
  required: true,
  description: "Target farm tenant UUID identifier",
})
export class FinancialProfitLossController {
  constructor(
    @Inject(FARM_PROFIT_LOSS_SERVICE)
    private readonly profitLossService: IFarmProfitLossService
  ) {}

  @Get()
  @FarmRoles(FarmRole.OWNER, FarmRole.MANAGER)
  @ResponseMessage("Farm Profit & Loss statement generated successfully")
  @ApiOperation({
    summary: "Generate real-time Farm Profit & Loss statement",
    description:
      "Aggregates operational revenues, expenses, net profit, margin %, operating expense ratio %, synchronized timeline series, and optional period-over-period comparison.",
  })
  @ApiOkResponse({
    description: "Farm Profit & Loss statement generated successfully",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async generateProfitLoss(
    @CurrentFarm("id") farmId: string,
    @Query() query: ProfitLossQueryDto,
    @Headers("x-trace-id") traceId?: string
  ): Promise<ProfitLossStatementResponseDto> {
    return this.profitLossService.generateProfitLoss(farmId, query, traceId);
  }

  @Get("summary")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @ResponseMessage("Farm Profit & Loss KPI summary retrieved successfully")
  @ApiOperation({
    summary: "Retrieve lightweight Profit & Loss KPI summary",
    description:
      "Returns high-level KPI metrics (total revenue, total expense, net profit, profit margin %, profitability flag) for farm dashboard display.",
  })
  @ApiOkResponse({
    description: "Farm Profit & Loss KPI summary retrieved successfully",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async getSummaryKpi(
    @CurrentFarm("id") farmId: string,
    @Query() query: ProfitLossSummaryQueryDto
  ): Promise<ProfitLossSummaryKpiDto> {
    return this.profitLossService.getSummaryKpi(farmId, query);
  }
}
