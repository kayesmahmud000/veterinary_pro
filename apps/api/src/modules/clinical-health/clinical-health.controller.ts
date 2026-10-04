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
  FarmRole,
  HealthIncidentResponseDto,
  JwtPayload,
  PaginatedHealthIncidentsDto,
  EscalationScanResultDto,
  HealthEscalationLogResponseDto,
  PaginatedHealthEscalationLogsDto,
  PresignedAttachmentUploadResponseDto,
  HealthRecordAttachmentResponseDto,
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
  CLINICAL_HEALTH_SERVICE,
  IClinicalHealthService,
} from "./services/clinical-health.service.interface";
import {
  HEALTH_ESCALATION_SERVICE,
  IHealthEscalationService,
} from "./services/health-escalation.service.interface";
import {
  HEALTH_ATTACHMENT_SERVICE,
  IHealthAttachmentService,
} from "./services/health-attachment.service.interface";
import { CreateHealthIncidentDto } from "./dto/create-health-incident.dto";
import { UpdateHealthIncidentDto } from "./dto/update-health-incident.dto";
import { ResolveHealthIncidentDto } from "./dto/resolve-health-incident.dto";
import { HealthIncidentQueryDto } from "./dto/health-incident-query.dto";
import { TriggerEscalationScanDto } from "./dto/trigger-escalation-scan.dto";
import { HealthEscalationLogQueryDto } from "./dto/health-escalation-log-query.dto";
import { RequestAttachmentPresignedUrlDto } from "./dto/request-attachment-presigned-url.dto";
import { ConfirmAttachmentUploadDto } from "./dto/confirm-attachment-upload.dto";

@ApiTags("Clinical Health")
@Controller("clinical-health/incidents")
@UseGuards(JwtAuthGuard, TenantGuard)
@Tenant()
@ApiBearerAuth()
@ApiHeader({
  name: "x-farm-id",
  required: true,
  description: "Target farm tenant UUID identifier",
})
export class ClinicalHealthController {
  constructor(
    @Inject(CLINICAL_HEALTH_SERVICE)
    private readonly clinicalHealthService: IClinicalHealthService,
    @Inject(HEALTH_ESCALATION_SERVICE)
    private readonly escalationService: IHealthEscalationService,
    @Inject(HEALTH_ATTACHMENT_SERVICE)
    private readonly attachmentService: IHealthAttachmentService
  ) {}

