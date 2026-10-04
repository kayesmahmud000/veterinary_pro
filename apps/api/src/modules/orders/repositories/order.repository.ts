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

  public async updateItemDownloadTokens(
    orderId: string,
    tokens: { itemId: string; downloadToken: string }[],
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const client = tx ?? this.prisma;

    await Promise.all(
      tokens.map((t) =>
        client.orderItem.update({
          where: { id: t.itemId },
          data: {
            downloadToken: t.downloadToken,
            downloadCount: 0,
            lastDownloadedAt: null,
          },
        })
      )
    );
  }

  public async findByDownloadToken(
    downloadToken: string,
    tx?: Prisma.TransactionClient
  ): Promise<{
    order: OrderEntity;
    item: OrderItemEntity;
    contentS3Key: string;
    productType: string;
  } | null> {
    const client = tx ?? this.prisma;

    const raw = await client.orderItem.findFirst({
      where: { downloadToken },
      include: {
        product: {
          select: {
            title: true,
            type: true,
            contentS3Key: true,
          },
        },
        order: {
          include: {
            items: {
              include: {
                product: {
                  select: { title: true },
                },
              },
            },
          },
        },
      },
    });

    if (!raw || !raw.order) {
      return null;
    }

    const orderEntity = this.toEntity(raw.order as PrismaOrderWithItems);
    const itemEntity = OrderItemEntity.reconstitute({
      id: raw.id,
      orderId: raw.orderId,
      productId: raw.productId,
      productTitle: raw.product?.title ?? "",
      priceCents: raw.priceCents,
      downloadToken: raw.downloadToken,
      downloadCount: raw.downloadCount,
      lastDownloadedAt: raw.lastDownloadedAt,
    });

    return {
      order: orderEntity,
      item: itemEntity,
      contentS3Key: raw.product?.contentS3Key ?? "",
      productType: raw.product?.type ?? "",
    };
  }

  public async incrementDownloadCount(
    itemId: string,
    tx?: Prisma.TransactionClient
  ): Promise<OrderItemEntity> {
    const client = tx ?? this.prisma;

    try {
      const updated = await client.orderItem.update({
        where: { id: itemId },
        data: {
          downloadCount: { increment: 1 },
          lastDownloadedAt: new Date(),
        },
        include: {
          product: {
            select: { title: true },
          },
        },
      });

      return OrderItemEntity.reconstitute({
        id: updated.id,
        orderId: updated.orderId,
        productId: updated.productId,
        productTitle: updated.product?.title ?? "",
        priceCents: updated.priceCents,
        downloadToken: updated.downloadToken,
        downloadCount: updated.downloadCount,
        lastDownloadedAt: updated.lastDownloadedAt,
      });
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new EntityNotFoundException("OrderItem", itemId);
      }
      throw error;
    }
  }

  public async findOrderUser(
    userId: string,
    tx?: Prisma.TransactionClient
  ): Promise<{ email: string; name: string } | null> {
    const client = tx ?? this.prisma;
    const user = await client.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });
    return user;
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
