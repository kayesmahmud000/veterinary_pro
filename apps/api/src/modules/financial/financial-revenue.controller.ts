import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiHeader,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import {
  FarmRole,
  JwtPayload,
  PaginatedRevenuesDto,
  RevenueResponseDto,
  RevenueSummaryResponseDto,
} from "@vetralink/shared-types";
import {
  CurrentFarm,
  CurrentUser,
  FarmRoles,
  ResponseMessage,
  Tenant,
} from "../../common/decorators";
import { JwtAuthGuard, TenantGuard } from "../../common/guards";
import {
  RecordRevenueDto,
  RevenueQueryDto,
  RevenueSummaryQueryDto,
  UpdateRevenueDto,
} from "./dto";
import {
  FARM_REVENUE_SERVICE,
  IFarmRevenueService,
} from "./services/farm-revenue.service.interface";

@ApiTags("Financial - Revenue Tracking")
@Controller("financial/revenues")
@UseGuards(JwtAuthGuard, TenantGuard)
@Tenant()
@ApiBearerAuth()
@ApiHeader({
  name: "x-farm-id",
  required: true,
  description: "Target farm tenant UUID identifier",
})
export class FinancialRevenueController {
  constructor(
    @Inject(FARM_REVENUE_SERVICE)
    private readonly revenueService: IFarmRevenueService
  ) {}

  @Post()
  @FarmRoles(FarmRole.OWNER, FarmRole.MANAGER, FarmRole.HERDSMAN)
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("Farm revenue recorded successfully")
  @ApiOperation({
    summary: "Record a new operational farm revenue stream",
    description:
      "Logs revenue under MILK_SALES, LIVESTOCK_SALES, MANURE, BYPRODUCTS, or OTHER with optional animal attribution and automated livestock status update.",
  })
  @ApiCreatedResponse({ description: "Farm revenue recorded successfully" })
  @ApiNotFoundResponse({ description: "Animal not found" })
  @ApiUnprocessableEntityResponse({
    description: "Animal is deceased/sold or invalid revenue payload",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async recordRevenue(
    @CurrentFarm("id") farmId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: RecordRevenueDto,
    @Headers("x-trace-id") traceId?: string
  ): Promise<RevenueResponseDto> {
    return this.revenueService.recordRevenue(farmId, user.sub, dto, traceId);
  }

  @Get("summary")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @ResponseMessage("Revenue summary analytics retrieved successfully")
  @ApiOperation({
    summary: "Retrieve aggregated revenue breakdown and trend analytics",
    description:
      "Aggregates total revenue, breakdown per category (monetary sum, count, percentage), top revenue category, and daily timeline distribution.",
  })
  @ApiOkResponse({
    description: "Aggregated revenue analytics retrieved successfully",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async getRevenueSummary(
    @CurrentFarm("id") farmId: string,
    @Query() query: RevenueSummaryQueryDto
  ): Promise<RevenueSummaryResponseDto> {
    return this.revenueService.getRevenueSummary(farmId, query);
  }

  @Get()
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @ResponseMessage("Farm revenues retrieved successfully")
  @ApiOperation({
    summary: "Query and filter operational farm revenues with pagination",
  })
  @ApiOkResponse({ description: "Paginated farm revenues retrieved" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async listRevenues(
    @CurrentFarm("id") farmId: string,
    @Query() query: RevenueQueryDto
  ): Promise<PaginatedRevenuesDto> {
    return this.revenueService.getRevenues(farmId, query);
  }

  @Get(":id")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @ResponseMessage("Farm revenue retrieved successfully")
  @ApiOperation({
    summary: "Get detailed information for a single farm revenue record",
  })
  @ApiOkResponse({ description: "Farm revenue details retrieved" })
  @ApiNotFoundResponse({ description: "Farm revenue not found" })
  public async getRevenueById(
    @CurrentFarm("id") farmId: string,
    @Param("id", ParseUUIDPipe) id: string
  ): Promise<RevenueResponseDto> {
    return this.revenueService.getRevenueById(farmId, id);
  }

  @Patch(":id")
  @FarmRoles(FarmRole.OWNER, FarmRole.MANAGER)
  @ResponseMessage("Farm revenue updated successfully")
  @ApiOperation({
    summary: "Update an existing farm revenue record",
  })
  @ApiOkResponse({ description: "Farm revenue updated successfully" })
  @ApiConflictResponse({
    description: "Optimistic concurrency version conflict",
  })
  @ApiNotFoundResponse({ description: "Farm revenue or animal not found" })
  public async updateRevenue(
    @CurrentFarm("id") farmId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateRevenueDto,
    @Headers("x-trace-id") traceId?: string
  ): Promise<RevenueResponseDto> {
    return this.revenueService.updateRevenue(
      farmId,
      id,
      user.sub,
      dto,
      traceId
    );
  }

  @Delete(":id")
  @FarmRoles(FarmRole.OWNER, FarmRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseMessage("Farm revenue deleted successfully")
  @ApiOperation({
    summary: "Soft-delete an erroneous or cancelled farm revenue record",
  })
  @ApiNoContentResponse({ description: "Farm revenue deleted successfully" })
  @ApiNotFoundResponse({ description: "Farm revenue not found" })
  public async deleteRevenue(
    @CurrentFarm("id") farmId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("x-trace-id") traceId?: string
  ): Promise<void> {
    return this.revenueService.deleteRevenue(farmId, id, user.sub, traceId);
  }
}
