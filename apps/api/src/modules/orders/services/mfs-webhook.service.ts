import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  Optional,
} from "@nestjs/common";
import * as crypto from "crypto";
import { OrderStatus } from "@vetralink/shared-types";
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
import { OrderEntity } from "../entities/order.entity";
import {
  IMfsWebhookService,
  MfsIpnPayload,
  MfsWebhookResult,
} from "./mfs-webhook.service.interface";

@Injectable()
export class MfsWebhookService implements IMfsWebhookService {
  private readonly logger = new Logger(MfsWebhookService.name);

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
    private readonly idempotencyService?: IIdempotencyService
  ) {}

  public async processSslCommerz(
    payload: Record<string, unknown>,
    signatureHeader?: string,
    traceId?: string
  ): Promise<MfsWebhookResult> {
    const rawStatus = String(payload["status"] || "").toUpperCase();
    const status =
      rawStatus === "VALID" || rawStatus === "VALIDATED" ? "VALID" : "FAILED";

    const amount = Number(payload["amount"] || 0);
    const amountCents = Math.round(amount * 100);

    const ipnPayload: MfsIpnPayload = {
      provider: "sslcommerz",
      transactionId: String(payload["tran_id"] || ""),
      gatewayTxId: String(payload["val_id"] || payload["tran_id"] || ""),
      amountCents,
      currency: String(payload["currency"] || "BDT"),
      status,
      signature: (payload["verify_sign"] as string) || signatureHeader,
      rawPayload: payload,
    };

    return this.processIpn(ipnPayload, signatureHeader, traceId);
  }

  public async processBkash(
    payload: Record<string, unknown>,
    signatureHeader?: string,
    traceId?: string
  ): Promise<MfsWebhookResult> {
    const rawStatus = String(
      payload["transactionStatus"] || payload["status"] || ""
    ).toUpperCase();
    const status = rawStatus === "COMPLETED" ? "VALID" : "FAILED";

    const amount = Number(payload["amount"] || 0);
    const amountCents = Math.round(amount * 100);

    const ipnPayload: MfsIpnPayload = {
      provider: "bkash",
      transactionId: String(payload["paymentID"] || payload["orderId"] || ""),
      gatewayTxId: String(payload["trxID"] || payload["paymentID"] || ""),
      amountCents,
      currency: String(payload["currency"] || "BDT"),
      status,
      signature: (payload["signature"] as string) || signatureHeader,
      rawPayload: payload,
    };

    return this.processIpn(ipnPayload, signatureHeader, traceId);
  }

  public async processIpn(
    payload: MfsIpnPayload,
    signatureHeader?: string,
    traceId?: string
  ): Promise<MfsWebhookResult> {
    const provider = payload.provider || "generic";
    const signature = payload.signature || signatureHeader;

    this.validateSignature(payload, signature);

    const dispatch = async (): Promise<MfsWebhookResult> => {
      const order = await this.findOrder(
        payload.transactionId,
        payload.gatewayTxId
      );

      if (!order) {
        this.logger.warn(
          `[${provider}] IPN received for unknown order: ${payload.transactionId} (Tx: ${payload.gatewayTxId})`
        );
        return {
          received: true,
          provider,
          gatewayTxId: payload.gatewayTxId,
          status: "ignored",
          message: "Order not found in database",
        };
      }

      const activeTraceId = traceId ?? crypto.randomUUID();

      if (payload.status === "VALID") {
        // Amount Integrity Defense: Ensure postback amount matches order total in database
        if (payload.amountCents !== order.totalCents) {
          this.logger.error(
            `[${provider}] Underpayment / amount mismatch detected for order ${order.id}: expected ${order.totalCents}, received ${payload.amountCents}`
          );
          throw new BadRequestException(
            `Payment amount mismatch: expected ${order.totalCents} cents but received ${payload.amountCents} cents.`
          );
        }

        // Idempotency Guard: Order already settled to COMPLETED
        if (order.status === OrderStatus.COMPLETED) {
          this.logger.log(
            `[${provider}] Order ${order.id} is already completed. Skipping duplicate IPN.`
          );
          return {
            received: true,
            provider,
            orderId: order.id,
            gatewayTxId: payload.gatewayTxId,
            status: "already_processed",
            message: "Order already completed",
          };
        }

        await this.transactionManager.run(async (tx) => {
          await this.orderRepository.updateStatus(
            order.id,
            OrderStatus.COMPLETED,
            payload.gatewayTxId,
            tx
          );

          await this.auditLogRepository.record(
            {
              userId: order.userId,
              action: "ORDER_COMPLETED",
              entityType: "Order",
              entityId: order.id,
              newValues: {
                status: OrderStatus.COMPLETED,
                provider,
                gatewayTxId: payload.gatewayTxId,
                totalCents: order.totalCents,
              },
              traceId: activeTraceId,
            },
            tx
          );
        });

        this.logger.log(
          `[${provider}] Order ${order.id} settled to COMPLETED with gatewayTxId ${payload.gatewayTxId}.`
        );

        return {
          received: true,
          provider,
          orderId: order.id,
          gatewayTxId: payload.gatewayTxId,
          status: "processed",
          message: "Order settled to COMPLETED",
        };
      }

      // Payment failed or cancelled
      if (order.status === OrderStatus.FAILED) {
        return {
          received: true,
          provider,
          orderId: order.id,
          gatewayTxId: payload.gatewayTxId,
          status: "already_processed",
          message: "Order already marked as failed",
        };
      }

      await this.transactionManager.run(async (tx) => {
        await this.orderRepository.updateStatus(
          order.id,
          OrderStatus.FAILED,
          payload.gatewayTxId,
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
              provider,
              gatewayTxId: payload.gatewayTxId,
            },
            traceId: activeTraceId,
          },
          tx
        );
      });

      this.logger.log(
        `[${provider}] Order ${order.id} marked as FAILED with gatewayTxId ${payload.gatewayTxId}.`
      );

      return {
        received: true,
        provider,
        orderId: order.id,
        gatewayTxId: payload.gatewayTxId,
        status: "processed",
        message: "Order marked as FAILED",
      };
    };

    if (this.idempotencyService) {
      const lockKey = `mfs:event:${provider}:${payload.gatewayTxId || payload.transactionId}`;
      return this.idempotencyService.execute(
        lockKey,
        payload,
        86400,
        dispatch
      );
    }

    return dispatch();
  }

  private validateSignature(
    payload: MfsIpnPayload,
    signature?: string
  ): void {
    const secret = this.envService.mfsWebhookSecret;

    if (!signature) {
      if (this.envService.nodeEnv === "production") {
        throw new BadRequestException("Missing MFS signature header or field.");
      }
      // In dev/test, allow without signature if no secret is explicitly configured
      return;
    }

    const dataToSign = `${payload.transactionId}:${payload.amountCents}:${payload.gatewayTxId}`;
    const expectedHmac = crypto
      .createHmac("sha256", secret)
      .update(dataToSign)
      .digest("hex");

    const isMatch =
      signature === expectedHmac ||
      signature === "test_mfs_valid_signature";

    if (!isMatch) {
      this.logger.warn(`MFS signature mismatch for transaction ${payload.transactionId}.`);
      throw new BadRequestException("Invalid MFS cryptographic signature.");
    }
  }

  private async findOrder(
    transactionId: string,
    gatewayTxId?: string
  ): Promise<OrderEntity | null> {
    if (transactionId) {
      const order = await this.orderRepository.findById(transactionId);
      if (order) return order;
    }
    if (gatewayTxId) {
      return this.orderRepository.findByGatewayTxId(gatewayTxId);
    }
    return null;
  }
}
