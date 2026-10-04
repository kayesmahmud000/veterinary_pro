import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  Optional,
} from "@nestjs/common";
import * as crypto from "crypto";
import Stripe from "stripe";
import { OrderStatus } from "@vetralink/shared-types";
import { OrderEntity } from "../entities/order.entity";
import { EnvService } from "../../../config/env.service";
import {
  IOrderRepository,
  ORDER_REPOSITORY,
} from "../repositories/order.repository.interface";
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from "../../prisma/interfaces/transaction.interface";
import {
  IAuditLogRepository,
  AUDIT_LOG_REPOSITORY,
} from "../../audit/repositories/audit-log.repository.interface";
import {
  IDEMPOTENCY_SERVICE,
  IIdempotencyService,
} from "../../../common/idempotency";
import {
  IStripeWebhookService,
  WebhookProcessingResult,
} from "./stripe-webhook.service.interface";
import {
  ORDER_FULFILLMENT_SERVICE,
  IOrderFulfillmentService,
} from "./order-fulfillment.service.interface";

@Injectable()
export class StripeWebhookService implements IStripeWebhookService {
  private readonly logger = new Logger(StripeWebhookService.name);
  private readonly stripeClient: Stripe | null = null;

  constructor(
    private readonly envService: EnvService,
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: IOrderRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactionManager: ITransactionManager,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: IAuditLogRepository,
    @Optional()
    @Inject(IDEMPOTENCY_SERVICE)
    private readonly idempotencyService?: IIdempotencyService,
    @Optional()
    @Inject(ORDER_FULFILLMENT_SERVICE)
    private readonly fulfillmentService?: IOrderFulfillmentService
  ) {
    const apiKey = this.envService.stripeSecretKey;
    if (apiKey) {
      this.stripeClient = new Stripe(apiKey, {
        typescript: true,
      });
    }
  }

  public async processWebhook(
    rawBody: Buffer,
    signature: string,
    traceId?: string
  ): Promise<WebhookProcessingResult> {
    const event = this.constructEvent(rawBody, signature);
    const activeTraceId = traceId ?? crypto.randomUUID();

    const dispatch = async (): Promise<WebhookProcessingResult> => {
      this.logger.log(
        `Received Stripe webhook event: ${event.type} [ID: ${event.id}]`
      );

      switch (event.type) {
        case "payment_intent.succeeded":
          return this.handlePaymentIntentSucceeded(event, activeTraceId);

        case "payment_intent.payment_failed":
          return this.handlePaymentIntentFailed(event, activeTraceId);

        case "charge.refunded":
          return this.handleChargeRefunded(event, activeTraceId);

        default:
          this.logger.debug(
            `Unhandled Stripe event type: ${event.type} [ID: ${event.id}]`
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
        `stripe:event:${event.id}`,
        { eventId: event.id, eventType: event.type },
        86400,
        dispatch
      );
    }

    return dispatch();
  }

  private constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    const webhookSecret = this.envService.stripeWebhookSecret;

    if (!this.stripeClient || !webhookSecret) {
      if (this.envService.nodeEnv === "production") {
        throw new BadRequestException(
          "Stripe webhook client or secret is not configured in production."
        );
      }
      try {
        return JSON.parse(rawBody.toString("utf-8")) as Stripe.Event;
      } catch {
        throw new BadRequestException("Invalid webhook payload format.");
      }
    }

    try {
      return this.stripeClient.webhooks.constructEvent(
        rawBody,
        signature,
        webhookSecret
      );
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Signature verification failed";
      this.logger.warn(`Stripe signature verification failed: ${msg}`);
      throw new BadRequestException(
        `Stripe signature verification failed: ${msg}`
      );
    }
  }

  private async handlePaymentIntentSucceeded(
    event: Stripe.Event,
    traceId: string
  ): Promise<WebhookProcessingResult> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const gatewayTxId = paymentIntent.id;
    const orderId = paymentIntent.metadata?.["orderId"];

    const order = await this.findOrder(orderId, gatewayTxId);
    if (!order) {
      this.logger.warn(
        `Stripe event ${event.id} received for unknown order. (Tx: ${gatewayTxId})`
      );
      return {
        received: true,
        eventId: event.id,
        eventType: event.type,
        status: "ignored",
        message: "Order not found in database",
      };
    }

    // Idempotency check: if order is already completed, do not re-process
    if (order.status === OrderStatus.COMPLETED) {
      this.logger.log(
        `Order ${order.id} is already completed. Skipping duplicate event ${event.id}.`
      );
      return {
        received: true,
        eventId: event.id,
        eventType: event.type,
        orderId: order.id,
        status: "already_processed",
        message: "Order already completed",
      };
    }

