import { Test, TestingModule } from "@nestjs/testing";
import { OrderStatus } from "@vetralink/shared-types";
import { MailService, MAX_DOWNLOADS_LIMIT } from "./mail.service";
import {
  EMAIL_PROVIDER_TOKEN,
  IEmailProvider,
} from "../interfaces/mail-provider.interface";
import {
  ORDER_REPOSITORY,
  IOrderRepository,
} from "../../orders/repositories/order.repository.interface";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../../audit/repositories/audit-log.repository.interface";
import { EnvService } from "../../../config/env.service";
import { OrderEntity } from "../../orders/entities/order.entity";
import { OrderItemEntity } from "../../orders/entities/order-item.entity";
import { EntityNotFoundException } from "../../../common/exceptions/domain.exception";

describe("MailService", () => {
  let service: MailService;
  let emailProvider: jest.Mocked<IEmailProvider>;
  let orderRepository: jest.Mocked<IOrderRepository>;
  let auditLogRepository: jest.Mocked<IAuditLogRepository>;
  let envService: Partial<EnvService>;

  const mockOrderId = "order-uuid-1111";
  const mockUserId = "user-uuid-1111";
  const mockItemId = "item-uuid-1111";

  const createMockOrder = () => {
    const item = OrderItemEntity.reconstitute({
      id: mockItemId,
      orderId: mockOrderId,
      productId: "prod-uuid-1",
      productTitle: "Veterinary Clinical Guide",
      priceCents: 4900,
      downloadToken: "token-uuid-1111",
      downloadCount: 1,
      lastDownloadedAt: new Date(),
    });

    return OrderEntity.reconstitute({
      id: mockOrderId,
      userId: mockUserId,
      totalCents: 4900,
      currency: "USD",
      status: OrderStatus.COMPLETED,
      paymentGateway: "stripe",
      gatewayTxId: "pi_123",
      items: [item],
      createdAt: new Date("2026-09-12T12:00:00Z"),
      updatedAt: new Date("2026-09-12T12:00:00Z"),
    });
  };

  beforeEach(async () => {
    emailProvider = {
      providerName: "mock",
      sendEmail: jest.fn().mockResolvedValue({
        success: true,
        messageId: "msg-123",
        provider: "mock",
      }),
    };

    orderRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByGatewayTxId: jest.fn(),
      findUserOrders: jest.fn(),
      updateStatus: jest.fn(),
      updateItemDownloadTokens: jest.fn(),
      findByDownloadToken: jest.fn(),
      incrementDownloadCount: jest.fn(),
      findOrderUser: jest.fn(),
    };

    auditLogRepository = {
      record: jest.fn().mockResolvedValue({} as any),
      findByEntity: jest.fn(),
      findByTraceId: jest.fn(),
      query: jest.fn(),
    };

    envService = {
      apiBaseUrl: "https://api.vetralink.pro",
      emailFrom: "orders@vetralink.pro",
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailService,
        {
          provide: EMAIL_PROVIDER_TOKEN,
          useValue: emailProvider,
        },
        {
          provide: ORDER_REPOSITORY,
          useValue: orderRepository,
        },
        {
          provide: AUDIT_LOG_REPOSITORY,
          useValue: auditLogRepository,
        },
        {
          provide: EnvService,
          useValue: envService,
        },
      ],
    }).compile();

    service = module.get<MailService>(MailService);
  });

  describe("sendEmail", () => {
    it("should delegate email sending to active provider", async () => {
      const msg = {
        to: "test@vetralink.pro",
        subject: "Hello",
        html: "<p>Hello</p>",
        text: "Hello",
      };

      const result = await service.sendEmail(msg);

      expect(emailProvider.sendEmail).toHaveBeenCalledWith(msg);
      expect(result.success).toBe(true);
      expect(result.messageId).toBe("msg-123");
    });
  });

  describe("sendOrderFulfillmentEmail", () => {
    it("should throw EntityNotFoundException if order does not exist", async () => {
      orderRepository.findById.mockResolvedValueOnce(null);

      await expect(
        service.sendOrderFulfillmentEmail(
          "non-existent-order",
          "farmer@vetralink.pro"
        )
      ).rejects.toThrow(EntityNotFoundException);
    });

    it("should generate delivery template, dispatch email, and record audit log", async () => {
      const order = createMockOrder();
      orderRepository.findById.mockResolvedValueOnce(order);

      const result = await service.sendOrderFulfillmentEmail(
        mockOrderId,
        "farmer@vetralink.pro",
        "John Farmer",
        "trace-123"
      );

      expect(result.success).toBe(true);
      expect(emailProvider.sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "farmer@vetralink.pro",
          subject: expect.stringContaining(mockOrderId.slice(0, 8)),
          html: expect.stringContaining("Veterinary Clinical Guide"),
          text: expect.stringContaining("https://api.vetralink.pro/api/v1/orders/order-uuid-1111/download?token=token-uuid-1111&redirect=true"),
        })
      );

      expect(auditLogRepository.record).toHaveBeenCalledWith({
        userId: mockUserId,
        action: "ORDER_EMAIL_DISPATCHED",
        entityType: "Order",
        entityId: mockOrderId,
        newValues: {
          recipientEmail: "farmer@vetralink.pro",
          provider: "mock",
          messageId: "msg-123",
          success: true,
          itemCount: 1,
        },
        traceId: "trace-123",
      });
    });

    it("should handle provider failure gracefully and still record audit log", async () => {
      const order = createMockOrder();
      orderRepository.findById.mockResolvedValueOnce(order);
      emailProvider.sendEmail.mockResolvedValueOnce({
        success: false,
        provider: "resend",
        error: "Rate limit exceeded",
      });

      const result = await service.sendOrderFulfillmentEmail(
        mockOrderId,
        "farmer@vetralink.pro"
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe("Rate limit exceeded");
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ORDER_EMAIL_DISPATCHED",
          newValues: expect.objectContaining({
            success: false,
          }),
        })
      );
    });
  });
});
