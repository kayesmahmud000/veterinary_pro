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
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  FarmQuotaSummaryDto,
  JwtPayload,
  SubscriptionStatus,
  UserRole,
} from "@vetralink/shared-types";
import { CurrentUser, ResponseMessage, Roles } from "../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../common/guards";
import {
  CancelSubscriptionDto,
  CreateTrialSubscriptionDto,
  SubscriptionResponseDto,
  UpdateSubscriptionStatusDto,
} from "./dto";
import {
  ISubscriptionLifecycleService,
  SUBSCRIPTION_LIFECYCLE_SERVICE,
} from "./services/subscription-lifecycle.service.interface";
import {
  ISubscriptionQuotaService,
  SUBSCRIPTION_QUOTA_SERVICE,
} from "./services/subscription-quota.service.interface";

@ApiTags("Subscriptions")
@Controller("subscriptions")
export class SubscriptionController {
  constructor(
    @Inject(SUBSCRIPTION_LIFECYCLE_SERVICE)
    private readonly subService: ISubscriptionLifecycleService,
    @Inject(SUBSCRIPTION_QUOTA_SERVICE)
    private readonly quotaService: ISubscriptionQuotaService,
  ) {}

  @Get("farm/:farmId/quota")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get farm subscription tier quota usage",
    description: "Returns real-time animal and staff quota usage, limits, headroom, and tier features",
  })
  @ApiOkResponse({
    description: "Farm quota usage retrieved successfully",
  })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ResponseMessage("Farm quota usage retrieved successfully")
  async getFarmQuota(
    @Param("farmId", ParseUUIDPipe) farmId: string,
  ): Promise<FarmQuotaSummaryDto> {
    return this.quotaService.getFarmQuotaUsage(farmId);
  }

  @Get("current")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Get current subscription for user or farm tenant",
    description: "Returns active subscription metadata, plan details, quota allowances, and days remaining",
  })
  @ApiOkResponse({
    type: SubscriptionResponseDto,
    description: "Subscription details retrieved successfully",
  })
  @ApiNotFoundResponse({ description: "No subscription found for user/farm" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ResponseMessage("Current subscription retrieved successfully")
  async getCurrentSubscription(
    @CurrentUser() user: JwtPayload,
    @Query("farmId") farmId?: string,
  ): Promise<SubscriptionResponseDto> {
    return this.subService.getUserSubscription(user.sub, farmId);
  }

  @Post("trial")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Initialize a free trial subscription",
    description: "Provisions a 14-day (or custom duration) trial on the specified tier (defaults to PRO)",
  })
  @ApiOkResponse({
    type: SubscriptionResponseDto,
    description: "Trial subscription initialized successfully",
  })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ResponseMessage("Trial subscription initialized successfully")
  async startTrial(
    @CurrentUser() user: JwtPayload,
    @Body() dto: CreateTrialSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    return this.subService.createTrialSubscription(user.sub, dto);
  }

  @Post(":id/cancel")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Cancel subscription",
    description: "Cancels subscription either at period end (default) or immediately upon request",
  })
  @ApiOkResponse({
    type: SubscriptionResponseDto,
    description: "Subscription cancellation processed successfully",
  })
  @ApiNotFoundResponse({ description: "Subscription not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ResponseMessage("Subscription cancellation processed successfully")
  async cancelSubscription(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: CancelSubscriptionDto,
  ): Promise<SubscriptionResponseDto> {
    return this.subService.cancelSubscription(id, dto);
  }

  @Post(":id/reactivate")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Reactivate subscription with pending cancellation",
    description: "Revokes a pending period-end cancellation before the term expires",
  })
  @ApiOkResponse({
    type: SubscriptionResponseDto,
    description: "Subscription cancellation revoked successfully",
  })
  @ApiNotFoundResponse({ description: "Subscription not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ResponseMessage("Subscription cancellation revoked successfully")
  async reactivateSubscription(
    @Param("id", new ParseUUIDPipe()) id: string,
  ): Promise<SubscriptionResponseDto> {
    return this.subService.reactivateSubscription(id);
  }

  @Patch(":id/status")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Update subscription lifecycle status (Admin only)",
    description: "Manually mutate subscription status between ACTIVE, PAST_DUE, and CANCELED",
  })
  @ApiOkResponse({
    type: SubscriptionResponseDto,
    description: "Subscription status updated successfully",
  })
  @ApiNotFoundResponse({ description: "Subscription not found" })
  @ApiUnauthorizedResponse({ description: "JWT authentication required" })
  @ApiForbiddenResponse({ description: "Requires SUPER_ADMIN or ADMIN role" })
  @ResponseMessage("Subscription status updated successfully")
  async updateStatus(
    @Param("id", new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateSubscriptionStatusDto,
  ): Promise<SubscriptionResponseDto> {
    if (dto.status === SubscriptionStatus.ACTIVE) {
      return this.subService.activateSubscription(id, {
        gatewaySubId: dto.gatewaySubId,
        periodEnd: dto.currentPeriodEnd ? new Date(dto.currentPeriodEnd) : undefined,
      });
    }

    if (dto.status === SubscriptionStatus.PAST_DUE) {
      return this.subService.markSubscriptionPastDue(id);
    }

    if (dto.status === SubscriptionStatus.CANCELED) {
      return this.subService.cancelSubscription(id, { immediate: true });
    }

    return this.subService.activateSubscription(id, {
      gatewaySubId: dto.gatewaySubId,
    });
  }
}
