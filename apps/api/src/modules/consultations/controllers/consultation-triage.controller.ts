import {
  Body,
  Controller,
  Get,
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
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  ConsultationResponseDto,
  JwtPayload,
  TriageCaseDetailDto,
  TriageMetricsDto,
  TriageQueueItemDto,
  UserRole,
  VetCandidateDto,
} from "@vetralink/shared-types";
import { CurrentUser, ResponseMessage, Roles } from "../../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../../common/guards";
import {
  AssignConsultationDto,
  AutoAssignConsultationDto,
  CancelTriageCaseDto,
  QueryTriageQueueDto,
} from "../dto";
import {
  CONSULTATION_SERVICE,
  IConsultationService,
} from "../services/consultation.service.interface";
import {
  IVetAssignmentService,
  VET_ASSIGNMENT_SERVICE,
} from "../services/vet-assignment.service.interface";

@ApiTags("Tele-Veterinary - Triage")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET)
@Controller("consultations/triage")
export class ConsultationTriageController {
  constructor(
    @Inject(CONSULTATION_SERVICE)
    private readonly consultationService: IConsultationService,
    @Inject(VET_ASSIGNMENT_SERVICE)
    private readonly vetAssignmentService: IVetAssignmentService,
  ) {}

  @Get("queue")
  @ApiOperation({
    summary: "List incoming consultations in the triage queue",
    description:
      "Retrieves a paginated list of consultations for triage review. Filterable by status, type, species, farm, and search terms.",
  })
  @ApiOkResponse({
    description: "Triage queue retrieved successfully",
  })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description: "Requires SUPER_ADMIN, ADMIN, or VET role",
  })
  @ResponseMessage("Triage queue retrieved successfully")
  public async getTriageQueue(
    @Query() query: QueryTriageQueueDto,
  ): Promise<{
    items: TriageQueueItemDto[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    return this.consultationService.getTriageQueue(query);
  }

  @Get("metrics")
  @ApiOperation({
    summary: "Get real-time triage queue dashboard metrics",
    description:
      "Computes pending/assigned/in-progress counts, today's completions/cancellations, modality breakdown, species breakdown, and wait times.",
  })
  @ApiOkResponse({
    description: "Triage metrics retrieved successfully",
  })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description: "Requires SUPER_ADMIN, ADMIN, or VET role",
  })
  @ResponseMessage("Triage metrics retrieved successfully")
  public async getTriageMetrics(): Promise<TriageMetricsDto> {
    return this.consultationService.getTriageMetrics();
  }

  @Get("queue/:id")
  @ApiOperation({
    summary: "Get detailed triage case view with animal EHR history",
    description:
      "Retrieves consultation request details, farmer contact info, farm profile, and recent health/vaccine records of the animal.",
  })
  @ApiOkResponse({
    description: "Triage case details retrieved successfully",
  })
  @ApiNotFoundResponse({ description: "Consultation not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description: "Requires SUPER_ADMIN, ADMIN, or VET role",
  })
  @ResponseMessage("Triage case details retrieved successfully")
  public async getTriageCaseDetail(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<TriageCaseDetailDto> {
    return this.consultationService.getTriageCaseDetail(id);
  }

  @Patch("queue/:id/cancel")
  @ApiOperation({
    summary: "Cancel or reject a consultation request from the triage queue",
    description:
      "Cancels an uncompleted consultation request with a mandatory reason. Emits an audit log.",
  })
  @ApiOkResponse({
    description: "Consultation cancelled by triage successfully",
  })
  @ApiNotFoundResponse({ description: "Consultation not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description: "Requires SUPER_ADMIN, ADMIN, or VET role",
  })
  @ResponseMessage("Consultation cancelled by triage successfully")
  public async cancelTriageCase(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CancelTriageCaseDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ConsultationResponseDto> {
    return this.consultationService.cancelTriageCase(
      id,
      dto.reason,
      user.sub,
      `user-${user.sub}`,
    );
  }

  @Get("queue/:id/candidates")
  @ApiOperation({
    summary: "Get ranked veterinarian candidate recommendations for a consultation",
    description:
      "Evaluates all active veterinarians against the consultation's species, modality, schedule, and current active caseload, returning a ranked candidate list with score breakdowns.",
  })
  @ApiOkResponse({
    description: "Ranked candidates retrieved successfully",
  })
  @ApiNotFoundResponse({ description: "Consultation not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description: "Requires SUPER_ADMIN, ADMIN, or VET role",
  })
  @ResponseMessage("Ranked candidates retrieved successfully")
  public async getCandidates(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<VetCandidateDto[]> {
    return this.vetAssignmentService.getRankedCandidates(id);
  }

  @Post("queue/:id/assign")
  @ApiOperation({
    summary: "Manually assign a veterinarian to a consultation request",
    description:
      "Assigns a specific veterinarian to the consultation, transitions status to ASSIGNED, and records an audit log.",
  })
  @ApiCreatedResponse({
    description: "Consultation assigned to veterinarian successfully",
  })
  @ApiNotFoundResponse({ description: "Consultation not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description: "Requires SUPER_ADMIN, ADMIN, or VET role",
  })
  @ResponseMessage("Consultation assigned to veterinarian successfully")
  public async assignToVet(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AssignConsultationDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ConsultationResponseDto> {
    return this.vetAssignmentService.assignToVet(
      id,
      dto,
      user.sub,
      `user-${user.sub}`,
    );
  }

  @Post("queue/:id/auto-assign")
  @ApiOperation({
    summary: "Automatically assign the highest-scoring eligible veterinarian to a consultation",
    description:
      "Runs the smart matching algorithm, selects the #1 ranked eligible veterinarian, and executes assignment atomically.",
  })
  @ApiCreatedResponse({
    description: "Consultation auto-assigned successfully",
  })
  @ApiNotFoundResponse({ description: "Consultation not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description: "Requires SUPER_ADMIN, ADMIN, or VET role",
  })
  @ResponseMessage("Consultation auto-assigned successfully")
  public async autoAssign(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AutoAssignConsultationDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ConsultationResponseDto> {
    return this.vetAssignmentService.autoAssign(
      id,
      dto,
      user.sub,
      `user-${user.sub}`,
    );
  }
}
