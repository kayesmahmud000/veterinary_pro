import { Test, TestingModule } from "@nestjs/testing";
import { Prisma } from "@prisma/client";
import { OrderStatus } from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { OrderRepository } from "./order.repository";
import { OrderEntity } from "../entities/order.entity";
import { OrderItemEntity } from "../entities/order-item.entity";
import {
  EntityConflictException,
  EntityNotFoundException,
} from "../../../common/exceptions/domain.exception";

describe("OrderRepository", () => {
  let repository: OrderRepository;
  let prismaService: jest.Mocked<PrismaService>;

  const mockDate = new Date("2026-09-12T12:00:00Z");

  const mockDbItem = {
    id: "item-uuid-1",
    orderId: "order-uuid-1",
    productId: "product-uuid-1",
    priceCents: 4900,
    downloadToken: "dl-token-1",
    downloadCount: 0,
    lastDownloadedAt: null,
    product: {
      title: "Veterinary Medicine Handbook",
    },
  };

  const mockDbOrder = {
    id: "order-uuid-1",
    userId: "user-uuid-1",
    totalCents: 4900,
    currency: "USD",
    status: OrderStatus.PENDING,
    paymentGateway: "stripe",
    gatewayTxId: "pi_123456",
    createdAt: mockDate,
    updatedAt: mockDate,
    items: [mockDbItem],
  };

  beforeEach(async () => {
    const mockPrisma = {
      order: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderRepository,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    repository = module.get<OrderRepository>(OrderRepository);
    prismaService = module.get(PrismaService);
  });

  describe("create", () => {
    it("should create order with items using default prisma client", async () => {
      (prismaService.order.create as jest.Mock).mockResolvedValue(mockDbOrder);

      const item = OrderItemEntity.create({
        productId: "product-uuid-1",
        productTitle: "Veterinary Medicine Handbook",
        priceCents: 4900,
      });

      const order = OrderEntity.create({
        id: "order-uuid-1",
        userId: "user-uuid-1",
        totalCents: 4900,
        items: [item],
      });

      const result = await repository.create(order);

      expect(prismaService.order.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          id: order.id,
          userId: "user-uuid-1",
          totalCents: 4900,
          currency: "USD",
          status: OrderStatus.PENDING,
          paymentGateway: "stripe",
          items: {
            create: [
              expect.objectContaining({
                productId: "product-uuid-1",
                priceCents: 4900,
              }),
            ],
          },
        }),
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

      expect(result).toBeInstanceOf(OrderEntity);
      expect(result.id).toBe("order-uuid-1");
      expect(result.items).toHaveLength(1);
      expect(result.items[0]?.productTitle).toBe("Veterinary Medicine Handbook");
    });

    it("should use transactional client tx when provided", async () => {
      const mockTx = {
        order: {
          create: jest.fn().mockResolvedValue(mockDbOrder),
        },
      } as unknown as Prisma.TransactionClient;

      const order = OrderEntity.create({
        id: "order-uuid-1",
        userId: "user-uuid-1",
        totalCents: 4900,
      });

      const result = await repository.create(order, [], mockTx);

      expect(mockTx.order.create).toHaveBeenCalled();
      expect(prismaService.order.create).not.toHaveBeenCalled();
      expect(result.id).toBe("order-uuid-1");
    });

    it("should throw EntityConflictException on P2002 duplicate error", async () => {
      const p2002Error = new Prisma.PrismaClientKnownRequestError(
        "Unique constraint failed",
        { code: "P2002", clientVersion: "5.0.0" }
      );
      (prismaService.order.create as jest.Mock).mockRejectedValue(p2002Error);

      const order = OrderEntity.create({
        userId: "user-uuid-1",
        totalCents: 4900,
      });

      await expect(repository.create(order)).rejects.toThrow(
        EntityConflictException
      );
    });
  });

  describe("findById", () => {
    it("should return OrderEntity when order is found", async () => {
      (prismaService.order.findUnique as jest.Mock).mockResolvedValue(mockDbOrder);

      const result = await repository.findById("order-uuid-1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("order-uuid-1");
      expect(result?.userId).toBe("user-uuid-1");
      expect(result?.items).toHaveLength(1);
    });

    it("should return null when order is not found", async () => {
      (prismaService.order.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findById("non-existent-id");

      expect(result).toBeNull();
    });
  });

  describe("findByGatewayTxId", () => {
    it("should return OrderEntity when found by gatewayTxId", async () => {
      (prismaService.order.findUnique as jest.Mock).mockResolvedValue(mockDbOrder);

      const result = await repository.findByGatewayTxId("pi_123456");

      expect(prismaService.order.findUnique).toHaveBeenCalledWith({
        where: { gatewayTxId: "pi_123456" },
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
      expect(result).not.toBeNull();
      expect(result?.gatewayTxId).toBe("pi_123456");
    });

    it("should return null when not found by gatewayTxId", async () => {
      (prismaService.order.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await repository.findByGatewayTxId("pi_unknown");

      expect(result).toBeNull();
    });
  });

  describe("findUserOrders", () => {
    it("should return paginated list of user orders with total count", async () => {
      (prismaService.order.findMany as jest.Mock).mockResolvedValue([mockDbOrder]);
      (prismaService.order.count as jest.Mock).mockResolvedValue(1);

      const result = await repository.findUserOrders("user-uuid-1", 0, 10);

      expect(prismaService.order.findMany).toHaveBeenCalledWith({
        where: { userId: "user-uuid-1" },
        skip: 0,
        take: 10,
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
      });
      expect(prismaService.order.count).toHaveBeenCalledWith({
        where: { userId: "user-uuid-1" },
      });

      expect(result.orders).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe("updateStatus", () => {
    it("should update status and gatewayTxId", async () => {
      const updatedMock = {
        ...mockDbOrder,
        status: OrderStatus.COMPLETED,
        gatewayTxId: "pi_completed",
      };
      (prismaService.order.update as jest.Mock).mockResolvedValue(updatedMock);

      const result = await repository.updateStatus(
        "order-uuid-1",
        OrderStatus.COMPLETED,
        "pi_completed"
      );

      expect(prismaService.order.update).toHaveBeenCalledWith({
        where: { id: "order-uuid-1" },
        data: {
          status: OrderStatus.COMPLETED,
          gatewayTxId: "pi_completed",
          updatedAt: expect.any(Date),
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

      expect(result.status).toBe(OrderStatus.COMPLETED);
      expect(result.gatewayTxId).toBe("pi_completed");
    });

    it("should throw EntityNotFoundException when order does not exist (P2025)", async () => {
      const p2025Error = new Prisma.PrismaClientKnownRequestError(
        "Record to update not found.",
        { code: "P2025", clientVersion: "5.0.0" }
      );
      (prismaService.order.update as jest.Mock).mockRejectedValue(p2025Error);

      await expect(
        repository.updateStatus("non-existent-id", OrderStatus.COMPLETED)
      ).rejects.toThrow(EntityNotFoundException);
    });
  });
});
