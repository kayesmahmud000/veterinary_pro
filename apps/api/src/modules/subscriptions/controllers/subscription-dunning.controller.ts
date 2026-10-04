import {
  Body,
  Controller,
  Get,
  Inject,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import {
  DunningScanResultDto,
  JwtPayload,
  SubscriptionDunningLogDto,
  SubscriptionSuspensionResultDto,
  UserRole,
} from "@vetralink/shared-types";
import { CurrentUser, ResponseMessage, Roles } from "../../../common/decorators";
import { JwtAuthGuard, RolesGuard } from "../../../common/guards";
import {
  DispatchDunningStageDto,
  QueryDunningLogsRequestDto,
  TriggerDunningScanRequestDto,
} from "../dto/dunning-requests.dto";
import {
  ISubscriptionDunningQueueService,
  SUBSCRIPTION_DUNNING_QUEUE_SERVICE,
} from "../services/subscription-dunning-queue.service.interface";
import {
  ISubscriptionDunningService,
  SUBSCRIPTION_DUNNING_SERVICE,
} from "../services/subscription-dunning.service.interface";
import {
  ISubscriptionGracePeriodService,
  SUBSCRIPTION_GRACE_PERIOD_SERVICE,
} from "../services/subscription-grace-period.service.interface";

@ApiTags("Subscriptions - Dunning")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller("subscriptions/dunning")
export class SubscriptionDunningController {
  constructor(
    @Inject(SUBSCRIPTION_DUNNING_SERVICE)
    private readonly dunningService: ISubscriptionDunningService,
    @Inject(SUBSCRIPTION_DUNNING_QUEUE_SERVICE)
    private readonly dunningQueueService: ISubscriptionDunningQueueService,
    @Inject(SUBSCRIPTION_GRACE_PERIOD_SERVICE)
    private readonly gracePeriodService: ISubscriptionGracePeriodService,
  ) {}

  @Post("suspensions/process")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: "Process subscription suspensions for accounts exceeding 7 days past due",
    description:
      "Transitions past-due subscriptions past the 7-day grace threshold into EXPIRED status and records audit events.",
  })
  @ApiOkResponse({ description: "Suspensions processed successfully" })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Forbidden - requires Admin privileges" })
  @ResponseMessage("Subscription suspensions processed successfully")
  public async processSuspensions(
    @CurrentUser() user?: JwtPayload,
  ): Promise<SubscriptionSuspensionResultDto> {
    return this.gracePeriodService.processSuspensions(
      undefined,
      user ? `user-${user.sub}` : undefined,
    );
  }

  @Post("scan")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: "Execute on-demand synchronous dunning scan across past-due subscriptions",
    description:
      "Evaluates past-due subscriptions against Day 1, Day 3, and Day 7 milestones and dispatches notifications.",
  })
  @ApiOkResponse({ description: "Scan completed with result breakdown" })
  @ApiUnauthorizedResponse({ description: "Unauthorized" })
  @ApiForbiddenResponse({ description: "Forbidden - requires Admin privileges" })
  @ResponseMessage("Dunning scan completed successfully")
  public async triggerScan(
    @Body() dto?: TriggerDunningScanRequestDto,
    @CurrentUser() user?: JwtPayload,
  ): Promise<DunningScanResultDto> {
    return this.dunningService.scanAndDispatchDunning(
      dto,
      user ? `user-${user.sub}` : undefined,
    );
  }

  @Post("queue/scan")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: "Enqueue asynchronous background dunning scan job in BullMQ",
    description: "Submits a SCAN_ALL_PAST_DUE job to the subscription-dunning queue.",
  })
  @ApiOkResponse({ description: "Background job enqueued successfully" })
  @ResponseMessage("Background dunning scan job enqueued")
  public async queueScan(
    @Body() dto?: TriggerDunningScanRequestDto,
    @CurrentUser() user?: JwtPayload,
  ): Promise<{ jobId: string }> {
    const jobId = await this.dunningQueueService.dispatchScan(
      dto,
      user ? `user-${user.sub}` : undefined,
    );
    return { jobId };
  }

  @Post("dispatch")
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  @ApiOperation({
    summary: "Dispatch a specific dunning stage notification for a subscription",
    description:
      "Dispatches the specified dunning stage notification (DAY_1, DAY_3, DAY_7) via email and records an audit log.",
  })
  @ApiOkResponse({ description: "Dunning notification dispatched" })
  @ResponseMessage("Dunning notification dispatched")
  public async dispatchStage(
    @Body() dto: DispatchDunningStageDto,
    @CurrentUser() user?: JwtPayload,
  ): Promise<SubscriptionDunningLogDto> {
    return this.dunningService.dispatchDunningStage({
      subscriptionId: dto.subscriptionId,
      stage: dto.stage,
      channel: dto.channel,
      gatewayInvoiceId: dto.gatewayInvoiceId,
      traceId: user ? `user-${user.sub}` : undefined,
    });
  }

  @Get("logs")
  @ApiOperation({
    summary: "Query subscription dunning notification history and audit logs",
    description:
      "Returns paginated dunning history. Non-admin users are automatically scoped to their own account.",
  })
  @ApiOkResponse({ description: "Paginated dunning notification logs" })
  @ResponseMessage("Dunning logs retrieved successfully")
  public async getLogs(
    @Query() query: QueryDunningLogsRequestDto,
    @CurrentUser() user: JwtPayload,
  ): Promise<{ items: SubscriptionDunningLogDto[]; total: number }> {
    const isAdmin =
      user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN;

    const scopedQuery = {
      ...query,
      userId: isAdmin ? query.userId : user.sub,
    };

    return this.dunningService.getDunningLogs(scopedQuery);
  }
}
