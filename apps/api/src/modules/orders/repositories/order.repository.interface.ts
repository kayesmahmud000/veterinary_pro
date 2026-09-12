import { Prisma } from "@prisma/client";
import { OrderStatus } from "@vetralink/shared-types";
import { OrderEntity } from "../entities/order.entity";
import { OrderItemEntity } from "../entities/order-item.entity";

export interface IOrderRepository {
  create(
    order: OrderEntity,
    items?: OrderItemEntity[],
    tx?: Prisma.TransactionClient
  ): Promise<OrderEntity>;

  findById(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<OrderEntity | null>;

  findByGatewayTxId(
    gatewayTxId: string,
    tx?: Prisma.TransactionClient
  ): Promise<OrderEntity | null>;

  findUserOrders(
    userId: string,
    skip?: number,
    take?: number,
    tx?: Prisma.TransactionClient
  ): Promise<{ orders: OrderEntity[]; total: number }>;

  updateStatus(
    id: string,
    status: OrderStatus,
    gatewayTxId?: string,
    tx?: Prisma.TransactionClient
  ): Promise<OrderEntity>;

  updateItemDownloadTokens(
    orderId: string,
    tokens: { itemId: string; downloadToken: string }[],
    tx?: Prisma.TransactionClient
  ): Promise<void>;

  findByDownloadToken(
    downloadToken: string,
    tx?: Prisma.TransactionClient
  ): Promise<{
    order: OrderEntity;
    item: OrderItemEntity;
    contentS3Key: string;
    productType: string;
  } | null>;

  incrementDownloadCount(
    itemId: string,
    tx?: Prisma.TransactionClient
  ): Promise<OrderItemEntity>;
}

export const ORDER_REPOSITORY = "ORDER_REPOSITORY";
