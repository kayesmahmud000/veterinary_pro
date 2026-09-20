import {
  Inject,
  Injectable,
  Logger,
  Optional,
} from "@nestjs/common";
import {
  SubscriptionAccessMode,
  SubscriptionAccessStatusDto,
  SubscriptionStatus,
  SubscriptionSuspensionDetailDto,
  SubscriptionSuspensionResultDto,
} from "@vetralink/shared-types";
import {
  SubscriptionReadOnlyException,
  SubscriptionSuspendedException,
} from "../../../common/exceptions/domain.exception";
import { EnvService } from "../../../config/env.service";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../../audit/repositories/audit-log.repository.interface";
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from "../../prisma/interfaces/transaction.interface";
import {
  ISubscriptionRepository,
  SUBSCRIPTION_REPOSITORY,
} from "../repositories/subscription.repository.interface";
import {
  IStripePortalService,
  STRIPE_PORTAL_SERVICE,
} from "./stripe-portal.service.interface";
import { ISubscriptionGracePeriodService } from "./subscription-grace-period.service.interface";

@Injectable()
export class SubscriptionGracePeriodService
  implements ISubscriptionGracePeriodService
{
  private readonly logger = new Logger(SubscriptionGracePeriodService.name);

  constructor(
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subRepo: ISubscriptionRepository,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepo: IAuditLogRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly txManager: ITransactionManager,
    private readonly envService: EnvService,
    @Optional()
    @Inject(STRIPE_PORTAL_SERVICE)
    private readonly stripePortalService?: IStripePortalService,
  ) {}

  public async getAccessStatus(
    farmId: string,
    now: Date = new Date(),
  ): Promise<SubscriptionAccessStatusDto> {
    const subscription = await this.subRepo.findByFarmId(farmId);

    const fallbackBaseUrl =
      this.envService.corsOrigins[0] ?? "https://vetralink.pro";
    let portalUrl = `${fallbackBaseUrl}/settings/billing`;

    if (!subscription) {
      return {
        subscriptionId: "",
        farmId,
        status: SubscriptionStatus.EXPIRED,
        accessMode: SubscriptionAccessMode.SUSPENDED,
        canRead: false,
        canWrite: false,
        daysPastDue: 0,
        gracePeriodDaysRemaining: 0,
        gracePeriodEnd: null,
        suspensionDate: null,
        portalUrl,
        message:
          "No active subscription found for this farm. Please choose a subscription plan to continue.",
      };
    }

    if (this.stripePortalService && subscription.userId) {
      try {
        const session =
          await this.stripePortalService.createCustomerPortalSession(
            subscription.userId,
          );
        portalUrl = session.url;
      } catch (err) {
        this.logger.warn(
          `Could not generate Stripe Customer Portal URL for user [${subscription.userId}]: ${
            (err as Error).message
          }`,
        );
      }
    }

    const accessMode = subscription.getAccessMode(now);
    const canWrite = subscription.canWrite(now);
    const canRead = subscription.canRead(now);
    const daysPastDue = subscription.daysPastDue(now);
    const gracePeriodDaysRemaining = Math.max(0, 3 - daysPastDue);

    const gracePeriodEnd = new Date(
      subscription.currentPeriodEnd.getTime() + 3 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const suspensionDate = new Date(
      subscription.currentPeriodEnd.getTime() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();

    let message: string;
    switch (accessMode) {
      case SubscriptionAccessMode.FULL_ACCESS:
        message = "Subscription is active. Full read/write access granted.";
        break;
      case SubscriptionAccessMode.GRACE_PERIOD:
        message = `Payment failed. 3-day grace period is active (${gracePeriodDaysRemaining} day(s) remaining). Full access granted. Please update payment method to avoid read-only restriction.`;
        break;
      case SubscriptionAccessMode.READ_ONLY:
        message = `Your 3-day grace period has expired. Account is in read-only mode (${daysPastDue} days past due). All write operations (creating animals, milk logs, health records) are restricted until payment is settled.`;
        break;
      case SubscriptionAccessMode.SUSPENDED:
      default:
        message = `Your subscription has been suspended due to ${daysPastDue} days of overdue payment. Please settle your outstanding balance on the billing portal to restore access.`;
        break;
    }

    return {
      subscriptionId: subscription.id,
      farmId: subscription.farmId,
      status: subscription.status,
      accessMode,
      canRead,
      canWrite,
      daysPastDue,
      gracePeriodDaysRemaining,
      gracePeriodEnd,
      suspensionDate,
      portalUrl,
      message,
    };
  }

  public async assertWriteAccess(
    farmId: string,
    now: Date = new Date(),
  ): Promise<void> {
    const status = await this.getAccessStatus(farmId, now);

    if (status.accessMode === SubscriptionAccessMode.READ_ONLY) {
      throw new SubscriptionReadOnlyException(status.message, {
        subscriptionId: status.subscriptionId,
        accessMode: status.accessMode,
        daysPastDue: status.daysPastDue,
        gracePeriodExpiredAt: status.gracePeriodEnd ?? undefined,
        portalUrl: status.portalUrl,
      });
    }

    if (status.accessMode === SubscriptionAccessMode.SUSPENDED) {
      throw new SubscriptionSuspendedException(status.message, {
        subscriptionId: status.subscriptionId,
        accessMode: status.accessMode,
        daysPastDue: status.daysPastDue,
        suspendedAt: status.suspensionDate ?? undefined,
        portalUrl: status.portalUrl,
      });
    }
  }

  public async assertReadAccess(
    farmId: string,
    now: Date = new Date(),
  ): Promise<void> {
    const status = await this.getAccessStatus(farmId, now);

    if (status.accessMode === SubscriptionAccessMode.SUSPENDED) {
      throw new SubscriptionSuspendedException(status.message, {
        subscriptionId: status.subscriptionId,
        accessMode: status.accessMode,
        daysPastDue: status.daysPastDue,
        suspendedAt: status.suspensionDate ?? undefined,
        portalUrl: status.portalUrl,
      });
    }
  }

  public async processSuspensions(
    asOfDate: Date = new Date(),
    traceId?: string,
  ): Promise<SubscriptionSuspensionResultDto> {
    const activeTraceId = traceId ?? crypto.randomUUID();
    const pastDueSubscriptions = await this.subRepo.findPastDueSubscriptions();

    const details: SubscriptionSuspensionDetailDto[] = [];
    let scannedCount = 0;
    let suspendedCount = 0;

    for (const sub of pastDueSubscriptions) {
      scannedCount++;
      const days = sub.daysPastDue(asOfDate);

      // Past Day 7 cutoff -> suspend and transition to EXPIRED
      if (days > 7) {
        sub.suspend(asOfDate);

        await this.txManager.run(async (tx) => {
          await this.subRepo.save(sub, tx);

          await this.auditLogRepo.record(
            {
              userId: sub.userId,
              action: "SUBSCRIPTION_SUSPENDED_DUE_TO_DUNNING",
              entityType: "Subscription",
              entityId: sub.id,
              newValues: {
                status: SubscriptionStatus.EXPIRED,
                daysPastDue: days,
                previousStatus: SubscriptionStatus.PAST_DUE,
              },
              traceId: activeTraceId,
            },
            tx,
          );
        });

        suspendedCount++;
        details.push({
          subscriptionId: sub.id,
          userId: sub.userId,
          farmId: sub.farmId,
          status: sub.status,
          daysPastDue: days,
          message: `Subscription suspended and marked EXPIRED (${days} days past due).`,
        });

        this.logger.warn(
          `Subscription [${sub.id}] for farm [${sub.farmId}] suspended due to ${days} days past-due non-payment.`,
        );
      }
    }

    this.logger.log(
      `Suspension sweep completed: Scanned=${scannedCount}, Suspended=${suspendedCount}`,
    );

    return {
      scannedCount,
      suspendedCount,
      details,
    };
  }
}
