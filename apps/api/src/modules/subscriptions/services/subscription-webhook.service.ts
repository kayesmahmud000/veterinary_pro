import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  Optional,
} from "@nestjs/common";
import {
  DunningStage,
  SubscriptionStatus,
  SubscriptionWebhookResultDto,
} from "@vetralink/shared-types";
import Stripe from "stripe";
import {
  IDEMPOTENCY_SERVICE,
  IIdempotencyService,
} from "../../../common/idempotency";
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
  ISubscriptionDunningQueueService,
  SUBSCRIPTION_DUNNING_QUEUE_SERVICE,
} from "./subscription-dunning-queue.service.interface";
import { ISubscriptionWebhookService } from "./subscription-webhook.service.interface";

@Injectable()
export class SubscriptionWebhookService implements ISubscriptionWebhookService {
  private readonly logger = new Logger(SubscriptionWebhookService.name);
  private readonly stripeClient: Stripe | null = null;

  constructor(
    private readonly envService: EnvService,
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subRepo: ISubscriptionRepository,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepo: IAuditLogRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly txManager: ITransactionManager,
    @Optional()
    @Inject(IDEMPOTENCY_SERVICE)
    private readonly idempotencyService?: IIdempotencyService,
    @Optional()
    @Inject(SUBSCRIPTION_DUNNING_QUEUE_SERVICE)
    private readonly dunningQueueService?: ISubscriptionDunningQueueService,
  ) {
    const apiKey = this.envService.stripeSecretKey;
    if (apiKey) {
      this.stripeClient = new Stripe(apiKey, {
        typescript: true,
      });
      this.logger.log("Stripe Subscription Webhook client initialized.");
    } else {
      this.logger.warn(
        "STRIPE_SECRET_KEY is not configured. Webhooks will operate in permissive mock mode.",
      );
    }
  }

  public async processWebhook(
    rawBody: Buffer,
    signature: string,
    traceId?: string,
  ): Promise<SubscriptionWebhookResultDto> {
    const event = this.constructEvent(rawBody, signature);
    const activeTraceId = traceId ?? crypto.randomUUID();

    const dispatch = async (): Promise<SubscriptionWebhookResultDto> => {
      this.logger.log(
        `Received Stripe subscription webhook event: ${event.type} [ID: ${event.id}]`,
      );

      switch (event.type) {
        case "invoice.payment_failed":
          return this.handleInvoicePaymentFailed(event, activeTraceId);

        case "invoice.payment_succeeded":
          return this.handleInvoicePaymentSucceeded(event, activeTraceId);

        case "customer.subscription.deleted":
          return this.handleCustomerSubscriptionDeleted(event, activeTraceId);

        default:
          this.logger.debug(
            `Ignored Stripe event type: ${event.type} [ID: ${event.id}]`,
          );
          return {
            received: true,
            eventId: event.id,
            eventType: event.type,
            status: "ignored",
            message: `Unhandled event type: ${event.type}`,
          };
      }
    };

    if (this.idempotencyService) {
      return this.idempotencyService.execute(
        `stripe:sub:event:${event.id}`,
        { eventId: event.id, eventType: event.type },
        86400,
        dispatch,
      );
    }

    return dispatch();
  }

  private constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.envService.stripeWebhookSecret;

    if (!this.stripeClient || !webhookSecret) {
      if (
        this.envService.nodeEnv === "development" ||
        this.envService.nodeEnv === "test"
      ) {
        try {
          return JSON.parse(rawBody.toString("utf-8")) as Stripe.Event;
        } catch {
          throw new BadRequestException("Invalid JSON payload in mock mode.");
        }
      }
      throw new BadRequestException(
        "Stripe webhook client or secret is not configured.",
      );
    }

