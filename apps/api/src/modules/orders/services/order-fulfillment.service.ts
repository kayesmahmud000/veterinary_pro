import { Inject, Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import * as crypto from "crypto";
import {
  DownloadTokenItemDto,
  OrderDownloadTokensResponseDto,
  OrderStatus,
  SecureDownloadResponseDto,
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
  IS3StorageService,
  S3_STORAGE_SERVICE,
} from "../../media/services/s3-storage.service.interface";
import {
  IMailQueueService,
  MAIL_QUEUE_SERVICE,
} from "../../mail/interfaces/mail-service.interface";
import { EnvService } from "../../../config/env.service";
import {
  DownloadTokenValidationResult,
  IOrderFulfillmentService,
} from "./order-fulfillment.service.interface";
import { Optional } from "@nestjs/common";

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
    private readonly auditLogRepository: IAuditLogRepository,
    @Inject(S3_STORAGE_SERVICE)
    private readonly s3Storage: IS3StorageService,
    private readonly envService: EnvService,
    @Optional()
    @Inject(MAIL_QUEUE_SERVICE)
    private readonly mailQueueService?: IMailQueueService
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

    const fulfilledOrder = tx
      ? await runInTransaction(tx)
      : await this.transactionManager.run((activeTx) =>
          runInTransaction(activeTx)
        );

    // Asynchronously dispatch delivery email if mail queue service is configured
    if (this.mailQueueService) {
      try {
        const userInfo = await this.orderRepository.findOrderUser(fulfilledOrder.userId);
        if (userInfo?.email) {
          await this.mailQueueService.enqueueOrderDeliveryEmail(
            orderId,
            userInfo.email,
            userInfo.name,
            traceId
          );
        }
      } catch (err: unknown) {
        this.logger.warn(
          `Failed to enqueue delivery email for fulfilled order [${orderId}]: ${(err as Error).message}`
        );
      }
    }

    return fulfilledOrder;
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

  public async getSecureDownloadUrl(
    orderId: string,
    downloadToken: string,
    userId: string,
    userRole: string,
    traceId?: string,
    ipAddress?: string
  ): Promise<SecureDownloadResponseDto> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new EntityNotFoundException("Order", orderId);
    }

    const isAdmin =
      userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN;
    if (!isAdmin && order.userId !== userId) {
      throw new ForbiddenOperationException(
        "You are not authorized to download assets from this order."
      );
    }

    if (order.status !== OrderStatus.COMPLETED) {
      throw new ValidationDomainException(
        `Cannot download assets: order is in '${order.status}' status, not settled.`
      );
    }

    const validation = await this.validateDownloadToken(downloadToken);
    if (!validation.isValid || !validation.itemId) {
      throw new ValidationDomainException(
        validation.reason ?? "Invalid download token."
      );
    }

    if (validation.orderId !== orderId) {
      throw new ValidationDomainException(
        "Provided download token does not belong to this order."
      );
    }

    // Determine target S3 bucket and object key
    const deliveriesBucket = this.envService.s3BucketDeliveries;
    const mediaBucket = this.envService.s3BucketMedia;

    const watermarkedKey = `watermarked/${orderId}/${validation.itemId}.pdf`;
    const targetBucket =
      validation.productType === "EBOOK" ? deliveriesBucket : mediaBucket;
    const targetKey =
      validation.productType === "EBOOK"
        ? watermarkedKey
        : validation.contentS3Key || watermarkedKey;

    const expiresInSeconds = 900; // 15 minutes
    const downloadUrl = await this.s3Storage.getPresignedGetUrl(
      targetBucket,
      targetKey,
      expiresInSeconds
    );

    // Atomically increment download counter
    const updatedItem = await this.orderRepository.incrementDownloadCount(
      validation.itemId
    );

    // Record audit log
    await this.auditLogRepository.record({
      userId,
      action: "ORDER_ITEM_DOWNLOADED",
      entityType: "order_items",
      entityId: validation.itemId,
      oldValues: {
        downloadCount: validation.downloadCount,
      },
      newValues: {
        downloadCount: updatedItem.downloadCount,
        lastDownloadedAt: updatedItem.lastDownloadedAt,
        targetKey,
      },
      traceId: traceId || crypto.randomUUID(),
      ipAddress,
    });

    this.logger.log(
      `Issued secure download URL for order [${orderId}], item [${validation.itemId}] -> User [${userId}] (Attempt ${updatedItem.downloadCount}/${MAX_DOWNLOADS_PER_ITEM})`
    );

    const remainingDownloads = Math.max(
      0,
      MAX_DOWNLOADS_PER_ITEM - updatedItem.downloadCount
    );

    return {
      orderId,
      itemId: validation.itemId,
      productId: validation.productId ?? "",
      productTitle: validation.productTitle ?? "",
      productType: validation.productType ?? "",
      downloadUrl,
      expiresInSeconds,
      downloadCount: updatedItem.downloadCount,
      maxDownloads: MAX_DOWNLOADS_PER_ITEM,
      remainingDownloads,
      lastDownloadedAt: updatedItem.lastDownloadedAt
        ? updatedItem.lastDownloadedAt.toISOString()
        : new Date().toISOString(),
    };
  }

  public async resendOrderDeliveryEmail(
    orderId: string,
    userId: string,
    userRole: string,
    traceId?: string
  ): Promise<{ enqueued: boolean; orderId: string }> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new EntityNotFoundException("Order", orderId);
    }

    const isAdmin =
      userRole === UserRole.ADMIN || userRole === UserRole.SUPER_ADMIN;
    if (!isAdmin && order.userId !== userId) {
      throw new ForbiddenOperationException(
        "You are not authorized to resend delivery emails for this order."
      );
    }

    if (order.status !== OrderStatus.COMPLETED) {
      throw new ValidationDomainException(
        `Cannot resend email: order is in '${order.status}' status, not completed.`
      );
    }

    if (!this.mailQueueService) {
      throw new ValidationDomainException(
        "Mail queue service is currently unavailable."
      );
    }

    const userInfo = await this.orderRepository.findOrderUser(order.userId);
    if (!userInfo?.email) {
      throw new ValidationDomainException(
        "No email address found for the user associated with this order."
      );
    }

    await this.mailQueueService.enqueueOrderDeliveryEmail(
      orderId,
      userInfo.email,
      userInfo.name,
      traceId
    );

    this.logger.log(
      `Re-enqueued delivery email for order [${orderId}] -> <${userInfo.email}>`
    );

    return { enqueued: true, orderId };
  }
}
