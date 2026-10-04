import { Test, TestingModule } from "@nestjs/testing";
import { OrderStatus, UserRole } from "@vetralink/shared-types";
import {
  EntityNotFoundException,
  ForbiddenOperationException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import { OrderEntity } from "../entities/order.entity";
import { OrderItemEntity } from "../entities/order-item.entity";
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
  OrderFulfillmentService,
  MAX_DOWNLOADS_PER_ITEM,
} from "./order-fulfillment.service";

describe("OrderFulfillmentService", () => {
  let service: OrderFulfillmentService;
  let orderRepository: jest.Mocked<IOrderRepository>;
  let transactionManager: jest.Mocked<ITransactionManager>;
  let auditLogRepository: jest.Mocked<IAuditLogRepository>;
  let s3Storage: jest.Mocked<IS3StorageService>;
  let mailQueueService: jest.Mocked<IMailQueueService>;
  let mockEnvService: Partial<EnvService>;

  const mockOrderId = "order-uuid-1111";
  const mockUserId = "user-uuid-1111";
  const mockOtherUserId = "user-uuid-2222";
  const mockItemId = "item-uuid-1111";
  const mockProductId = "prod-uuid-1111";

  const createMockOrder = (status = OrderStatus.PENDING, downloadCount = 0) => {
    const item = OrderItemEntity.reconstitute({
      id: mockItemId,
      orderId: mockOrderId,
      productId: mockProductId,
      productTitle: "Veterinary Protocol",
      priceCents: 4900,
      downloadToken: "token-uuid-1111",
      downloadCount,
      lastDownloadedAt: null,
    });

    return OrderEntity.reconstitute({
      id: mockOrderId,
      userId: mockUserId,
      totalCents: 4900,
      currency: "USD",
      status,
      paymentGateway: "stripe",
      gatewayTxId: "pi_stripe_1111",
      items: [item],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  beforeEach(async () => {
    orderRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByGatewayTxId: jest.fn(),
      findUserOrders: jest.fn(),
      updateStatus: jest.fn(),
      updateItemDownloadTokens: jest.fn(),
      findByDownloadToken: jest.fn(),
      incrementDownloadCount: jest.fn(),
      findOrderUser: jest.fn().mockResolvedValue({
        email: "farmer@vetralink.pro",
        name: "Farmer Joe",
      }),
    };

    transactionManager = {
      run: jest.fn().mockImplementation(async (cb) => cb({})),
    };

    auditLogRepository = {
      record: jest.fn().mockResolvedValue({} as any),
      findByEntity: jest.fn(),
      findByTraceId: jest.fn(),
      query: jest.fn(),
    };

    s3Storage = {
      getPresignedGetUrl: jest
        .fn()
        .mockResolvedValue(
          "https://s3.amazonaws.com/test-deliveries/watermarked/order-uuid-1111/item-uuid-1111.pdf?sig=123"
        ),
      getPresignedPutUrl: jest.fn(),
      createMultipartUpload: jest.fn(),
      getPresignedPartUploadUrl: jest.fn(),
      completeMultipartUpload: jest.fn(),
      abortMultipartUpload: jest.fn(),
      downloadFile: jest.fn(),
      uploadFileFromDisk: jest.fn(),
      deleteObject: jest.fn(),
    };

    mailQueueService = {
      enqueueOrderDeliveryEmail: jest.fn().mockResolvedValue("job-mail-123"),
    };

    mockEnvService = {
      s3BucketDeliveries: "test-deliveries-bucket",
      s3BucketMedia: "test-media-bucket",
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrderFulfillmentService,
        {
          provide: ORDER_REPOSITORY,
          useValue: orderRepository,
        },
        {
          provide: TRANSACTION_MANAGER,
          useValue: transactionManager,
        },
        {
          provide: AUDIT_LOG_REPOSITORY,
          useValue: auditLogRepository,
        },
        {
          provide: S3_STORAGE_SERVICE,
          useValue: s3Storage,
        },
        {
          provide: MAIL_QUEUE_SERVICE,
          useValue: mailQueueService,
        },
        {
          provide: EnvService,
          useValue: mockEnvService,
        },
      ],
    }).compile();

    service = module.get<OrderFulfillmentService>(OrderFulfillmentService);
  });

  describe("fulfillOrder", () => {
    it("should fulfill a pending order, generate fresh tokens, update status, and record audit log", async () => {
      const pendingOrder = createMockOrder(OrderStatus.PENDING);
      const completedOrder = createMockOrder(OrderStatus.COMPLETED);

      orderRepository.findById
        .mockResolvedValueOnce(pendingOrder)
        .mockResolvedValueOnce(completedOrder);
      orderRepository.updateStatus.mockResolvedValue(completedOrder);
      orderRepository.updateItemDownloadTokens.mockResolvedValue(undefined);

      const result = await service.fulfillOrder(
        mockOrderId,
        "pi_stripe_new_tx"
      );

      expect(orderRepository.updateStatus).toHaveBeenCalledWith(
        mockOrderId,
        OrderStatus.COMPLETED,
        "pi_stripe_new_tx",
        expect.anything()
      );
      expect(orderRepository.updateItemDownloadTokens).toHaveBeenCalledWith(
        mockOrderId,
        [
          expect.objectContaining({
            itemId: mockItemId,
            downloadToken: expect.any(String),
          }),
        ],
        expect.anything()
      );
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUserId,
          action: "ORDER_FULFILLED",
          entityId: mockOrderId,
        }),
        expect.anything()
      );
      expect(mailQueueService.enqueueOrderDeliveryEmail).toHaveBeenCalledWith(
        mockOrderId,
        "farmer@vetralink.pro",
        "Farmer Joe",
        undefined
      );
      expect(result.status).toBe(OrderStatus.COMPLETED);
    });

    it("should be idempotent and skip token re-issuance if order is already COMPLETED", async () => {
      const completedOrder = createMockOrder(OrderStatus.COMPLETED);
      orderRepository.findById.mockResolvedValueOnce(completedOrder);

      const result = await service.fulfillOrder(mockOrderId);

      expect(orderRepository.updateStatus).not.toHaveBeenCalled();
      expect(orderRepository.updateItemDownloadTokens).not.toHaveBeenCalled();
      expect(auditLogRepository.record).not.toHaveBeenCalled();
      expect(result).toBe(completedOrder);
    });

    it("should throw EntityNotFoundException if order does not exist", async () => {
      orderRepository.findById.mockResolvedValueOnce(null);

      await expect(service.fulfillOrder("non-existent")).rejects.toThrow(
        EntityNotFoundException
      );
    });
  });

  describe("getOrderDownloadTokens", () => {
    it("should return download tokens when order is completed and caller is owner", async () => {
      const completedOrder = createMockOrder(OrderStatus.COMPLETED);
      orderRepository.findById.mockResolvedValueOnce(completedOrder);

      const result = await service.getOrderDownloadTokens(
        mockOrderId,
        mockUserId,
        UserRole.FARMER
      );

      expect(result.orderId).toBe(mockOrderId);
      expect(result.status).toBe(OrderStatus.COMPLETED);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]!.downloadToken).toBe("token-uuid-1111");
      expect(result.items[0]!.isDownloadable).toBe(true);
      expect(result.items[0]!.maxDownloads).toBe(MAX_DOWNLOADS_PER_ITEM);
    });

    it("should allow admin to view download tokens even if not owner", async () => {
      const completedOrder = createMockOrder(OrderStatus.COMPLETED);
      orderRepository.findById.mockResolvedValueOnce(completedOrder);

      const result = await service.getOrderDownloadTokens(
        mockOrderId,
        mockOtherUserId,
        UserRole.ADMIN
      );

      expect(result.orderId).toBe(mockOrderId);
      expect(result.items).toHaveLength(1);
    });

    it("should throw ForbiddenOperationException if caller is not owner and not admin", async () => {
      const completedOrder = createMockOrder(OrderStatus.COMPLETED);
      orderRepository.findById.mockResolvedValueOnce(completedOrder);

      await expect(
        service.getOrderDownloadTokens(
          mockOrderId,
          mockOtherUserId,
          UserRole.FARMER
        )
      ).rejects.toThrow(ForbiddenOperationException);
    });

    it("should throw ValidationDomainException if order is not completed", async () => {
      const pendingOrder = createMockOrder(OrderStatus.PENDING);
      orderRepository.findById.mockResolvedValueOnce(pendingOrder);

      await expect(
        service.getOrderDownloadTokens(mockOrderId, mockUserId, UserRole.FARMER)
      ).rejects.toThrow(ValidationDomainException);
    });
  });

  describe("validateDownloadToken", () => {
    it("should validate and return details for active completed token", async () => {
      const completedOrder = createMockOrder(OrderStatus.COMPLETED);
      orderRepository.findByDownloadToken.mockResolvedValueOnce({
        order: completedOrder,
        item: completedOrder.items[0]!,
        contentS3Key: "products/ebooks/protocol.pdf",
        productType: "EBOOK",
      });

      const result = await service.validateDownloadToken("token-uuid-1111");

      expect(result.isValid).toBe(true);
      expect(result.orderId).toBe(mockOrderId);
      expect(result.itemId).toBe(mockItemId);
      expect(result.contentS3Key).toBe("products/ebooks/protocol.pdf");
      expect(result.productType).toBe("EBOOK");
    });

    it("should return invalid when token is not found", async () => {
      orderRepository.findByDownloadToken.mockResolvedValueOnce(null);

      const result = await service.validateDownloadToken("unknown-token");

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("not found");
    });

    it("should return invalid when order is not completed", async () => {
      const pendingOrder = createMockOrder(OrderStatus.PENDING);
      orderRepository.findByDownloadToken.mockResolvedValueOnce({
        order: pendingOrder,
        item: pendingOrder.items[0]!,
        contentS3Key: "products/ebooks/protocol.pdf",
        productType: "EBOOK",
      });

      const result = await service.validateDownloadToken("token-uuid-1111");

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("Associated order is not completed");
    });

    it("should return invalid when download count exceeds limit", async () => {
      const completedOrder = createMockOrder(
        OrderStatus.COMPLETED,
        MAX_DOWNLOADS_PER_ITEM
      );
      orderRepository.findByDownloadToken.mockResolvedValueOnce({
        order: completedOrder,
        item: completedOrder.items[0]!,
        contentS3Key: "products/ebooks/protocol.pdf",
        productType: "EBOOK",
      });

      const result = await service.validateDownloadToken("token-uuid-1111");

      expect(result.isValid).toBe(false);
      expect(result.reason).toContain("Maximum download limit reached");
    });
  });

  describe("recordDownload", () => {
    it("should increment download count when token is valid", async () => {
      const completedOrder = createMockOrder(OrderStatus.COMPLETED);
      orderRepository.findByDownloadToken.mockResolvedValueOnce({
        order: completedOrder,
        item: completedOrder.items[0]!,
        contentS3Key: "products/ebooks/protocol.pdf",
        productType: "EBOOK",
      });
      orderRepository.incrementDownloadCount.mockResolvedValueOnce(
        completedOrder.items[0]!
      );

      await service.recordDownload("token-uuid-1111");

      expect(orderRepository.incrementDownloadCount).toHaveBeenCalledWith(
        mockItemId,
        undefined
      );
    });

    it("should throw ValidationDomainException if token cannot be validated", async () => {
      orderRepository.findByDownloadToken.mockResolvedValueOnce(null);

      await expect(service.recordDownload("bad-token")).rejects.toThrow(
        ValidationDomainException
      );
    });
  });

  describe("getSecureDownloadUrl", () => {
    it("should generate presigned url, increment download count, record audit log, and return response dto for order owner", async () => {
      const completedOrder = createMockOrder(OrderStatus.COMPLETED, 1);
      orderRepository.findById.mockResolvedValueOnce(completedOrder);
      orderRepository.findByDownloadToken.mockResolvedValueOnce({
        order: completedOrder,
        item: completedOrder.items[0]!,
        contentS3Key: "products/ebooks/protocol.pdf",
        productType: "EBOOK",
      });

      const updatedItem = OrderItemEntity.reconstitute({
        id: mockItemId,
        orderId: mockOrderId,
        productId: mockProductId,
        productTitle: "Veterinary Protocol",
        priceCents: 4900,
        downloadToken: "token-uuid-1111",
        downloadCount: 2,
        lastDownloadedAt: new Date(),
      });
      orderRepository.incrementDownloadCount.mockResolvedValueOnce(updatedItem);

      const result = await service.getSecureDownloadUrl(
        mockOrderId,
        "token-uuid-1111",
        mockUserId,
        UserRole.FARMER,
        "trace-123",
        "127.0.0.1"
      );

      expect(s3Storage.getPresignedGetUrl).toHaveBeenCalledWith(
        "test-deliveries-bucket",
        `watermarked/${mockOrderId}/${mockItemId}.pdf`,
        900
      );
      expect(orderRepository.incrementDownloadCount).toHaveBeenCalledWith(mockItemId);
      expect(auditLogRepository.record).toHaveBeenCalledWith({
        userId: mockUserId,
        action: "ORDER_ITEM_DOWNLOADED",
        entityType: "order_items",
        entityId: mockItemId,
        oldValues: {
          downloadCount: 1,
        },
        newValues: {
          downloadCount: 2,
          lastDownloadedAt: updatedItem.lastDownloadedAt,
          targetKey: `watermarked/${mockOrderId}/${mockItemId}.pdf`,
        },
        traceId: "trace-123",
        ipAddress: "127.0.0.1",
      });
      expect(result).toEqual({
        orderId: mockOrderId,
        itemId: mockItemId,
        productId: mockProductId,
        productTitle: "Veterinary Protocol",
        productType: "EBOOK",
        downloadUrl: expect.stringContaining("https://s3.amazonaws.com/test-deliveries"),
        expiresInSeconds: 900,
        downloadCount: 2,
        maxDownloads: MAX_DOWNLOADS_PER_ITEM,
        remainingDownloads: 3,
        lastDownloadedAt: updatedItem.lastDownloadedAt!.toISOString(),
      });
    });

    it("should resolve media bucket and key for non-EBOOK digital products", async () => {
      const completedOrder = createMockOrder(OrderStatus.COMPLETED, 0);
      orderRepository.findById.mockResolvedValueOnce(completedOrder);
      orderRepository.findByDownloadToken.mockResolvedValueOnce({
        order: completedOrder,
        item: completedOrder.items[0]!,
        contentS3Key: "products/tools/ration-calc.xlsx",
        productType: "EXCEL_TOOL",
      });

      const updatedItem = OrderItemEntity.reconstitute({
        id: mockItemId,
        orderId: mockOrderId,
        productId: mockProductId,
        productTitle: "Veterinary Protocol",
        priceCents: 4900,
        downloadToken: "token-uuid-1111",
        downloadCount: 1,
        lastDownloadedAt: new Date(),
      });
      orderRepository.incrementDownloadCount.mockResolvedValueOnce(updatedItem);

      await service.getSecureDownloadUrl(
        mockOrderId,
        "token-uuid-1111",
        mockUserId,
        UserRole.FARMER
      );

      expect(s3Storage.getPresignedGetUrl).toHaveBeenCalledWith(
        "test-media-bucket",
        "products/tools/ration-calc.xlsx",
        900
      );
    });

    it("should allow ADMIN user to download even if not the order owner", async () => {
      const completedOrder = createMockOrder(OrderStatus.COMPLETED, 0);
      orderRepository.findById.mockResolvedValueOnce(completedOrder);
      orderRepository.findByDownloadToken.mockResolvedValueOnce({
        order: completedOrder,
        item: completedOrder.items[0]!,
        contentS3Key: "products/ebooks/protocol.pdf",
        productType: "EBOOK",
      });

      const updatedItem = OrderItemEntity.reconstitute({
        id: mockItemId,
        orderId: mockOrderId,
        productId: mockProductId,
        productTitle: "Veterinary Protocol",
        priceCents: 4900,
        downloadToken: "token-uuid-1111",
        downloadCount: 1,
        lastDownloadedAt: new Date(),
      });
      orderRepository.incrementDownloadCount.mockResolvedValueOnce(updatedItem);

      const result = await service.getSecureDownloadUrl(
        mockOrderId,
        "token-uuid-1111",
        mockOtherUserId,
        UserRole.ADMIN
      );

      expect(result.orderId).toBe(mockOrderId);
      expect(orderRepository.incrementDownloadCount).toHaveBeenCalled();
    });

    it("should throw EntityNotFoundException if order does not exist", async () => {
      orderRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.getSecureDownloadUrl(
          "non-existent-order",
          "token-uuid-1111",
          mockUserId,
          UserRole.FARMER
        )
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw ForbiddenOperationException if caller is not owner and not admin", async () => {
      const completedOrder = createMockOrder(OrderStatus.COMPLETED, 0);
      orderRepository.findById.mockResolvedValueOnce(completedOrder);

      await expect(
        service.getSecureDownloadUrl(
          mockOrderId,
          "token-uuid-1111",
          mockOtherUserId,
          UserRole.FARMER
        )
      ).rejects.toThrow(ForbiddenOperationException);
    });

    it("should throw ValidationDomainException if order is not COMPLETED", async () => {
      const pendingOrder = createMockOrder(OrderStatus.PENDING, 0);
      orderRepository.findById.mockResolvedValueOnce(pendingOrder);

      await expect(
        service.getSecureDownloadUrl(
          mockOrderId,
          "token-uuid-1111",
          mockUserId,
          UserRole.FARMER
        )
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if download token does not belong to the order", async () => {
      const completedOrder = createMockOrder(OrderStatus.COMPLETED, 0);
      orderRepository.findById.mockResolvedValueOnce(completedOrder);

      const differentOrder = OrderEntity.reconstitute({
        id: "different-order-uuid",
        userId: mockUserId,
        totalCents: 4900,
        currency: "USD",
        status: OrderStatus.COMPLETED,
        paymentGateway: "stripe",
        gatewayTxId: "pi_diff",
        items: completedOrder.items,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      orderRepository.findByDownloadToken.mockResolvedValueOnce({
        order: differentOrder,
        item: differentOrder.items[0]!,
        contentS3Key: "products/ebooks/protocol.pdf",
        productType: "EBOOK",
      });

      await expect(
        service.getSecureDownloadUrl(
          mockOrderId,
          "token-uuid-1111",
          mockUserId,
          UserRole.FARMER
        )
      ).rejects.toThrow("Provided download token does not belong to this order.");
    });

    it("should throw ValidationDomainException if download limit is exceeded", async () => {
      const completedOrder = createMockOrder(OrderStatus.COMPLETED, MAX_DOWNLOADS_PER_ITEM);
      orderRepository.findById.mockResolvedValueOnce(completedOrder);
      orderRepository.findByDownloadToken.mockResolvedValueOnce({
        order: completedOrder,
        item: completedOrder.items[0]!,
        contentS3Key: "products/ebooks/protocol.pdf",
        productType: "EBOOK",
      });

      await expect(
        service.getSecureDownloadUrl(
          mockOrderId,
          "token-uuid-1111",
          mockUserId,
          UserRole.FARMER
        )
      ).rejects.toThrow("Maximum download limit reached");
    });
  });

  describe("resendOrderDeliveryEmail", () => {
    it("should enqueue delivery email for order owner and return status", async () => {
      const completedOrder = createMockOrder(OrderStatus.COMPLETED);
      orderRepository.findById.mockResolvedValueOnce(completedOrder);
      orderRepository.findOrderUser.mockResolvedValueOnce({
        email: "farmer@vetralink.pro",
        name: "Farmer Joe",
      });

      const result = await service.resendOrderDeliveryEmail(
        mockOrderId,
        mockUserId,
        UserRole.FARMER,
        "trace-123"
      );

      expect(mailQueueService.enqueueOrderDeliveryEmail).toHaveBeenCalledWith(
        mockOrderId,
        "farmer@vetralink.pro",
        "Farmer Joe",
        "trace-123"
      );
      expect(result).toEqual({ enqueued: true, orderId: mockOrderId });
    });

    it("should allow ADMIN to resend delivery email for any order", async () => {
      const completedOrder = createMockOrder(OrderStatus.COMPLETED);
      orderRepository.findById.mockResolvedValueOnce(completedOrder);
      orderRepository.findOrderUser.mockResolvedValueOnce({
        email: "farmer@vetralink.pro",
        name: "Farmer Joe",
      });

      const result = await service.resendOrderDeliveryEmail(
        mockOrderId,
        mockOtherUserId,
        UserRole.ADMIN
      );

      expect(result.enqueued).toBe(true);
      expect(mailQueueService.enqueueOrderDeliveryEmail).toHaveBeenCalled();
    });

    it("should throw EntityNotFoundException if order does not exist", async () => {
      orderRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.resendOrderDeliveryEmail(
          "unknown-order",
          mockUserId,
          UserRole.FARMER
        )
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should throw ForbiddenOperationException if caller is not owner and not admin", async () => {
      const completedOrder = createMockOrder(OrderStatus.COMPLETED);
      orderRepository.findById.mockResolvedValueOnce(completedOrder);

      await expect(
        service.resendOrderDeliveryEmail(
          mockOrderId,
          mockOtherUserId,
          UserRole.FARMER
        )
      ).rejects.toThrow(ForbiddenOperationException);
    });

    it("should throw ValidationDomainException if order is not COMPLETED", async () => {
      const pendingOrder = createMockOrder(OrderStatus.PENDING);
      orderRepository.findById.mockResolvedValueOnce(pendingOrder);

      await expect(
        service.resendOrderDeliveryEmail(
          mockOrderId,
          mockUserId,
          UserRole.FARMER
        )
      ).rejects.toThrow(ValidationDomainException);
    });

    it("should throw ValidationDomainException if user email is not found", async () => {
      const completedOrder = createMockOrder(OrderStatus.COMPLETED);
      orderRepository.findById.mockResolvedValueOnce(completedOrder);
      orderRepository.findOrderUser.mockResolvedValueOnce(null);

      await expect(
        service.resendOrderDeliveryEmail(
          mockOrderId,
          mockUserId,
          UserRole.FARMER
        )
      ).rejects.toThrow("No email address found for the user associated with this order.");
    });
  });
});