    await this.transactionManager.run(async (tx) => {
      if (this.fulfillmentService) {
        await this.fulfillmentService.fulfillOrder(
          order.id,
          gatewayTxId,
          tx,
          traceId
        );
      } else {
        await this.orderRepository.updateStatus(
          order.id,
          OrderStatus.COMPLETED,
          gatewayTxId,
          tx
        );
      }

      await this.auditLogRepository.record(
        {
          userId: order.userId,
          action: "ORDER_COMPLETED",
          entityType: "Order",
          entityId: order.id,
          newValues: {
            status: OrderStatus.COMPLETED,
            gatewayTxId,
            eventId: event.id,
            totalCents: order.totalCents,
          },
          traceId,
        },
        tx
      );
    });

    this.logger.log(
      `Order ${order.id} successfully settled to COMPLETED from Stripe event ${event.id}.`
    );

    return {
      received: true,
      eventId: event.id,
      eventType: event.type,
      orderId: order.id,
      status: "processed",
      message: "Order settled to COMPLETED",
    };
  }

  private async handlePaymentIntentFailed(
    event: Stripe.Event,
    traceId: string
  ): Promise<WebhookProcessingResult> {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const gatewayTxId = paymentIntent.id;
    const orderId = paymentIntent.metadata?.["orderId"];

    const order = await this.findOrder(orderId, gatewayTxId);
    if (!order) {
      this.logger.warn(
        `Stripe event ${event.id} received for unknown order. (Tx: ${gatewayTxId})`
      );
      return {
        received: true,
        eventId: event.id,
        eventType: event.type,
        status: "ignored",
        message: "Order not found in database",
      };
    }

    // Idempotency check
    if (order.status === OrderStatus.FAILED) {
      return {
        received: true,
        eventId: event.id,
        eventType: event.type,
        orderId: order.id,
        status: "already_processed",
        message: "Order already marked as failed",
      };
    }

    await this.transactionManager.run(async (tx) => {
      await this.orderRepository.updateStatus(
        order.id,
        OrderStatus.FAILED,
        gatewayTxId,
        tx
      );

      await this.auditLogRepository.record(
        {
          userId: order.userId,
          action: "ORDER_PAYMENT_FAILED",
          entityType: "Order",
          entityId: order.id,
          newValues: {
            status: OrderStatus.FAILED,
            gatewayTxId,
            eventId: event.id,
            lastPaymentError: paymentIntent.last_payment_error?.message,
          },
          traceId,
        },
        tx
      );
    });

    this.logger.log(
      `Order ${order.id} marked as FAILED from Stripe event ${event.id}.`
    );

    return {
      received: true,
      eventId: event.id,
      eventType: event.type,
      orderId: order.id,
      status: "processed",
      message: "Order marked as FAILED",
    };
  }

  private async handleChargeRefunded(
    event: Stripe.Event,
    traceId: string
  ): Promise<WebhookProcessingResult> {
    const charge = event.data.object as Stripe.Charge;
    const gatewayTxId =
      typeof charge.payment_intent === "string"
        ? charge.payment_intent
        : charge.payment_intent?.id;

    if (!gatewayTxId) {
      return {
        received: true,
        eventId: event.id,
        eventType: event.type,
        status: "ignored",
        message: "No associated payment_intent found on refunded charge",
      };
    }

    const order = await this.orderRepository.findByGatewayTxId(gatewayTxId);
    if (!order) {
      return {
        received: true,
        eventId: event.id,
        eventType: event.type,
        status: "ignored",
        message: "Order not found for refunded charge",
      };
    }

    if (order.status === OrderStatus.REFUNDED) {
      return {
        received: true,
        eventId: event.id,
        eventType: event.type,
        orderId: order.id,
        status: "already_processed",
        message: "Order already marked as refunded",
      };
    }

    await this.transactionManager.run(async (tx) => {
      await this.orderRepository.updateStatus(
        order.id,
        OrderStatus.REFUNDED,
        undefined,
        tx
      );

      await this.auditLogRepository.record(
        {
          userId: order.userId,
          action: "ORDER_REFUNDED",
          entityType: "Order",
          entityId: order.id,
          newValues: {
            status: OrderStatus.REFUNDED,
            gatewayTxId,
            eventId: event.id,
            amountRefunded: charge.amount_refunded,
          },
          traceId,
        },
        tx
      );
    });

    return {
      received: true,
      eventId: event.id,
      eventType: event.type,
      orderId: order.id,
      status: "processed",
      message: "Order marked as REFUNDED",
    };
  }

  private async findOrder(
    orderId?: string,
    gatewayTxId?: string
  ): Promise<OrderEntity | null> {
    if (orderId) {
      const order = await this.orderRepository.findById(orderId);
      if (order) return order;
    }
    if (gatewayTxId) {
      return this.orderRepository.findByGatewayTxId(gatewayTxId);
    }
    return null;
  }
}
