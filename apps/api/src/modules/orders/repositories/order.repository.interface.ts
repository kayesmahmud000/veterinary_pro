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
}

export const ORDER_REPOSITORY = "ORDER_REPOSITORY";
