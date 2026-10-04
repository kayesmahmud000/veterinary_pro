import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
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
} from "@vetralink/shared-types";
import {
  CurrentFarm,
  CurrentUser,
  ResponseMessage,
  Tenant,
} from "../../common/decorators";
import { JwtAuthGuard, TenantGuard } from "../../common/guards";
import { SubscriptionReadOnlyGuard } from "../subscriptions/guards/subscription-read-only.guard";
import { CreateConsultationDto, QueryConsultationsDto } from "./dto";
import {
  CONSULTATION_SERVICE,
  IConsultationService,
} from "./services/consultation.service.interface";

@ApiTags("Tele-Veterinary - Consultations")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, TenantGuard, SubscriptionReadOnlyGuard)
@Controller("consultations")
export class ConsultationController {
  constructor(
    @Inject(CONSULTATION_SERVICE)
    private readonly consultationService: IConsultationService,
  ) {}

  @Post()
  @Tenant()
  @ApiOperation({
    summary: "Submit a farmer clinical consultation request",
    description:
      "Creates an asynchronous ticket or live video consultation request for an animal or herd.",
  })
  @ApiCreatedResponse({
    description: "Consultation request submitted successfully",
  })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({ description: "Access denied to farm or read-only mode" })
  @ResponseMessage("Consultation request submitted successfully")
  public async createConsultation(
    @CurrentUser() user: JwtPayload,
    @CurrentFarm("id") farmId: string,
    @Body() dto: CreateConsultationDto,
  ): Promise<ConsultationResponseDto> {
    return this.consultationService.createConsultation(
      user.sub,
      {
        ...dto,
        farmId: farmId || dto.farmId,
      },
      `user-${user.sub}`,
    );
  }

  @Get()
  @Tenant()
  @ApiOperation({
    summary: "List consultations for a farm tenant",
    description:
      "Retrieves paginated consultations for the farm specified by tenant header or context.",
  })
  @ApiOkResponse({
    description: "Consultations retrieved successfully",
  })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({ description: "Access denied to farm" })
  @ResponseMessage("Consultations retrieved successfully")
  public async getConsultations(
    @CurrentUser() user: JwtPayload,
    @CurrentFarm("id") farmId: string,
    @Query() query: QueryConsultationsDto,
  ): Promise<{ items: ConsultationResponseDto[]; total: number }> {
    return this.consultationService.getFarmerConsultations(
      user.sub,
      farmId,
      query,
    );
  }

  @Get(":id")
  @Tenant()
  @ApiOperation({
    summary: "Get consultation request details by ID",
    description:
      "Retrieves details of a specific consultation request within the tenant farm.",
  })
  @ApiOkResponse({
    description: "Consultation retrieved successfully",
  })
  @ApiNotFoundResponse({ description: "Consultation not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({ description: "Access denied to farm" })
  @ResponseMessage("Consultation retrieved successfully")
  public async getConsultationById(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentFarm("id") farmId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<ConsultationResponseDto> {
    return this.consultationService.getConsultationById(
      id,
      farmId,
      user.sub,
      user.role,
    );
  }
}