    try {
      return this.stripeClient.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret,
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      this.logger.warn(`Stripe signature verification failed: ${msg}`);
      throw new BadRequestException(
        `Stripe signature verification failed: ${msg}`,
      );
    }
  }

  private async handleInvoicePaymentFailed(
    event: Stripe.Event,
    traceId: string,
  ): Promise<SubscriptionWebhookResultDto> {
    const invoice = event.data.object as Stripe.Invoice;
    const gatewaySubId = this.extractGatewaySubId(invoice);

    if (!gatewaySubId) {
      this.logger.warn(
        `Invoice ${invoice.id} in event ${event.id} has no subscription ID. Ignored.`,
      );
      return {
        received: true,
        eventId: event.id,
        eventType: event.type,
        status: "ignored",
        message: "Invoice is not tied to a subscription.",
      };
    }

    const subscription = await this.subRepo.findByGatewaySubId(gatewaySubId);
    if (!subscription) {
      this.logger.warn(
        `No local subscription found matching gatewaySubId '${gatewaySubId}' (Invoice: ${invoice.id}).`,
      );
      return {
        received: true,
        eventId: event.id,
        eventType: event.type,
        status: "ignored",
        message: `Subscription with gatewaySubId '${gatewaySubId}' not found.`,
      };
    }

    // Idempotency check: if already marked past due and already at terminal attempt
    if (subscription.isPastDue()) {
      this.logger.log(
        `Subscription '${subscription.id}' already marked PAST_DUE. Updating audit log attempt.`,
      );
    } else {
      subscription.markPastDue();
    }

    const nextPaymentAttempt = invoice.next_payment_attempt
      ? new Date(invoice.next_payment_attempt * 1000).toISOString()
      : null;

    await this.txManager.run(async (tx) => {
      await this.subRepo.save(subscription, tx);

      await this.auditLogRepo.record(
        {
          userId: subscription.userId,
          action: "SUBSCRIPTION_PAYMENT_FAILED",
          entityType: "Subscription",
          entityId: subscription.id,
          newValues: {
            status: SubscriptionStatus.PAST_DUE,
            gatewaySubId,
            invoiceId: invoice.id,
            attemptCount: invoice.attempt_count,
            nextPaymentAttempt,
            amountDue: invoice.amount_due,
            currency: invoice.currency,
            hostedInvoiceUrl: invoice.hosted_invoice_url,
            eventId: event.id,
          },
          traceId,
        },
        tx,
      );
    });

    this.logger.warn(
      `Subscription '${subscription.id}' marked PAST_DUE (Attempt: ${invoice.attempt_count}, Next: ${nextPaymentAttempt ?? "None"}).`,
    );

    // Enqueue immediate Stage 1 (Day 1) dunning notification
    if (this.dunningQueueService) {
      try {
        await this.dunningQueueService.dispatchStage({
          subscriptionId: subscription.id,
          stage: DunningStage.DAY_1,
          gatewayInvoiceId: invoice.id,
          traceId,
        });
      } catch (err) {
        this.logger.warn(
          `Failed to enqueue immediate DAY_1 dunning job for subscription [${subscription.id}]: ${
            (err as Error).message
          }`,
        );
      }
    }

    return {
      received: true,
      eventId: event.id,
      eventType: event.type,
      subscriptionId: subscription.id,
      status: "settled",
      message: `Subscription '${subscription.id}' marked PAST_DUE after renewal payment failure.`,
    };
  }

  private async handleInvoicePaymentSucceeded(
    event: Stripe.Event,
    traceId: string,
  ): Promise<SubscriptionWebhookResultDto> {
    const invoice = event.data.object as Stripe.Invoice;
    const gatewaySubId = this.extractGatewaySubId(invoice);

    if (!gatewaySubId) {
      return {
        received: true,
        eventId: event.id,
        eventType: event.type,
        status: "ignored",
        message: "Invoice has no subscription association.",
      };
    }

    const subscription = await this.subRepo.findByGatewaySubId(gatewaySubId);
    if (!subscription) {
      return {
        received: true,
        eventId: event.id,
        eventType: event.type,
        status: "ignored",
        message: `Subscription with gatewaySubId '${gatewaySubId}' not found.`,
      };
    }

    // Determine period end from invoice lines if present
    const firstLine = invoice.lines?.data?.[0];
    const newPeriodEnd = firstLine?.period?.end
      ? new Date(firstLine.period.end * 1000)
      : undefined;

    const validPeriodEnd =
      newPeriodEnd && newPeriodEnd.getTime() > Date.now()
        ? newPeriodEnd
        : undefined;

    subscription.activate({
      periodEnd: validPeriodEnd,
      gatewaySubId,
    });

    await this.txManager.run(async (tx) => {
      await this.subRepo.save(subscription, tx);

      await this.auditLogRepo.record(
        {
          userId: subscription.userId,
          action: "SUBSCRIPTION_PAYMENT_SUCCEEDED",
          entityType: "Subscription",
          entityId: subscription.id,
          newValues: {
            status: SubscriptionStatus.ACTIVE,
            gatewaySubId,
            invoiceId: invoice.id,
            amountPaid: invoice.amount_paid,
            currency: invoice.currency,
            newPeriodEnd: newPeriodEnd?.toISOString(),
            eventId: event.id,
          },
          traceId,
        },
        tx,
      );
    });

    this.logger.log(
      `Subscription '${subscription.id}' renewed/activated to ACTIVE via invoice ${invoice.id}.`,
    );

    return {
      received: true,
      eventId: event.id,
      eventType: event.type,
      subscriptionId: subscription.id,
      status: "settled",
      message: `Subscription '${subscription.id}' renewed and marked ACTIVE.`,
    };
  }

  private async handleCustomerSubscriptionDeleted(
    event: Stripe.Event,
    traceId: string,
  ): Promise<SubscriptionWebhookResultDto> {
    const stripeSub = event.data.object as Stripe.Subscription;
    const gatewaySubId = stripeSub.id;

    const subscription = await this.subRepo.findByGatewaySubId(gatewaySubId);
    if (!subscription) {
      return {
        received: true,
        eventId: event.id,
        eventType: event.type,
        status: "ignored",
        message: `Subscription with gatewaySubId '${gatewaySubId}' not found.`,
      };
    }

    subscription.requestCancellation({ immediate: true });

    await this.txManager.run(async (tx) => {
      await this.subRepo.save(subscription, tx);

      await this.auditLogRepo.record(
        {
          userId: subscription.userId,
          action: "SUBSCRIPTION_CANCELED_BY_STRIPE",
          entityType: "Subscription",
          entityId: subscription.id,
          newValues: {
            status: SubscriptionStatus.CANCELED,
            gatewaySubId,
            eventId: event.id,
          },
          traceId,
        },
        tx,
      );
    });

    this.logger.log(
      `Subscription '${subscription.id}' canceled from Stripe event ${event.id}.`,
    );

    return {
      received: true,
      eventId: event.id,
      eventType: event.type,
      subscriptionId: subscription.id,
      status: "settled",
      message: `Subscription '${subscription.id}' marked CANCELED.`,
    };
  }

  private extractGatewaySubId(invoice: Stripe.Invoice): string | null {
    const rawInvoice = invoice as unknown as Record<string, unknown>;

    // 1. Check root subscription property (webhook payload representation)
    const directSub = rawInvoice["subscription"];
    if (typeof directSub === "string") {
      return directSub;
    }
    if (directSub && typeof directSub === "object") {
      const subObj = directSub as { id?: unknown };
      if (typeof subObj.id === "string") {
        return subObj.id;
      }
    }

    // 2. Check Stripe v22 parent.subscription_details
    const parent = rawInvoice["parent"];
    if (parent && typeof parent === "object") {
      const parentObj = parent as {
        subscription_details?: { subscription?: unknown };
      };
      const subDetails = parentObj.subscription_details?.subscription;
      if (typeof subDetails === "string") {
        return subDetails;
      }
      if (subDetails && typeof subDetails === "object") {
        const nestedSubObj = subDetails as { id?: unknown };
        if (typeof nestedSubObj.id === "string") {
          return nestedSubObj.id;
        }
      }
    }

    // 3. Check first line item's subscription reference
    const firstLine = invoice.lines?.data?.[0] as unknown as
      | Record<string, unknown>
      | undefined;
    if (firstLine) {
      const lineSub = firstLine["subscription"];
      if (typeof lineSub === "string") {
        return lineSub;
      }
      if (lineSub && typeof lineSub === "object") {
        const lineSubObj = lineSub as { id?: unknown };
        if (typeof lineSubObj.id === "string") {
          return lineSubObj.id;
        }
      }
    }

    return null;
  }
}
