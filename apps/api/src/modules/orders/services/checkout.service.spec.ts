import { Test, TestingModule } from "@nestjs/testing";
import {
  OrderStatus,
  ProductType,
  SubscriptionTier,
} from "@vetralink/shared-types";
import { CheckoutService } from "./checkout.service";
import {
  IOrderRepository,
  ORDER_REPOSITORY,
} from "../repositories/order.repository.interface";
import {
  IProductRepository,
  PRODUCT_REPOSITORY,
} from "../../products/repositories/product.repository.interface";
import {
  IPaymentGatewayService,
  PAYMENT_GATEWAY_SERVICE,
} from "./payment-gateway.service.interface";
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from "../../prisma/interfaces/transaction.interface";
import {
  IAuditLogRepository,
  AUDIT_LOG_REPOSITORY,
} from "../../audit/repositories/audit-log.repository.interface";
import { OrderEntity } from "../entities/order.entity";
import { OrderItemEntity } from "../entities/order-item.entity";
import { ProductEntity } from "../../products/entities/product.entity";
import {
  EntityNotFoundException,
  ForbiddenOperationException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";

describe("CheckoutService", () => {
  let service: CheckoutService;
  let orderRepository: jest.Mocked<IOrderRepository>;
  let productRepository: jest.Mocked<IProductRepository>;
  let paymentGatewayService: jest.Mocked<IPaymentGatewayService>;
  let transactionManager: jest.Mocked<ITransactionManager>;
  let auditLogRepository: jest.Mocked<IAuditLogRepository>;

  const mockProduct1 = ProductEntity.reconstitute({
    id: "prod-uuid-1",
    title: "Veterinary Medicine Manual",
    slug: "vet-manual",
    type: ProductType.EBOOK,
    description: "Comprehensive veterinary handbook",
    priceCents: 5000,
    discountPriceCents: 4000,
    currency: "USD",
    contentS3Key: "products/ebooks/manual.pdf",
    minSubscriptionTier: SubscriptionTier.STARTER,
    isPublished: true,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  });

  const mockProduct2 = ProductEntity.reconstitute({
    id: "prod-uuid-2",
    title: "Livestock Feed Formulation",
    slug: "feed-formulation",
    type: ProductType.EXCEL_TOOL,
    description: "Comprehensive feed formulation tool",
    priceCents: 3000,
    discountPriceCents: null,
    currency: "USD",
    contentS3Key: "products/tools/feed.xlsx",
    minSubscriptionTier: SubscriptionTier.STARTER,
    isPublished: true,
    metadata: {},
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
  });

  beforeEach(async () => {
    const mockOrderRepo: Partial<jest.Mocked<IOrderRepository>> = {
      create: jest.fn(),
      findById: jest.fn(),
      findByGatewayTxId: jest.fn(),
      findUserOrders: jest.fn(),
      updateStatus: jest.fn(),
    };

    const mockProductRepo: Partial<jest.Mocked<IProductRepository>> = {
      findById: jest.fn(),
    };

    const mockPaymentGateway: Partial<jest.Mocked<IPaymentGatewayService>> = {
      gatewayName: "stripe",
      createPaymentIntent: jest.fn(),
    };

    const mockTxManager: jest.Mocked<ITransactionManager> = {
      run: jest.fn().mockImplementation(async (callback) => {
        return callback({} as never);
      }),
    };

    const mockAuditLogRepo: Partial<jest.Mocked<IAuditLogRepository>> = {
      record: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckoutService,
        {
          provide: ORDER_REPOSITORY,
          useValue: mockOrderRepo,
        },
        {
          provide: PRODUCT_REPOSITORY,
          useValue: mockProductRepo,
        },
        {
          provide: PAYMENT_GATEWAY_SERVICE,
          useValue: mockPaymentGateway,
        },
        {
          provide: TRANSACTION_MANAGER,
          useValue: mockTxManager,
        },
        {
          provide: AUDIT_LOG_REPOSITORY,
          useValue: mockAuditLogRepo,
        },
      ],
    }).compile();

    service = module.get<CheckoutService>(CheckoutService);
    orderRepository = module.get(ORDER_REPOSITORY);
    productRepository = module.get(PRODUCT_REPOSITORY);
    paymentGatewayService = module.get(PAYMENT_GATEWAY_SERVICE);
    transactionManager = module.get(TRANSACTION_MANAGER);
    auditLogRepository = module.get(AUDIT_LOG_REPOSITORY);
  });

  describe("checkout", () => {
    it("should reject checkout with empty items list", async () => {
      await expect(
        service.checkout("user-1", { items: [] })
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should reject checkout with duplicate productIds", async () => {
      await expect(
        service.checkout("user-1", {
          items: [
            { productId: "prod-uuid-1" },
            { productId: "prod-uuid-1" },
          ],
        })
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should reject checkout when product is not found or soft-deleted", async () => {
      productRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.checkout("user-1", {
          items: [{ productId: "prod-uuid-not-found" }],
        })
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should reject checkout when product is unpublished", async () => {
      const unpublishedProduct = ProductEntity.reconstitute({
        id: "prod-unpub",
        title: "Draft Course",
        slug: "draft-course",
        type: ProductType.VIDEO_COURSE,
        description: "Draft unpublished course description",
        priceCents: 1000,
        discountPriceCents: null,
        currency: "USD",
        contentS3Key: "products/video.mp4",
        minSubscriptionTier: SubscriptionTier.STARTER,
        isPublished: false,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      });
      productRepository.findById.mockResolvedValueOnce(unpublishedProduct);

      await expect(
        service.checkout("user-1", {
          items: [{ productId: "prod-unpub" }],
        })
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should calculate authoritative pricing and execute order within transaction", async () => {
      productRepository.findById
        .mockResolvedValueOnce(mockProduct1)
        .mockResolvedValueOnce(mockProduct2);

      const savedOrder = OrderEntity.create({
        id: "order-uuid-created",
        userId: "user-uuid-1",
        totalCents: 7000, // 4000 (discounted) + 3000 (regular)
        currency: "USD",
        items: [
          OrderItemEntity.create({
            productId: mockProduct1.id,
            productTitle: mockProduct1.title,
            priceCents: 4000,
          }),
          OrderItemEntity.create({
            productId: mockProduct2.id,
            productTitle: mockProduct2.title,
            priceCents: 3000,
          }),
        ],
      });

      orderRepository.create.mockResolvedValueOnce(savedOrder);
      paymentGatewayService.createPaymentIntent.mockResolvedValueOnce({
        gatewayTxId: "pi_test_intent_123",
        clientSecret: "pi_test_intent_123_secret",
      });
      orderRepository.updateStatus.mockResolvedValueOnce(savedOrder);

      const result = await service.checkout(
        "user-uuid-1",
        {
          items: [
            { productId: "prod-uuid-1" },
            { productId: "prod-uuid-2" },
          ],
          paymentGateway: "stripe",
        },
        "customer@vetralink.pro"
      );

      expect(transactionManager.run).toHaveBeenCalledTimes(1);
      expect(orderRepository.create).toHaveBeenCalled();
      expect(paymentGatewayService.createPaymentIntent).toHaveBeenCalledWith(
        savedOrder.id,
        7000,
        "USD",
        "customer@vetralink.pro",
        expect.objectContaining({ orderId: savedOrder.id, userId: "user-uuid-1" })
      );
      expect(orderRepository.updateStatus).toHaveBeenCalledWith(
        savedOrder.id,
        OrderStatus.PENDING,
        "pi_test_intent_123",
        expect.anything()
      );
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-uuid-1",
          action: "ORDER_CREATED",
          entityType: "Order",
          entityId: savedOrder.id,
        }),
        expect.anything()
      );

      expect(result.orderId).toBe("order-uuid-created");
      expect(result.totalCents).toBe(7000);
      expect(result.clientSecret).toBe("pi_test_intent_123_secret");
      expect(result.items).toHaveLength(2);
    });
  });

  describe("getOrderById", () => {
    it("should return order details when user is the owner", async () => {
      const order = OrderEntity.create({
        id: "order-owner-1",
        userId: "user-123",
        totalCents: 4000,
      });
      orderRepository.findById.mockResolvedValueOnce(order);

      const result = await service.getOrderById("order-owner-1", "user-123");
      expect(result.id).toBe("order-owner-1");
      expect(result.userId).toBe("user-123");
    });

    it("should return order details when user is admin even if not owner", async () => {
      const order = OrderEntity.create({
        id: "order-owner-1",
        userId: "user-123",
        totalCents: 4000,
      });
      orderRepository.findById.mockResolvedValueOnce(order);

      const result = await service.getOrderById(
        "order-owner-1",
        "admin-user",
        true
      );
      expect(result.id).toBe("order-owner-1");
    });

    it("should throw ForbiddenOperationException when non-admin accesses another user order", async () => {
      const order = OrderEntity.create({
        id: "order-owner-1",
        userId: "user-123",
        totalCents: 4000,
      });
      orderRepository.findById.mockResolvedValueOnce(order);

      await expect(
        service.getOrderById("order-owner-1", "foreign-user", false)
      ).rejects.toThrow(ForbiddenOperationException);
    });

    it("should throw EntityNotFoundException when order does not exist", async () => {
      orderRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.getOrderById("non-existent-order", "user-123")
      ).rejects.toThrow(EntityNotFoundException);
    });
  });

  describe("getUserOrders", () => {
    it("should return paginated list of user orders", async () => {
      const order = OrderEntity.create({
        id: "order-1",
        userId: "user-123",
        totalCents: 4000,
      });
      orderRepository.findUserOrders.mockResolvedValueOnce({
        orders: [order],
        total: 1,
      });

      const result = await service.getUserOrders("user-123", 1, 10);
      expect(result.orders).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(orderRepository.findUserOrders).toHaveBeenCalledWith(
        "user-123",
        0,
        10
      );
    });
  });
});
