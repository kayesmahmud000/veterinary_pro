import {
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
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
  AnimalEhrResponseDto,
  JwtPayload,
  UserRole,
} from "@vetralink/shared-types";
import { CurrentUser, ResponseMessage, Roles } from "../../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../../common/guards";
import {
  ANIMAL_EHR_SERVICE,
  IAnimalEhrService,
} from "../services/animal-ehr.service.interface";

@ApiTags("Tele-Veterinary - Clinical EHR")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("consultations")
export class AnimalEhrController {
  constructor(
    @Inject(ANIMAL_EHR_SERVICE)
    private readonly ehrService: IAnimalEhrService,
  ) {}

  @Get(":consultationId/ehr")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET, UserRole.FARMER)
  @ApiOperation({
    summary: "Get comprehensive animal Electronic Health Record (EHR) for active consultation",
    description:
      "Retrieves the animal's full longitudinal health history, active drug withdrawal periods, vaccination ledger, lactation analytics, and clinical highlights tailored for the clinical room view.",
  })
  @ApiOkResponse({
    description: "Animal Electronic Health Record retrieved successfully",
  })
  @ApiNotFoundResponse({
    description: "Consultation or associated animal record not found",
  })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description:
      "Insufficient permissions to view the health record for this consultation",
  })
  @ResponseMessage("Animal Electronic Health Record retrieved successfully")
  public async getConsultationEhr(
    @Param("consultationId", ParseUUIDPipe) consultationId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<AnimalEhrResponseDto> {
    return this.ehrService.getConsultationEhr(
      consultationId,
      user,
      `user-${user.sub}`,
    );
  }

  @Get("animals/:animalId/ehr")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET, UserRole.FARMER)
  @ApiOperation({
    summary: "Directly view comprehensive animal Electronic Health Record (EHR)",
    description:
      "Retrieves complete animal health history with pedigree, clinical incidents, vaccinations, weight tracking, and active food safety withdrawal periods.",
  })
  @ApiOkResponse({
    description: "Animal Electronic Health Record retrieved successfully",
  })
  @ApiNotFoundResponse({ description: "Animal not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description:
      "Insufficient permissions to view this animal's health record",
  })
  @ResponseMessage("Animal Electronic Health Record retrieved successfully")
  public async getAnimalEhr(
    @Param("animalId", ParseUUIDPipe) animalId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<AnimalEhrResponseDto> {
    return this.ehrService.getAnimalEhr(
      animalId,
      user,
      `user-${user.sub}`,
    );
  }
}
