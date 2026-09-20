import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
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
  FarmWithdrawalAlertsDto,
  FoodSafetyWithdrawalStatusDto,
  JwtPayload,
  UserRole,
  WithdrawalAlertDispatchResultDto,
} from "@vetralink/shared-types";
import { CurrentUser, ResponseMessage, Roles } from "../../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../../common/guards";
import {
  FOOD_SAFETY_SERVICE,
  IFoodSafetyService,
} from "../services/food-safety.service.interface";

@ApiTags("Tele-Veterinary - Food Safety & Drug Withdrawal")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("consultations")
export class FoodSafetyController {
  constructor(
    @Inject(FOOD_SAFETY_SERVICE)
    private readonly foodSafetyService: IFoodSafetyService,
  ) {}

  @Get(":id/food-safety-alerts")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET, UserRole.FARMER)
  @ApiOperation({
    summary: "Get food safety withdrawal alerts for a consultation",
    description:
      "Calculates milk and meat withdrawal periods for the consultation's prescribed medications, returning the active risk level and days remaining.",
  })
  @ApiOkResponse({
    description: "Food safety withdrawal status retrieved successfully",
  })
  @ApiNotFoundResponse({ description: "Consultation or animal not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description: "Insufficient permissions to view food safety data",
  })
  @ResponseMessage("Food safety withdrawal status retrieved successfully")
  public async getConsultationWithdrawalStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<FoodSafetyWithdrawalStatusDto> {
    return this.foodSafetyService.getConsultationWithdrawalStatus(id, user);
  }

  @Get("animals/:animalId/food-safety-status")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET, UserRole.FARMER)
  @ApiOperation({
    summary: "Get comprehensive food safety withdrawal status for an animal",
    description:
      "Evaluates all past and active prescriptions for the animal to calculate outer-bound milk and meat withdrawal periods and food safety clearance.",
  })
  @ApiOkResponse({
    description: "Animal food safety withdrawal status retrieved successfully",
  })
  @ApiNotFoundResponse({ description: "Animal not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description: "Insufficient permissions to view this animal's food safety data",
  })
  @ResponseMessage("Animal food safety withdrawal status retrieved successfully")
  public async getAnimalWithdrawalStatus(
    @Param("animalId", ParseUUIDPipe) animalId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<FoodSafetyWithdrawalStatusDto> {
    return this.foodSafetyService.getAnimalWithdrawalStatus(animalId, user);
  }

  @Get("farms/:farmId/food-safety-alerts")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET, UserRole.FARMER)
  @ApiOperation({
    summary: "Get all active food safety withdrawal alerts across an entire farm",
    description:
      "Aggregates all animals currently under active milk discard or meat slaughter restrictions for herd managers and food safety audits.",
  })
  @ApiOkResponse({
    description: "Farm food safety withdrawal alerts retrieved successfully",
  })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description: "Insufficient permissions to view this farm's food safety records",
  })
  @ResponseMessage("Farm food safety withdrawal alerts retrieved successfully")
  public async getFarmWithdrawalAlerts(
    @Param("farmId", ParseUUIDPipe) farmId: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<FarmWithdrawalAlertsDto> {
    return this.foodSafetyService.getFarmWithdrawalAlerts(farmId, user);
  }

  @Post(":id/food-safety-alerts/dispatch")
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET)
  @ApiOperation({
    summary: "Manually trigger or dispatch food safety withdrawal alerts to the farmer",
    description:
      "Dispatches automated push, SMS, and email alerts warning the farmer of active milk/meat withdrawal periods and discard requirements.",
  })
  @ApiOkResponse({
    description: "Food safety withdrawal alerts dispatched successfully",
  })
  @ApiNotFoundResponse({ description: "Consultation or prescription not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({
    description:
      "Only the assigned veterinarian or an administrator can dispatch withdrawal alerts",
  })
  @ResponseMessage("Food safety withdrawal alerts dispatched successfully")
  public async dispatchWithdrawalAlert(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: JwtPayload,
  ): Promise<WithdrawalAlertDispatchResultDto> {
    return this.foodSafetyService.dispatchWithdrawalAlert(
      id,
      user,
      `user-${user.sub}`,
    );
  }
}
