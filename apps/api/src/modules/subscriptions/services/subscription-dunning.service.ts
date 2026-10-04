import {
  Inject,
  Injectable,
  Logger,
  Optional,
} from "@nestjs/common";
import {
  DunningChannel,
  DunningScanDetailDto,
  DunningScanResultDto,
  DunningStage,
  DunningStatus,
  QueryDunningLogsDto,
  SubscriptionDunningLogDto,
  TriggerDunningScanDto,
} from "@vetralink/shared-types";
import { EntityNotFoundException } from "../../../common/exceptions/domain.exception";
import { EnvService } from "../../../config/env.service";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../../audit/repositories/audit-log.repository.interface";
import {
  EMAIL_PROVIDER_TOKEN,
  IEmailProvider,
} from "../../mail/interfaces/mail-provider.interface";
import {
  IUserRepository,
  USER_REPOSITORY,
} from "../../users/repositories/user.repository.interface";
import { SubscriptionDunningLogEntity } from "../entities/subscription-dunning-log.entity";
import {
  ISubscriptionDunningLogRepository,
  SUBSCRIPTION_DUNNING_LOG_REPOSITORY,
} from "../repositories/subscription-dunning-log.repository.interface";
import {
  ISubscriptionRepository,
  SUBSCRIPTION_REPOSITORY,
} from "../repositories/subscription.repository.interface";
import {
  IStripePortalService,
  STRIPE_PORTAL_SERVICE,
} from "./stripe-portal.service.interface";
import { ISubscriptionDunningService } from "./subscription-dunning.service.interface";
import { generateDunningEmail } from "../templates/dunning-email.template";