  @Post()
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @HttpCode(HttpStatus.CREATED)
  @ResponseMessage("Clinical health incident logged successfully")
  @ApiOperation({
    summary: "Record a new clinical health incident for an animal",
  })
  @ApiCreatedResponse({
    description: "Clinical health incident logged successfully",
  })
  @ApiNotFoundResponse({ description: "Animal or attending vet not found" })
  @ApiUnprocessableEntityResponse({
    description: "Animal is deceased/sold/culled or invalid parameters",
  })
  @ApiUnauthorizedResponse({ description: "Missing or invalid JWT token" })
  public async createIncident(
    @CurrentFarm("id") farmId: string,
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateHealthIncidentDto,
    @Headers("x-trace-id") traceId?: string
  ): Promise<HealthIncidentResponseDto> {
    return this.clinicalHealthService.createIncident(
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
  @ResponseMessage("Health incidents retrieved successfully")
  @ApiOperation({
    summary: "Query and filter clinical health incidents",
  })
  @ApiOkResponse({ description: "Paginated health incidents retrieved" })
  public async listIncidents(
    @CurrentFarm("id") farmId: string,
    @Query() query: HealthIncidentQueryDto
  ): Promise<PaginatedHealthIncidentsDto> {
    return this.clinicalHealthService.listIncidents(farmId, query);
  }

  @Post("escalations/scan")
  @FarmRoles(FarmRole.OWNER, FarmRole.MANAGER, FarmRole.VET_STAFF)
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Health incident escalation scan triggered successfully")
  @ApiOperation({
    summary: "Trigger automated escalation scan for unresolved critical/high incidents",
  })
  @ApiOkResponse({
    description: "Scan result and dispatch summary",
  })
  public async triggerEscalationScan(
    @CurrentFarm("id") farmId: string,
    @Body() dto: TriggerEscalationScanDto,
    @Headers("x-trace-id") traceId?: string
  ): Promise<EscalationScanResultDto> {
    const asOfDate = dto.asOfDate ? new Date(dto.asOfDate) : undefined;
    return this.escalationService.processFarmEscalations(
      farmId,
      asOfDate,
      dto.dryRun ?? false,
      traceId
    );
  }

  @Get("escalations/logs")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @ResponseMessage("Health incident escalation logs retrieved successfully")
  @ApiOperation({
    summary: "Query historical health incident escalation logs",
  })
  @ApiOkResponse({
    description: "Paginated health incident escalation logs",
  })
  public async listEscalationLogs(
    @CurrentFarm("id") farmId: string,
    @Query() query: HealthEscalationLogQueryDto
  ): Promise<PaginatedHealthEscalationLogsDto> {
    return this.escalationService.listEscalationLogs(farmId, query);
  }

  @Get("escalations/active")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @ResponseMessage("Active health incident escalations retrieved successfully")
  @ApiOperation({
    summary: "List all active unresolved health incident escalations for the farm",
  })
  @ApiOkResponse({
    description: "Active health incident escalation logs",
  })
  public async listActiveEscalations(
    @CurrentFarm("id") farmId: string
  ): Promise<HealthEscalationLogResponseDto[]> {
    return this.escalationService.listActiveEscalations(farmId);
  }

  @Get(":id")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @ResponseMessage("Health incident retrieved successfully")
  @ApiOperation({
    summary: "Get clinical health incident by ID",
  })
  @ApiOkResponse({ description: "Health incident details retrieved" })
  @ApiNotFoundResponse({ description: "Health incident not found" })
  public async getIncidentById(
    @CurrentFarm("id") farmId: string,
    @Param("id", ParseUUIDPipe) id: string
  ): Promise<HealthIncidentResponseDto> {
    return this.clinicalHealthService.getIncidentById(id, farmId);
  }

  @Patch(":id")
  @FarmRoles(FarmRole.OWNER, FarmRole.MANAGER, FarmRole.VET_STAFF)
  @ResponseMessage("Health incident updated successfully")
  @ApiOperation({
    summary: "Update an existing clinical health incident",
  })
  @ApiOkResponse({ description: "Health incident updated successfully" })
  @ApiConflictResponse({
    description: "Optimistic concurrency version conflict",
  })
  @ApiNotFoundResponse({ description: "Health incident not found" })
  public async updateIncident(
    @CurrentFarm("id") farmId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateHealthIncidentDto,
    @Headers("x-trace-id") traceId?: string
  ): Promise<HealthIncidentResponseDto> {
    return this.clinicalHealthService.updateIncident(
      id,
      farmId,
      user.sub,
      dto,
      traceId
    );
  }

  @Patch(":id/resolve")
  @FarmRoles(FarmRole.OWNER, FarmRole.MANAGER, FarmRole.VET_STAFF)
  @ResponseMessage("Health incident marked as resolved")
  @ApiOperation({
    summary: "Mark a clinical health incident as resolved",
  })
  @ApiOkResponse({ description: "Health incident resolved successfully" })
  @ApiConflictResponse({
    description: "Optimistic concurrency version conflict",
  })
  @ApiNotFoundResponse({ description: "Health incident not found" })
  public async resolveIncident(
    @CurrentFarm("id") farmId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ResolveHealthIncidentDto,
    @Headers("x-trace-id") traceId?: string
  ): Promise<HealthIncidentResponseDto> {
    return this.clinicalHealthService.resolveIncident(
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
  @ResponseMessage("Health incident deleted successfully")
  @ApiOperation({
    summary: "Delete an erroneously logged clinical health incident",
  })
  @ApiNotFoundResponse({ description: "Health incident not found" })
  public async deleteIncident(
    @CurrentFarm("id") farmId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Headers("x-trace-id") traceId?: string
  ): Promise<void> {
    return this.clinicalHealthService.deleteIncident(
      id,
      farmId,
      user.sub,
      traceId
    );
  }

  @Post(":id/attachments/presigned-url")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Presigned upload URL generated successfully")
  @ApiOperation({
    summary: "Request a presigned S3 PUT URL for uploading an image attachment",
  })
  @ApiOkResponse({ description: "Presigned S3 upload URL and metadata" })
  @ApiNotFoundResponse({ description: "Clinical health incident not found" })
  public async requestAttachmentUploadUrl(
    @CurrentFarm("id") farmId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RequestAttachmentPresignedUrlDto
  ): Promise<PresignedAttachmentUploadResponseDto> {
    return this.attachmentService.generateUploadPresignedUrl(
      farmId,
      id,
      user.sub,
      dto
    );
  }

  @Post(":id/attachments/:attachmentId/confirm")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @HttpCode(HttpStatus.OK)
  @ResponseMessage("Attachment upload confirmed successfully")
  @ApiOperation({
    summary: "Confirm successful direct S3 upload of health record image",
  })
  @ApiOkResponse({ description: "Confirmed attachment details with view URL" })
  @ApiNotFoundResponse({
    description: "Health record incident or attachment not found",
  })
  public async confirmAttachmentUpload(
    @CurrentFarm("id") farmId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("attachmentId", ParseUUIDPipe) attachmentId: string,
    @Body() dto: ConfirmAttachmentUploadDto
  ): Promise<HealthRecordAttachmentResponseDto> {
    return this.attachmentService.confirmUpload(farmId, id, attachmentId, dto);
  }

  @Get(":id/attachments")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @ResponseMessage("Health record attachments retrieved successfully")
  @ApiOperation({
    summary: "List all confirmed image attachments for a clinical health incident",
  })
  @ApiOkResponse({ description: "List of attachments with presigned view URLs" })
  @ApiNotFoundResponse({ description: "Clinical health incident not found" })
  public async listAttachments(
    @CurrentFarm("id") farmId: string,
    @Param("id", ParseUUIDPipe) id: string
  ): Promise<HealthRecordAttachmentResponseDto[]> {
    return this.attachmentService.listAttachments(farmId, id);
  }

  @Get(":id/attachments/:attachmentId/view-url")
  @FarmRoles(
    FarmRole.OWNER,
    FarmRole.MANAGER,
    FarmRole.HERDSMAN,
    FarmRole.VET_STAFF
  )
  @ResponseMessage("Attachment view URL retrieved successfully")
  @ApiOperation({
    summary: "Get ephemeral presigned view URL for a health record attachment",
  })
  @ApiOkResponse({
    description: "Attachment details with fresh presigned view URL",
  })
  @ApiNotFoundResponse({
    description: "Health record incident or attachment not found",
  })
  public async getAttachmentViewUrl(
    @CurrentFarm("id") farmId: string,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("attachmentId", ParseUUIDPipe) attachmentId: string
  ): Promise<HealthRecordAttachmentResponseDto> {
    return this.attachmentService.getAttachmentViewUrl(farmId, id, attachmentId);
  }

  @Delete(":id/attachments/:attachmentId")
  @FarmRoles(FarmRole.OWNER, FarmRole.MANAGER, FarmRole.VET_STAFF)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ResponseMessage("Health record attachment deleted successfully")
  @ApiOperation({
    summary: "Delete an image attachment and remove object from storage",
  })
  @ApiNotFoundResponse({
    description: "Health record incident or attachment not found",
  })
  public async deleteAttachment(
    @CurrentFarm("id") farmId: string,
    @CurrentUser() user: JwtPayload,
    @Param("id", ParseUUIDPipe) id: string,
    @Param("attachmentId", ParseUUIDPipe) attachmentId: string,
    @Headers("x-trace-id") traceId?: string
  ): Promise<void> {
    return this.attachmentService.deleteAttachment(
      farmId,
      id,
      attachmentId,
      user.sub,
      traceId
    );
  }
}
