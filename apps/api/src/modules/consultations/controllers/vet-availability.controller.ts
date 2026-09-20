import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Put,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  JwtPayload,
  UserRole,
  VetAvailabilitySummaryDto,
  VetProfileDto,
} from "@vetralink/shared-types";
import { CurrentUser, ResponseMessage, Roles } from "../../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../../common/guards";
import { UpdateVetProfileDto } from "../dto";
import {
  IVetAssignmentService,
  VET_ASSIGNMENT_SERVICE,
} from "../services/vet-assignment.service.interface";

@ApiTags("Tele-Veterinary - Vet Availability")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("consultations/vets")
export class VetAvailabilityController {
  constructor(
    @Inject(VET_ASSIGNMENT_SERVICE)
    private readonly vetAssignmentService: IVetAssignmentService,
  ) {}

  @Get("availability")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET)
  @ApiOperation({
    summary: "Get clinic-wide veterinarian availability and active capacity summary",
    description:
      "Lists all active veterinarians with their availability toggle, specialties, active caseload, max capacity, and capacity utilization percentage.",
  })
  @ApiOkResponse({
    description: "Veterinarian availability list retrieved successfully",
  })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description: "Requires SUPER_ADMIN, ADMIN, or VET role",
  })
  @ResponseMessage("Veterinarian availability list retrieved successfully")
  public async getAvailabilityList(): Promise<VetAvailabilitySummaryDto[]> {
    return this.vetAssignmentService.getVetAvailabilityList();
  }

  @Get(":id/availability")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET)
  @ApiOperation({
    summary: "Get detailed availability and scheduling profile for a specific veterinarian",
    description:
      "Retrieves specialties, working hours, max caseload, and timezone for a veterinarian.",
  })
  @ApiOkResponse({
    description: "Veterinarian profile retrieved successfully",
  })
  @ApiNotFoundResponse({ description: "Veterinarian not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description: "Requires SUPER_ADMIN, ADMIN, or VET role",
  })
  @ResponseMessage("Veterinarian profile retrieved successfully")
  public async getVetProfile(
    @Param("id", ParseUUIDPipe) id: string,
  ): Promise<VetProfileDto> {
    return this.vetAssignmentService.getVetProfile(id);
  }

  @Put(":id/availability")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET)
  @ApiOperation({
    summary: "Update veterinarian availability, capacity, or schedule",
    description:
      "Updates availability toggle, specialties, working hours, or max active caseload. Veterinarians can update their own profile; clinic admins can update any vet.",
  })
  @ApiOkResponse({
    description: "Veterinarian profile updated successfully",
  })
  @ApiNotFoundResponse({ description: "Veterinarian not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description: "Insufficient permissions to update this profile",
  })
  @ResponseMessage("Veterinarian profile updated successfully")
  public async updateVetProfile(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateVetProfileDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<VetProfileDto> {
    return this.vetAssignmentService.updateVetProfile(
      id,
      dto,
      user.sub,
      user.role,
      `user-${user.sub}`,
    );
  }
}