@Injectable()
export class SubscriptionDunningService implements ISubscriptionDunningService {
  private readonly logger = new Logger(SubscriptionDunningService.name);

  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subRepo: ISubscriptionRepository,
    @Inject(SUBSCRIPTION_DUNNING_LOG_REPOSITORY)
    private readonly dunningLogRepo: ISubscriptionDunningLogRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepo: IAuditLogRepository,
    @Inject(EMAIL_PROVIDER_TOKEN)
    private readonly emailProvider: IEmailProvider,
    private readonly envService: EnvService,
    @Optional()
    @Inject(STRIPE_PORTAL_SERVICE)
    private readonly stripePortalService?: IStripePortalService,
  ) {}

  public async scanAndDispatchDunning(
    options?: TriggerDunningScanDto,
    traceId?: string,
  ): Promise<DunningScanResultDto> {
    const activeTraceId = traceId ?? crypto.randomUUID();
    const asOfDate = options?.asOfDate ? new Date(options.asOfDate) : new Date();
    const dateStr = asOfDate.toISOString().slice(0, 10);
    const dryRun = options?.dryRun ?? false;

    this.logger.log(
      `Starting dunning scan [Trace: ${activeTraceId}, AsOf: ${dateStr}, DryRun: ${dryRun}]`,
    );

    let pastDueSubscriptions = await this.subRepo.findPastDueSubscriptions();

    if (options?.targetSubscriptionId) {
      pastDueSubscriptions = pastDueSubscriptions.filter(
        (s) => s.id === options.targetSubscriptionId,
      );
    }

    const details: DunningScanDetailDto[] = [];
    let scannedCount = 0;
    let eligibleCount = 0;
    let dispatchedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;

    for (const sub of pastDueSubscriptions) {
      scannedCount++;
      const stage = sub.calculateDunningStage(asOfDate);

      if (!stage) {
        continue;
      }

      eligibleCount++;
      const daysPastDue = sub.daysPastDue(asOfDate);

      // Check daily deduplication to avoid duplicate emails on the same calendar day
      const existingLog = await this.dunningLogRepo.findBySubscriptionAndStage(
        sub.id,
        stage,
        DunningChannel.EMAIL,
        dateStr,
      );

      if (existingLog && existingLog.status === DunningStatus.SENT) {
        skippedCount++;
        details.push({
          subscriptionId: sub.id,
          userId: sub.userId,
          farmId: sub.farmId,
          stage,
          status: DunningStatus.SKIPPED,
          daysPastDue,
          message: `Already dispatched stage ${stage} on ${dateStr}`,
        });
        continue;
      }

      if (dryRun) {
        skippedCount++;
        details.push({
          subscriptionId: sub.id,
          userId: sub.userId,
          farmId: sub.farmId,
          stage,
          status: DunningStatus.SKIPPED,
          daysPastDue,
          message: `[DryRun] Eligible for ${stage} dunning notification (${daysPastDue} days past due)`,
        });
        continue;
      }

      try {
        const result = await this.dispatchDunningStage({
          subscriptionId: sub.id,
          stage,
          channel: DunningChannel.EMAIL,
          traceId: activeTraceId,
        });

        if (result.status === DunningStatus.SENT) {
          dispatchedCount++;
          details.push({
            subscriptionId: sub.id,
            userId: sub.userId,
            farmId: sub.farmId,
            stage,
            status: DunningStatus.SENT,
            daysPastDue,
            recipientEmail: result.recipientEmail,
            message: `Dispatched ${stage} dunning notification successfully`,
          });
        } else {
          failedCount++;
          details.push({
            subscriptionId: sub.id,
            userId: sub.userId,
            farmId: sub.farmId,
            stage,
            status: DunningStatus.FAILED,
            daysPastDue,
            recipientEmail: result.recipientEmail,
            message: result.errorMessage ?? "Failed to dispatch notification",
          });
        }
      } catch (err: unknown) {
        failedCount++;
        const errorMsg = err instanceof Error ? err.message : "Unknown error";
        this.logger.error(
          `Failed to dispatch dunning stage ${stage} for subscription [${sub.id}]: ${errorMsg}`,
        );
        details.push({
          subscriptionId: sub.id,
          userId: sub.userId,
          farmId: sub.farmId,
          stage,
          status: DunningStatus.FAILED,
          daysPastDue,
          message: errorMsg,
        });
      }
    }

    this.logger.log(
      `Dunning scan completed: Scanned=${scannedCount}, Eligible=${eligibleCount}, Dispatched=${dispatchedCount}, Skipped=${skippedCount}, Failed=${failedCount}`,
    );

    return {
      scannedCount,
      eligibleCount,
      dispatchedCount,
      skippedCount,
      failedCount,
      details,
    };
  }

  public async dispatchDunningStage(params: {
    subscriptionId: string;
    stage: DunningStage;
    channel?: DunningChannel;
    gatewayInvoiceId?: string;
    traceId?: string;
  }): Promise<SubscriptionDunningLogDto> {
    const {
      subscriptionId,
      stage,
      channel = DunningChannel.EMAIL,
      gatewayInvoiceId,
    } = params;
    const activeTraceId = params.traceId ?? crypto.randomUUID();
    const dateStr = new Date().toISOString().slice(0, 10);

    // 1. Check idempotency for today
    const existingLog = await this.dunningLogRepo.findBySubscriptionAndStage(
      subscriptionId,
      stage,
      channel,
      dateStr,
    );
    if (existingLog && existingLog.status === DunningStatus.SENT) {
      this.logger.log(
        `Dunning stage ${stage} already dispatched today for subscription [${subscriptionId}]. Skipping.`,
      );
      return existingLog.toDto();
    }

    // 2. Resolve Subscription
    const subscription = await this.subRepo.findById(subscriptionId);
    if (!subscription) {
      throw new EntityNotFoundException("Subscription", subscriptionId);
    }

    // 3. Resolve User
    const user = await this.userRepo.findById(subscription.userId);
    if (!user) {
      throw new EntityNotFoundException("User", subscription.userId);
    }

    // 4. Resolve Customer Portal URL
    const fallbackBaseUrl =
      this.envService.corsOrigins[0] ?? "https://vetralink.pro";
    let portalUrl = `${fallbackBaseUrl}/settings/billing`;
    if (this.stripePortalService) {
      try {
        const portalSession =
          await this.stripePortalService.createCustomerPortalSession(user.id);
        portalUrl = portalSession.url;
      } catch (err) {
        this.logger.warn(
          `Could not generate Stripe Customer Portal URL for user [${user.id}]: ${
            (err as Error).message
          }. Falling back to default web billing URL.`,
        );
      }
    }

    // 5. Format email details
    const planName = subscription.plan?.name ?? "VetraLink Pro Subscription";
    const amountDueFormatted = subscription.plan
      ? `$${(subscription.plan.priceMonthlyCents / 100).toFixed(2)} USD`
      : "your subscription renewal";

    const gracePeriodEnd = new Date(
      subscription.currentPeriodEnd.getTime() + 3 * 24 * 60 * 60 * 1000,
    );
    const gracePeriodEndDate = gracePeriodEnd.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

    const farmName = subscription.farm?.name ?? null;

    const { subject, html, text } = generateDunningEmail({
      stage,
      recipientName: user.name,
      recipientEmail: user.email,
      farmName,
      planName,
      amountDueFormatted,
      portalUrl,
      gracePeriodEndDate,
      failedDate: subscription.currentPeriodEnd.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    });

    // 6. Send Email
    const sendResult = await this.emailProvider.sendEmail({
      to: user.email,
      subject,
      html,
      text,
    });

    // 7. Create and persist Dunning Log Entity
    const dunningLog = SubscriptionDunningLogEntity.create({
      subscriptionId: subscription.id,
      userId: user.id,
      farmId: subscription.farmId,
      stage,
      channel,
      status: sendResult.success ? DunningStatus.SENT : DunningStatus.FAILED,
      recipientEmail: user.email,
      subject,
      message: text,
      errorMessage: sendResult.success ? null : sendResult.error,
      gatewayInvoiceId: gatewayInvoiceId ?? null,
    });

    const savedLog = await this.dunningLogRepo.save(dunningLog);

    // 8. Record Audit Log (Guardrail-07)
    await this.auditLogRepo.record({
      userId: user.id,
      action: sendResult.success
        ? "DUNNING_NOTIFICATION_SENT"
        : "DUNNING_NOTIFICATION_FAILED",
      entityType: "Subscription",
      entityId: subscription.id,
      newValues: {
        stage,
        channel,
        recipientEmail: user.email,
        success: sendResult.success,
        error: sendResult.error,
        gatewayInvoiceId,
        dunningLogId: savedLog.id,
      },
      traceId: activeTraceId,
    });

    if (sendResult.success) {
      this.logger.log(
        `Dispatched dunning notification [${stage}] to <${user.email}> for subscription [${subscription.id}].`,
      );
    } else {
      this.logger.warn(
        `Failed to dispatch dunning notification [${stage}] to <${user.email}>: ${sendResult.error}`,
      );
    }

    return savedLog.toDto();
  }

  public async getDunningLogs(
    query: QueryDunningLogsDto,
  ): Promise<{ items: SubscriptionDunningLogDto[]; total: number }> {
    const { items, total } = await this.dunningLogRepo.findMany(query);
    return {
      items: items.map((i) => i.toDto()),
      total,
    };
  }
}
