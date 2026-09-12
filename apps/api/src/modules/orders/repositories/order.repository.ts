import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { OrderStatus } from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { OrderEntity } from "../entities/order.entity";
import { OrderItemEntity } from "../entities/order-item.entity";
import { IOrderRepository } from "./order.repository.interface";
import {
  EntityConflictException,
  EntityNotFoundException,
} from "../../../common/exceptions/domain.exception";

type PrismaOrderWithItems = Prisma.OrderGetPayload<{
  include: {
    items: {
      include: {
        product: {
          select: { title: true };
        };
      };
    };
  };
}>;

@Injectable()
export class OrderRepository implements IOrderRepository {
  private readonly logger = new Logger(OrderRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  public async create(
    order: OrderEntity,
    items?: OrderItemEntity[],
    tx?: Prisma.TransactionClient
  ): Promise<OrderEntity> {
    const client = tx ?? this.prisma;
    const itemsToCreate = items && items.length > 0 ? items : order.items;

    try {
      const created = await client.order.create({
        data: {
          id: order.id,
          userId: order.userId,
          totalCents: order.totalCents,
          currency: order.currency,
          status: order.status as PrismaOrderWithItems["status"],
          paymentGateway: order.paymentGateway,
          gatewayTxId: order.gatewayTxId,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          items: {
            create: itemsToCreate.map((item) => ({
              id: item.id,
              productId: item.productId,
              priceCents: item.priceCents,
              downloadToken: item.downloadToken,
              downloadCount: item.downloadCount,
              lastDownloadedAt: item.lastDownloadedAt,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: {
                select: { title: true },
              },
            },
          },
        },
      });

      return this.toEntity(created);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new EntityConflictException(
          "Order with gateway transaction ID already exists.",
          "gatewayTxId"
        );
      }
      throw error;
    }
  }

  public async findById(
    id: string,
    tx?: Prisma.TransactionClient
  ): Promise<OrderEntity | null> {
    const client = tx ?? this.prisma;

    const order = await client.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: { title: true },
            },
          },
        },
      },
    });

    if (!order) {
      return null;
    }

    return this.toEntity(order);
  }

  public async findByGatewayTxId(
    gatewayTxId: string,
    tx?: Prisma.TransactionClient
  ): Promise<OrderEntity | null> {
    const client = tx ?? this.prisma;

    const order = await client.order.findUnique({
      where: { gatewayTxId },
      include: {
        items: {
          include: {
            product: {
              select: { title: true },
            },
          },
        },
      },
    });

    if (!order) {
      return null;
    }

    return this.toEntity(order);
  }

  public async findUserOrders(
    userId: string,
    skip = 0,
    take = 20,
    tx?: Prisma.TransactionClient
  ): Promise<{ orders: OrderEntity[]; total: number }> {
    const client = tx ?? this.prisma;

    const [rawOrders, total] = await Promise.all([
      client.order.findMany({
        where: { userId },
        skip,
        take,
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            include: {
              product: {
                select: { title: true },
              },
            },
          },
        },
      }),
      client.order.count({
        where: { userId },
      }),
    ]);

    return {
      orders: rawOrders.map((o) => this.toEntity(o)),
      total,
    };
  }

  public async updateStatus(
    id: string,
    status: OrderStatus,
    gatewayTxId?: string,
    tx?: Prisma.TransactionClient
  ): Promise<OrderEntity> {
    const client = tx ?? this.prisma;

    try {
      const updated = await client.order.update({
        where: { id },
        data: {
          status: status as PrismaOrderWithItems["status"],
          ...(gatewayTxId !== undefined ? { gatewayTxId } : {}),
          updatedAt: new Date(),
        },
        include: {
          items: {
            include: {
              product: {
                select: { title: true },
              },
            },
          },
        },
      });

      return this.toEntity(updated);
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new EntityNotFoundException("Order", id);
      }
      throw error;
    }
  }

  private toEntity(raw: PrismaOrderWithItems): OrderEntity {
    const items = raw.items.map((rawItem) =>
      OrderItemEntity.reconstitute({
        id: rawItem.id,
        orderId: rawItem.orderId,
        productId: rawItem.productId,
        productTitle: rawItem.product?.title ?? "",
        priceCents: rawItem.priceCents,
        downloadToken: rawItem.downloadToken,
        downloadCount: rawItem.downloadCount,
        lastDownloadedAt: rawItem.lastDownloadedAt,
      })
    );

    return OrderEntity.reconstitute({
      id: raw.id,
      userId: raw.userId,
      totalCents: raw.totalCents,
      currency: raw.currency,
      status: raw.status as OrderStatus,
      paymentGateway: raw.paymentGateway,
      gatewayTxId: raw.gatewayTxId,
      items,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    });
  }
}
