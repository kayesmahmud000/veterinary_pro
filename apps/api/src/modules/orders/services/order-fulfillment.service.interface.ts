import { Prisma } from "@prisma/client";
import {
  OrderDownloadTokensResponseDto,
  SecureDownloadResponseDto,
} from "@vetralink/shared-types";
import { OrderEntity } from "../entities/order.entity";

export interface DownloadTokenValidationResult {
  readonly isValid: boolean;
  readonly reason?: string;
  readonly orderId?: string;
  readonly itemId?: string;
  readonly productId?: string;
  readonly productTitle?: string;
  readonly productType?: string;
  readonly contentS3Key?: string;
  readonly downloadCount?: number;
  readonly maxDownloads?: number;
}

export interface IOrderFulfillmentService {
  fulfillOrder(
    orderId: string,
    gatewayTxId?: string,
    tx?: Prisma.TransactionClient,
    traceId?: string
  ): Promise<OrderEntity>;

  getOrderDownloadTokens(
    orderId: string,
    userId: string,
    userRole: string
  ): Promise<OrderDownloadTokensResponseDto>;

  validateDownloadToken(
    downloadToken: string
  ): Promise<DownloadTokenValidationResult>;

  recordDownload(
    downloadToken: string,
    tx?: Prisma.TransactionClient
  ): Promise<void>;

  getSecureDownloadUrl(
    orderId: string,
    downloadToken: string,
    userId: string,
    userRole: string,
    traceId?: string,
    ipAddress?: string
  ): Promise<SecureDownloadResponseDto>;

  resendOrderDeliveryEmail(
    orderId: string,
    userId: string,
    userRole: string,
    traceId?: string
  ): Promise<{ enqueued: boolean; orderId: string }>;
}

export const ORDER_FULFILLMENT_SERVICE = "ORDER_FULFILLMENT_SERVICE";
