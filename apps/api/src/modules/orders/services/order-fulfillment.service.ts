import { Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import * as crypto from "crypto";
import {
  DownloadTokenItemDto,
  OrderDownloadTokensResponseDto,
  OrderStatus,
  UserRole,
} from "@vetralink/shared-types";
import {
  EntityNotFoundException,
  ForbiddenOperationException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import { OrderEntity } from "../entities/order.entity";
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
  DownloadTokenValidationResult,
  IOrderFulfillmentService,
} from "./order-fulfillment.service.interface";

export const MAX_DOWNLOADS_PER_ITEM = 5;

@Injectable()
export class OrderFulfillmentService implements IOrderFulfillmentService {
  private readonly logger = new Logger(OrderFulfillmentService.name);

  constructor(
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: IOrderRepository,
    @Inject(TRANSACTION_MANAGER)
    private readonly transactionManager: ITransactionManager,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: IAuditLogRepository
  ) {}

  public async fulfillOrder(
    orderId: string,
    gatewayTxId?: string,
    tx?: Prisma.TransactionClient,
    traceId?: string
  ): Promise<OrderEntity> {
    const runInTransaction = async (
      activeTx: Prisma.TransactionClient
    ): Promise<OrderEntity> => {
      const order = await this.orderRepository.findById(orderId, activeTx);
      if (!order) {
        throw new EntityNotFoundException("Order", orderId);
      }

      // Idempotency: if already COMPLETED, avoid regenerating existing tokens
      if (order.status === OrderStatus.COMPLETED) {
        this.logger.log(
          `Order ${orderId} is already COMPLETED. Skipping token re-issuance.`
        );
        return order;
      }

      // Generate cryptographically unique UUIDv4 tokens for each line item
      const tokens = order.items.map((item) => ({
        itemId: item.id,
        downloadToken: crypto.randomUUID(),
      }));

      // Update order status to COMPLETED
      await this.orderRepository.updateStatus(
        orderId,
        OrderStatus.COMPLETED,
        gatewayTxId,
        activeTx
      );

      // Persist newly generated download tokens
      await this.orderRepository.updateItemDownloadTokens(
        orderId,
        tokens,
        activeTx
      );

      // Record immutable audit log
      const activeTraceId = traceId ?? crypto.randomUUID();
      await this.auditLogRepository.record(
        {
          userId: order.userId,
          action: "ORDER_FULFILLED",
          entityType: "Order",
          entityId: orderId,
          newValues: {
            status: OrderStatus.COMPLETED,
            gatewayTxId,
            tokenCount: tokens.length,
          },
          traceId: activeTraceId,
        },
        activeTx
      );

      this.logger.log(
        `Order ${orderId} fulfilled successfully with ${tokens.length} download tokens generated.`
      );

      const updated = await this.orderRepository.findById(orderId, activeTx);
      return updated!;
    };

    if (tx) {
      return runInTransaction(tx);
    }

    return this.transactionManager.run((activeTx) =>
      runInTransaction(activeTx)
    );
  }

  public async getOrderDownloadTokens(
    orderId: string,
    userId: string,
    userRole: string
  ): Promise<OrderDownloadTokensResponseDto> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new EntityNotFoundException("Order", orderId);
    }

    if (order.userId !== userId && userRole !== UserRole.ADMIN) {
      this.logger.warn(
        `User ${userId} unauthorized to access download tokens for order ${orderId}`
      );
      throw new ForbiddenOperationException(
        "You are not authorized to view download tokens for this order."
      );
    }

    if (order.status !== OrderStatus.COMPLETED) {
      this.logger.warn(
        `Attempted to fetch tokens for uncompleted order ${orderId} [Status: ${order.status}]`
      );
      throw new ValidationDomainException(
        `Download tokens are only available for completed orders. Current status: ${order.status}`
      );
    }

    const items: DownloadTokenItemDto[] = order.items.map((item) => {
      const isDownloadable = item.downloadCount < MAX_DOWNLOADS_PER_ITEM;
      return {
        itemId: item.id,
        productId: item.productId,
        productTitle: item.productTitle,
        downloadToken: item.downloadToken,
        downloadCount: item.downloadCount,
        maxDownloads: MAX_DOWNLOADS_PER_ITEM,
        lastDownloadedAt: item.lastDownloadedAt
          ? item.lastDownloadedAt.toISOString()
          : null,
        isDownloadable,
      };
    });

    return {
      orderId: order.id,
      status: order.status,
      items,
      generatedAt: order.updatedAt.toISOString(),
    };
  }

  public async validateDownloadToken(
    downloadToken: string
  ): Promise<DownloadTokenValidationResult> {
    if (!downloadToken || downloadToken.trim() === "") {
      return { isValid: false, reason: "Download token is required." };
    }

    const record =
      await this.orderRepository.findByDownloadToken(downloadToken);
    if (!record) {
      return { isValid: false, reason: "Download token not found." };
    }

    if (record.order.status !== OrderStatus.COMPLETED) {
      return {
        isValid: false,
        reason: "Associated order is not completed.",
        orderId: record.order.id,
        itemId: record.item.id,
      };
    }

    if (record.item.downloadCount >= MAX_DOWNLOADS_PER_ITEM) {
      return {
        isValid: false,
        reason: "Maximum download limit reached for this item.",
        orderId: record.order.id,
        itemId: record.item.id,
        downloadCount: record.item.downloadCount,
        maxDownloads: MAX_DOWNLOADS_PER_ITEM,
      };
    }

    return {
      isValid: true,
      orderId: record.order.id,
      itemId: record.item.id,
      productId: record.item.productId,
      productTitle: record.item.productTitle,
      productType: record.productType,
      contentS3Key: record.contentS3Key,
      downloadCount: record.item.downloadCount,
      maxDownloads: MAX_DOWNLOADS_PER_ITEM,
    };
  }

  public async recordDownload(
    downloadToken: string,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const validation = await this.validateDownloadToken(downloadToken);
    if (!validation.isValid || !validation.itemId) {
      throw new ValidationDomainException(
        validation.reason ?? "Invalid download token."
      );
    }

    await this.orderRepository.incrementDownloadCount(validation.itemId, tx);
  }
}
