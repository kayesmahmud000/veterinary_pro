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
  Res,
  StreamableFile,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiHeader,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import {
  FarmRole,
  JwtPayload,
  MilkAnomalyResponseDto,
  MilkLogResponseDto,
  MilkYieldAnalyticsResponseDto,
  PaginatedMilkAnomaliesDto,
  PaginatedMilkLogsDto,
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
  IMilkLogService,
  MILK_LOGS_SERVICE,
} from "./services/milk-log.service.interface";
import {
  IMilkAnomalyService,
  MILK_ANOMALY_SERVICE,
} from "./services/milk-anomaly.service.interface";
import {
  IMilkExportService,
  MILK_EXPORT_SERVICE,
} from "./services/milk-export.service.interface";
import {
  AcknowledgeMilkAnomalyDto,
  CreateBulkMilkLogDto,
  CreateMilkLogDto,
  ExportMilkLogsQueryDto,
  MilkAnomalyQueryDto,
  MilkLogQueryDto,
  MilkYieldAnalyticsQueryInputDto,
  ResolveMilkAnomalyDto,
  TriggerAnomalyScanDto,
  UpdateMilkLogDto,
} from "./dto";

@ApiTags("Milk Production")
@Controller("milk-logs")
@UseGuards(JwtAuthGuard, TenantGuard)
@Tenant()
@ApiBearerAuth()
@ApiHeader({
  name: "x-farm-id",
  required: true,
  description: "Target farm tenant UUID",
})
export class MilkLogsController {
  constructor(
    @Inject(MILK_LOGS_SERVICE)
    private readonly milkLogService: IMilkLogService,
    @Inject(MILK_ANOMALY_SERVICE)
    private readonly anomalyService: IMilkAnomalyService,
    @Inject(MILK_EXPORT_SERVICE)
    private readonly exportService: IMilkExportService
  ) {}

