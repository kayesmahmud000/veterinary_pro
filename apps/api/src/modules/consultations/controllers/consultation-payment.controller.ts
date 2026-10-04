import {
  Body,
  Controller,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
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
  CaptureConsultationPaymentResultDto,
  ConsultationPaymentHoldResultDto,
  JwtPayload,
  ReleaseConsultationHoldResultDto,
  UserRole,
} from "@vetralink/shared-types";
import {
  CurrentFarm,
  CurrentUser,
  ResponseMessage,
  Roles,
} from "../../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../../common/guards";
import { ConfirmPaymentHoldDto, ReleasePaymentHoldDto } from "../dto";
import {
  CONSULTATION_PAYMENT_SERVICE,
  IConsultationPaymentService,
} from "../services/consultation-payment.service.interface";

@ApiTags("Tele-Veterinary - Consultation Payment")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller("consultations")
export class ConsultationPaymentController {
  constructor(
    @Inject(CONSULTATION_PAYMENT_SERVICE)
    private readonly paymentService: IConsultationPaymentService,
  ) {}

  @Post(":id/payment/hold")
  @ApiOperation({
    summary: "Initiate pay-per-consult authorization hold",
    description:
      "Places a pre-authorization hold on the client's payment method via Stripe (capture_method: manual).",
  })
  @ApiCreatedResponse({
    description: "Authorization hold initiated or confirmed as fee waived",
  })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiNotFoundResponse({ description: "Consultation not found" })
  @ResponseMessage("Consultation payment hold created successfully")
  public async createHold(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
    @CurrentFarm() farmId?: string,
  ): Promise<ConsultationPaymentHoldResultDto> {
    return this.paymentService.createHold(id, farmId ?? "", user.sub);
  }

  @Post(":id/payment/confirm-hold")
  @ApiOperation({
    summary: "Confirm pay-per-consult authorization hold",
    description:
      "Confirms that the payment intent hold has succeeded on the frontend SDK.",
  })
  @ApiOkResponse({
    description: "Authorization hold confirmed successfully",
  })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiNotFoundResponse({ description: "Consultation not found" })
  @ResponseMessage("Consultation payment hold confirmed successfully")
  public async confirmHold(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ConfirmPaymentHoldDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ConsultationPaymentHoldResultDto> {
    return this.paymentService.confirmHold(id, dto.paymentIntentId, user.sub);
  }

  @Post(":id/payment/capture")
  @UseGuards(RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET)
  @ApiOperation({
    summary: "Capture consultation payment",
    description:
      "Captures the pre-authorized payment hold upon clinical completion of the consultation.",
  })
  @ApiOkResponse({
    description: "Payment captured successfully",
  })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description: "Insufficient permissions to capture payment",
  })
  @ApiNotFoundResponse({ description: "Consultation not found" })
  @ResponseMessage("Consultation payment captured successfully")
  public async capturePayment(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<CaptureConsultationPaymentResultDto> {
    return this.paymentService.capturePayment(id, user.sub);
  }

  @Post(":id/payment/release")
  @ApiOperation({
    summary: "Release or void consultation payment hold",
    description:
      "Releases/voids the pre-authorization hold on the farmer's card when a consultation is cancelled or declined.",
  })
  @ApiOkResponse({
    description: "Payment hold released successfully",
  })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiNotFoundResponse({ description: "Consultation not found" })
  @ResponseMessage("Consultation payment hold released successfully")
  public async releaseHold(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReleasePaymentHoldDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<ReleaseConsultationHoldResultDto> {
    return this.paymentService.releaseHold(
      id,
      dto.reason ?? "Consultation cancelled",
      user.sub,
    );
  }
}
