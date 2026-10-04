import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
import { SubscriptionTier, UserRole } from "@vetralink/shared-types";
import { Public, ResponseMessage, Roles } from "../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import {
  QuerySubscriptionPlansDto,
  SubscriptionPlanResponseDto,
  UpdateSubscriptionPlanDto,
} from "./dto";
import {
  ISubscriptionPlanService,
  SUBSCRIPTION_PLAN_SERVICE,
} from "./services/subscription-plan.service.interface";

@ApiTags("Subscriptions")
@Controller("subscriptions/plans")
export class SubscriptionPlanController {
  constructor(
    @Inject(SUBSCRIPTION_PLAN_SERVICE)
    private readonly planService: ISubscriptionPlanService,
  ) {}

  @Get()
  @Public()
  @ApiOperation({
    summary: "Get all available subscription plans",
    description: "Returns all active subscription tiers (STARTER, PRO, ENTERPRISE) with pricing and quota features",
  })
  @ApiOkResponse({
    type: [SubscriptionPlanResponseDto],
    description: "List of subscription plans retrieved successfully",
  })
  @ResponseMessage("Subscription plans retrieved successfully")
  async getPlans(
    @Query() query: QuerySubscriptionPlansDto,
  ): Promise<SubscriptionPlanResponseDto[]> {
    return this.planService.getAvailablePlans(query.includeInactive);
  }

  @Get(":tier")
  @Public()
  @ApiOperation({
    summary: "Get subscription plan by tier enum",
    description: "Retrieve plan details for a specific tier (STARTER, PRO, ENTERPRISE)",
  })
  @ApiOkResponse({
    type: SubscriptionPlanResponseDto,
    description: "Subscription plan details retrieved successfully",
  })
  @ApiNotFoundResponse({ description: "Plan for specified tier not found" })
  @ResponseMessage("Subscription plan retrieved successfully")
  async getPlanByTier(
    @Param("tier", new ParseEnumPipe(SubscriptionTier)) tier: SubscriptionTier,
  ): Promise<SubscriptionPlanResponseDto> {
    return this.planService.getPlanByTier(tier);
  }

  @Post("seed")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Idempotently seed default subscription plans (Admin only)",
    description: "Ensures STARTER (5 animals), PRO (30 animals), and ENTERPRISE (unlimited) plans exist in the database",
  })
  @ApiOkResponse({
    type: [SubscriptionPlanResponseDto],
    description: "Default subscription plans synchronized successfully",
  })
  @ApiUnauthorizedResponse({ description: "JWT access token missing or invalid" })
  @ApiForbiddenResponse({ description: "Requires SUPER_ADMIN or ADMIN role" })
  @ResponseMessage("Default subscription plans seeded successfully")
  async seedDefaultPlans(): Promise<SubscriptionPlanResponseDto[]> {
    return this.planService.seedDefaultPlans();
  }

  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update subscription plan details (Admin only)",
    description: "Update display name, pricing, quotas, or active status of an existing plan",
  })
  @ApiOkResponse({
    type: SubscriptionPlanResponseDto,
    description: "Subscription plan updated successfully",
  })
  @ApiNotFoundResponse({ description: "Plan with specified ID not found" })
  @ApiUnauthorizedResponse({ description: "JWT access token missing or invalid" })
  @ApiForbiddenResponse({ description: "Requires SUPER_ADMIN or ADMIN role" })
  @ResponseMessage("Subscription plan updated successfully")
  async updatePlan(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSubscriptionPlanDto,
  ): Promise<SubscriptionPlanResponseDto> {
    return this.planService.updatePlan(id, dto);
  }
}