  @Post()
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("Milk yield logged successfully")
  @ApiOperation({
    summary: "Record session milk yield for an individual animal",
  })
  @ApiCreatedResponse({ description: "Milk yield recorded successfully" })
  @ApiConflictResponse({
    description: "Milk log for this animal on this date and session already exists",
  })
  @ApiUnprocessableEntityResponse({
    description: "Validation failure (male animal, non-dairy species, or future date)",
  })
  @ApiNotFoundResponse({ description: "Animal not found in this farm" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  @ApiForbiddenResponse({
    description: "User is not an authorized member of this farm",
  })
  public async createMilkLog(
    @CurrentFarm() farmId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateMilkLogDto,
    @Headers("x-trace-id") traceId?: string
  ): Promise<MilkLogResponseDto> {
    return this.milkLogService.createMilkLog(
      farmId,
      user.sub,
      dto,
      traceId
    );
  }

  @Post("bulk")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("Bulk herd milk collection logged successfully")
  @ApiOperation({
    summary: "Record bulk herd milk collection volume in the central cooling tank for a session",
  })
  @ApiCreatedResponse({ description: "Bulk milk collection logged successfully" })
  @ApiConflictResponse({
    description: "Bulk milk log for this farm on this date and session already exists",
  })
  @ApiUnprocessableEntityResponse({
    description: "Validation failure (non-positive volume, future date, or invalid temperature)",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  @ApiForbiddenResponse({
    description: "User is not an authorized member of this farm",
  })
  public async createBulkMilkLog(
    @CurrentFarm() farmId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateBulkMilkLogDto,
    @Headers("x-trace-id") traceId?: string
  ): Promise<MilkLogResponseDto> {
    return this.milkLogService.createBulkMilkLog(
      farmId,
      user.sub,
      dto,
      traceId
    );
  }

  @Get()
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @ResponseMessage("Milk logs retrieved successfully")
  @ApiOperation({
    summary: "Query milk logs with filters, date ranges, and pagination",
  })
  @ApiOkResponse({ description: "Milk logs retrieved successfully" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  @ApiForbiddenResponse({
    description: "User is not an authorized member of this farm",
  })
  public async queryMilkLogs(
    @CurrentFarm() farmId: string,
    @Query() query: MilkLogQueryDto
  ): Promise<PaginatedMilkLogsDto> {
    return this.milkLogService.queryMilkLogs(farmId, query);
  }

  @Get("analytics")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @ResponseMessage("Milk yield analytics retrieved successfully")
  @ApiOperation({
    summary:
      "Aggregate daily, weekly, and monthly yield analytics with 7-day moving averages",
  })
  @ApiOkResponse({ description: "Milk yield analytics retrieved successfully" })
  @ApiNotFoundResponse({
    description: "Specified animal not found in this farm",
  })
  @ApiUnprocessableEntityResponse({
    description: "Validation failure (invalid date range or future date)",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  @ApiForbiddenResponse({
    description: "User is not an authorized member of this farm",
  })
  public async getYieldAnalytics(
    @CurrentFarm() farmId: string,
    @Query() query: MilkYieldAnalyticsQueryInputDto
  ): Promise<MilkYieldAnalyticsResponseDto> {
    return this.milkLogService.getYieldAnalytics(farmId, query);
  }

  @Get("export")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @ApiOperation({
    summary:
      "Export milk production logs to formatted CSV or Excel spreadsheet",
  })
  @ApiOkResponse({
    description: "Binary file stream of CSV or Excel spreadsheet",
  })
  @ApiProduces(
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  )
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  @ApiForbiddenResponse({
    description: "User is not an authorized member of this farm",
  })
  @ApiUnprocessableEntityResponse({
    description: "Validation failure (invalid date range or future date)",
  })
  public async exportMilkLogs(
    @CurrentFarm() farmId: string,
    @Query() query: ExportMilkLogsQueryDto,
    @Res({ passthrough: true }) res: Response,
    @Headers("x-trace-id") traceId?: string
  ): Promise<StreamableFile> {
    const result = await this.exportService.exportMilkLogs(
      farmId,
      query,
      traceId
    );

    res.set({
      "Content-Type": result.contentType,
      "Content-Disposition": `attachment; filename="${result.fileName}"`,
      "Content-Length": result.buffer.length,
    });

    return new StreamableFile(result.buffer);
  }

  @Get("anomalies")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @ResponseMessage("Milk yield anomalies retrieved successfully")
  @ApiOperation({
    summary:
      "Query milk yield drop anomalies with status, severity, and date filters",
  })
  @ApiOkResponse({ description: "Milk anomalies retrieved successfully" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  @ApiForbiddenResponse({
    description: "User is not an authorized member of this farm",
  })
  public async queryAnomalies(
    @CurrentFarm() farmId: string,
    @Query() query: MilkAnomalyQueryDto
  ): Promise<PaginatedMilkAnomaliesDto> {
    return this.anomalyService.queryAnomalies(farmId, query);
  }

  @Get("anomalies/:id")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @ResponseMessage("Milk yield anomaly details retrieved successfully")
  @ApiOperation({
    summary: "Get detailed milk yield anomaly by ID",
  })
  @ApiOkResponse({ description: "Milk anomaly retrieved successfully" })
  @ApiNotFoundResponse({ description: "Milk anomaly not found" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  @ApiForbiddenResponse({
    description: "User is not an authorized member of this farm",
  })
  public async getAnomalyById(
    @CurrentFarm() farmId: string,
    @Param("id", ParseUUIDPipe) id: string
  ): Promise<MilkAnomalyResponseDto> {
    return this.anomalyService.getAnomalyById(id, farmId);
  }

  @Post("anomalies/scan")
  @FarmRoles(FarmRole.OWNER, FarmRole.MANAGER, FarmRole.VET_STAFF)
  @HttpCode(HttpStatus.ACCEPTED)
  @ResponseMessage("Farm daily anomaly scan initiated successfully")
  @ApiOperation({
    summary:
      "Trigger on-demand background anomaly scan for all active milking animals on target date",
  })
  @ApiAcceptedResponse({
    description: "Anomaly scan job dispatched to queue",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  @ApiForbiddenResponse({
    description: "User is not authorized to trigger farm scans",
  })
  public async triggerFarmScan(
    @CurrentFarm() farmId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: TriggerAnomalyScanDto
  ): Promise<{ jobId: string; farmId: string; targetDate: string }> {
    return this.anomalyService.triggerFarmScan(farmId, user.sub, dto);
  }

  @Patch("anomalies/:id/acknowledge")
  @FarmRoles(FarmRole.OWNER, FarmRole.MANAGER, FarmRole.VET_STAFF)
  @ResponseMessage("Milk yield anomaly acknowledged successfully")
  @ApiOperation({
    summary:
      "Acknowledge milk yield anomaly alert with optional clinical notes",
  })
  @ApiOkResponse({ description: "Milk anomaly acknowledged successfully" })
  @ApiNotFoundResponse({ description: "Milk anomaly not found" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  @ApiForbiddenResponse({
    description: "User is not authorized to acknowledge anomalies",
  })
  public async acknowledgeAnomaly(
    @CurrentFarm() farmId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AcknowledgeMilkAnomalyDto
  ): Promise<MilkAnomalyResponseDto> {
    return this.anomalyService.acknowledgeAnomaly(id, farmId, user.sub, dto);
  }

  @Patch("anomalies/:id/resolve")
  @FarmRoles(FarmRole.OWNER, FarmRole.MANAGER, FarmRole.VET_STAFF)
  @ResponseMessage("Milk yield anomaly resolved successfully")
  @ApiOperation({
    summary:
      "Resolve milk yield anomaly alert with veterinary resolution notes",
  })
  @ApiOkResponse({ description: "Milk anomaly resolved successfully" })
  @ApiNotFoundResponse({ description: "Milk anomaly not found" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  @ApiForbiddenResponse({
    description: "User is not authorized to resolve anomalies",
  })
  public async resolveAnomaly(
    @CurrentFarm() farmId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ResolveMilkAnomalyDto
  ): Promise<MilkAnomalyResponseDto> {
    return this.anomalyService.resolveAnomaly(id, farmId, user.sub, dto);
  }

  @Get(":id")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @ResponseMessage("Milk log details retrieved successfully")
  @ApiOperation({
    summary: "Get detailed milk log by ID",
  })
  @ApiOkResponse({ description: "Milk log retrieved successfully" })
  @ApiNotFoundResponse({ description: "Milk log not found" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  @ApiForbiddenResponse({
    description: "User is not an authorized member of this farm",
  })
  public async getMilkLogById(
    @CurrentFarm() farmId: string,
    @Param("id", ParseUUIDPipe) id: string
  ): Promise<MilkLogResponseDto> {
    return this.milkLogService.getMilkLogById(id, farmId);
  }

  @Patch(":id")
  @FarmRoles(FarmRole.OWNER, FarmRole.MANAGER)
  @ResponseMessage("Milk log updated successfully")
  @ApiOperation({
    summary: "Update milk yield or quality parameters for a session log",
  })
  @ApiOkResponse({ description: "Milk log updated successfully" })
  @ApiNotFoundResponse({ description: "Milk log not found" })
  @ApiConflictResponse({
    description: "Update would create a duplicate session record",
  })
  @ApiUnprocessableEntityResponse({
    description: "Validation failure on updated values",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  @ApiForbiddenResponse({
    description: "Only farm owners or managers can modify milk logs",
  })
  public async updateMilkLog(
    @CurrentFarm() farmId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateMilkLogDto,
    @Headers("x-trace-id") traceId?: string
  ): Promise<MilkLogResponseDto> {
    return this.milkLogService.updateMilkLog(
      id,
      farmId,
      user.sub,
      dto,
      traceId
    );
  }

  @Delete(":id")
  @FarmRoles(FarmRole.OWNER, FarmRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Milk log deleted successfully")
  @ApiOperation({
    summary: "Delete an erroneous milk log entry",
  })
  @ApiOkResponse({ description: "Milk log deleted successfully" })
  @ApiNotFoundResponse({ description: "Milk log not found" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  @ApiForbiddenResponse({
    description: "Only farm owners or managers can delete milk logs",
  })
  public async deleteMilkLog(
    @CurrentFarm() farmId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("x-trace-id") traceId?: string
  ): Promise<{ deleted: boolean; id: string }> {
    await this.milkLogService.deleteMilkLog(id, farmId, user.sub, traceId);
    return { deleted: true, id };
  }
}
