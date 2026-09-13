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
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from "@nestjs/swagger";
import {
  AnimalSpecies,
  FarmRole,
  JwtPayload,
  PaginatedVaccineRecordsDto,
  PaginatedVaccineReminderLogsDto,
  ScheduleScanResultDto,
  SpeciesVaccineProtocolDto,
  VaccineRecordResponseDto,
  VaccineScheduleSummaryDto,
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
  IVaccineScheduleService,
  VACCINE_SCHEDULE_SERVICE,
} from "./services/vaccine-schedule.service.interface";
import {
  IVaccineNotificationService,
  VACCINE_NOTIFICATION_SERVICE,
} from "./services/vaccine-notification.service.interface";
import { CreateVaccineRecordDto } from "./dto/create-vaccine-record.dto";
import { UpdateVaccineRecordDto } from "./dto/update-vaccine-record.dto";
import { VaccineRecordQueryDto } from "./dto/vaccine-record-query.dto";
import { VaccineScheduleQueryDto } from "./dto/vaccine-schedule-query.dto";
import { TriggerReminderScanDto } from "./dto/trigger-reminder-scan.dto";
import { VaccineReminderLogQueryDto } from "./dto/vaccine-reminder-log-query.dto";

@ApiTags("Preventative Health & Vaccinations")
@Controller("clinical-health/vaccinations")
@UseGuards(JwtAuthGuard, TenantGuard)
@Tenant()
@ApiBearerAuth()
@ApiHeader({
  name: "x-farm-id",
  required: true,
  description: "Target farm tenant UUID identifier",
})
export class VaccineScheduleController {
  constructor(
    @Inject(VACCINE_SCHEDULE_SERVICE)
    private readonly vaccineScheduleService: IVaccineScheduleService,
    @Inject(VACCINE_NOTIFICATION_SERVICE)
    private readonly notificationService: IVaccineNotificationService
  ) {}

  @Post()
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("Vaccination/deworming record created successfully")
  @ApiOperation({
    summary: "Record a vaccination or deworming administration event",
  })
  @ApiCreatedResponse({
    description: "Vaccination/deworming record created successfully",
  })
  @ApiNotFoundResponse({ description: "Animal not found" })
  @ApiUnprocessableEntityResponse({
    description: "Animal is deceased/sold/culled or invalid parameters",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async recordAdministration(
    @CurrentFarm("id") farmId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateVaccineRecordDto,
    @Headers("x-trace-id") traceId?: string
  ): Promise<VaccineRecordResponseDto> {
    return this.vaccineScheduleService.recordAdministration(
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
  @ResponseMessage("Vaccine and deworming records retrieved successfully")
  @ApiOperation({
    summary: "List and filter vaccination and deworming administration records",
  })
  @ApiOkResponse({
    description: "Paginated vaccination and deworming records retrieved",
  })
  public async listRecords(
    @CurrentFarm("id") farmId: string,
    @Query() query: VaccineRecordQueryDto
  ): Promise<PaginatedVaccineRecordsDto> {
    return this.vaccineScheduleService.listRecords(farmId, query);
  }

  @Get("schedule")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @ResponseMessage("Vaccine schedule summary retrieved successfully")
  @ApiOperation({
    summary:
      "Get herd preventative schedule summary with upcoming due events and metrics",
  })
  @ApiOkResponse({
    description: "Herd preventative schedule summary retrieved successfully",
  })
  public async getScheduleSummary(
    @CurrentFarm("id") farmId: string,
    @Query() query: VaccineScheduleQueryDto
  ): Promise<VaccineScheduleSummaryDto> {
    return this.vaccineScheduleService.getScheduleSummary(farmId, query);
  }

  @Get("protocols")
  @ResponseMessage("Species vaccine protocols retrieved successfully")
  @ApiOperation({
    summary:
      "Get doctor-verified standard vaccination and deworming protocols by species",
  })
  @ApiOkResponse({
    description: "Species preventative protocols retrieved successfully",
  })
  public getSpeciesProtocols(
    @Query("species") species?: AnimalSpecies
  ): SpeciesVaccineProtocolDto[] {
    return this.vaccineScheduleService.getSpeciesProtocols(species);
  }

  @Post("reminders/scan")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Preventative schedule reminder scan completed")
  @ApiOperation({
    summary:
      "Trigger on-demand preventative schedule scan and send SMS/Push reminders",
  })
  @ApiOkResponse({
    description: "Preventative schedule reminder scan results",
  })
  public async triggerReminderScan(
    @CurrentFarm("id") farmId: string,
    @Body() dto: TriggerReminderScanDto,
    @Headers("x-trace-id") traceId?: string
  ): Promise<ScheduleScanResultDto> {
    const asOfDate = dto.asOfDate ? new Date(dto.asOfDate) : undefined;
    return this.notificationService.processFarmDueReminders(
      farmId,
      asOfDate,
      dto.daysAhead ?? 7,
      dto.dryRun ?? false,
      traceId
    );
  }

  @Get("reminders/logs")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @ResponseMessage("Vaccine reminder logs retrieved successfully")
  @ApiOperation({
    summary: "Query historical vaccination and deworming reminder logs",
  })
  @ApiOkResponse({
    description: "Paginated vaccination and deworming reminder logs",
  })
  public async listReminderLogs(
    @CurrentFarm("id") farmId: string,
    @Query() query: VaccineReminderLogQueryDto
  ): Promise<PaginatedVaccineReminderLogsDto> {
    return this.notificationService.listReminderLogs(farmId, query);
  }

  @Get(":id")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @ResponseMessage("Vaccine record retrieved successfully")
  @ApiOperation({
    summary: "Get a single vaccination or deworming record by UUID",
  })
  @ApiOkResponse({ description: "Vaccine record details retrieved" })
  @ApiNotFoundResponse({ description: "Vaccine record not found" })
  public async getRecordById(
    @CurrentFarm("id") farmId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Query("asOfDate") asOfDate?: string
  ): Promise<VaccineRecordResponseDto> {
    return this.vaccineScheduleService.getRecordById(id, farmId, asOfDate);
  }

  @Patch(":id")
  @FarmRoles(FarmRole.OWNER, FarmRole.MANAGER, FarmRole.VET_STAFF)
  @ResponseMessage("Vaccine record updated successfully")
  @ApiOperation({
    summary: "Update vaccination or deworming record details",
  })
  @ApiOkResponse({ description: "Vaccine record updated successfully" })
  @ApiConflictResponse({
    description: "Optimistic concurrency version conflict",
  })
  @ApiNotFoundResponse({ description: "Vaccine record not found" })
  public async updateRecord(
    @CurrentFarm("id") farmId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateVaccineRecordDto,
    @Headers("x-trace-id") traceId?: string
  ): Promise<VaccineRecordResponseDto> {
    return this.vaccineScheduleService.updateRecord(
      id,
      farmId,
      user.sub,
      dto,
      traceId
    );
  }

  @Delete(":id")
  @FarmRoles(FarmRole.OWNER, FarmRole.MANAGER)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseMessage("Vaccine record deleted successfully")
  @ApiOperation({
    summary: "Delete an erroneously recorded vaccination or deworming record",
  })
  @ApiNotFoundResponse({ description: "Vaccine record not found" })
  public async deleteRecord(
    @CurrentFarm("id") farmId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("x-trace-id") traceId?: string
  ): Promise<void> {
    return this.vaccineScheduleService.deleteRecord(
      id,
      farmId,
      user.sub,
      traceId
    );
  }
}
