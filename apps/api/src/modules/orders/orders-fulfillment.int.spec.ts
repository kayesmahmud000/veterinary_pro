import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import * as supertest from "supertest";

const request =
  typeof supertest === "function"
    ? supertest
    : ((supertest as any).default ?? supertest);

import { OrderStatus, UserRole, UserStatus } from "@vetralink/shared-types";
import { OrdersController } from "./orders.controller";
import {
  ICheckoutService,
  CHECKOUT_SERVICE,
} from "./services/checkout.service.interface";
import {
  ITokenService,
  TOKEN_SERVICE,
} from "../auth/services/token.service.interface";
import {
  IOrderFulfillmentService,
  ORDER_FULFILLMENT_SERVICE,
} from "./services/order-fulfillment.service.interface";
import { OrderFulfillmentService } from "./services/order-fulfillment.service";
import { StripeWebhookController } from "./controllers/stripe-webhook.controller";
import { StripeWebhookService } from "./services/stripe-webhook.service";
import { STRIPE_WEBHOOK_SERVICE } from "./services/stripe-webhook.service.interface";
import { MfsWebhookController } from "./controllers/mfs-webhook.controller";
import { MfsWebhookService } from "./services/mfs-webhook.service";
import { MFS_WEBHOOK_SERVICE } from "./services/mfs-webhook.service.interface";
import {
  IOrderRepository,
  ORDER_REPOSITORY,
} from "./repositories/order.repository.interface";
import {
  ITransactionManager,
  TRANSACTION_MANAGER,
} from "../prisma/interfaces/transaction.interface";
import {
  IAuditLogRepository,
  AUDIT_LOG_REPOSITORY,
} from "../audit/repositories/audit-log.repository.interface";
import { EnvService } from "../../config/env.service";
import { ResponseInterceptor } from "../../common/interceptors/response.interceptor";
import { GlobalExceptionFilter } from "../../common/filters/global-exception.filter";
import { IdempotencyModule } from "../../common/idempotency";
import { OrderEntity } from "./entities/order.entity";
import { OrderItemEntity } from "./entities/order-item.entity";

describe("Order Fulfillment & Download Tokens (Integration via Supertest)", () => {
  let app: INestApplication;
  let orderRepository: jest.Mocked<IOrderRepository>;
  let transactionManager: jest.Mocked<ITransactionManager>;
  let auditLogRepository: jest.Mocked<IAuditLogRepository>;
  let tokenService: jest.Mocked<ITokenService>;
  let checkoutService: jest.Mocked<ICheckoutService>;
  let fulfillmentService: IOrderFulfillmentService;

  const customerUser = {
    sub: "11111111-1111-4111-8111-111111111111",
    email: "customer@vetralink.pro",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const otherUser = {
    sub: "22222222-2222-4222-8222-222222222222",
    email: "intruder@vetralink.pro",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const adminUser = {
    sub: "99999999-9999-4999-8999-999999999999",
    email: "admin@vetralink.pro",
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  };

  const sampleOrderId = "33333333-3333-4333-8333-333333333333";
  const sampleItemId = "44444444-4444-4444-8444-444444444444";
  const sampleProductId = "55555555-5555-4555-8555-555555555555";
  const sampleToken = "66666666-6666-4666-8666-666666666666";

  const buildMockOrder = (status: OrderStatus, downloadCount = 0) => {
    const item = OrderItemEntity.reconstitute({
      id: sampleItemId,
      orderId: sampleOrderId,
      productId: sampleProductId,
      productTitle: "Dairy Health Protocol",
      priceCents: 4900,
      downloadToken: sampleToken,
      downloadCount,
      lastDownloadedAt: null,
    });

    return OrderEntity.reconstitute({
      id: sampleOrderId,
      userId: customerUser.sub,
      totalCents: 4900,
      currency: "USD",
      status,
      paymentGateway: "stripe",
      gatewayTxId: "pi_test_tx_123",
      items: [item],
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  beforeAll(async () => {
    orderRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByGatewayTxId: jest.fn(),
      findUserOrders: jest.fn(),
      updateStatus: jest.fn(),
      updateItemDownloadTokens: jest.fn(),
      findByDownloadToken: jest.fn(),
      incrementDownloadCount: jest.fn(),
    };

    transactionManager = {
      run: jest.fn().mockImplementation(async (cb: (tx: unknown) => Promise<unknown>) => cb({})),
    };

    auditLogRepository = {
      record: jest.fn().mockResolvedValue({} as any),
      findByEntity: jest.fn(),
      findByTraceId: jest.fn(),
      query: jest.fn(),
    };

    tokenService = {
      generateTokens: jest.fn(),
      generateAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
      verifyAccessToken: jest.fn().mockImplementation(async (tok: string) => {
        if (tok === "customer-token") return customerUser;
        if (tok === "other-token") return otherUser;
        if (tok === "admin-token") return adminUser;
        throw new Error("Invalid token");
      }),
      hashRefreshToken: jest.fn(),
      getRefreshTokenExpiresAt: jest.fn(),
    };

    checkoutService = {
      checkout: jest.fn(),
      getOrderById: jest.fn(),
      getUserOrders: jest.fn(),
    };

    const mockEnvService = {
      nodeEnv: "test",
      stripeSecretKey: "",
      stripeWebhookSecret: "",
      mfsWebhookSecret: "test_mfs_secret",
    } as unknown as EnvService;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [IdempotencyModule],
      controllers: [
        OrdersController,
        StripeWebhookController,
        MfsWebhookController,
      ],
      providers: [
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
          provide: TOKEN_SERVICE,
          useValue: tokenService,
        },
        {
          provide: CHECKOUT_SERVICE,
          useValue: checkoutService,
        },
        {
          provide: EnvService,
          useValue: mockEnvService,
        },
        OrderFulfillmentService,
        {
          provide: ORDER_FULFILLMENT_SERVICE,
          useClass: OrderFulfillmentService,
        },
        StripeWebhookService,
        {
          provide: STRIPE_WEBHOOK_SERVICE,
          useClass: StripeWebhookService,
        },
        MfsWebhookService,
        {
          provide: MFS_WEBHOOK_SERVICE,
          useClass: MfsWebhookService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();

    const reflector = app.get(Reflector);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      })
    );
    app.useGlobalInterceptors(new ResponseInterceptor(reflector));
    app.useGlobalFilters(new GlobalExceptionFilter());

    await app.init();

    fulfillmentService = moduleFixture.get<IOrderFulfillmentService>(
      ORDER_FULFILLMENT_SERVICE
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /orders/:id/download-tokens", () => {
    it("should return download tokens for COMPLETED order owned by customer", async () => {
      const order = buildMockOrder(OrderStatus.COMPLETED);
      orderRepository.findById.mockResolvedValueOnce(order);

      const res = await request(app.getHttpServer())
        .get(`/orders/${sampleOrderId}/download-tokens`)
        .set("Authorization", "Bearer customer-token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderId).toBe(sampleOrderId);
      expect(res.body.data.status).toBe(OrderStatus.COMPLETED);
      expect(res.body.data.items).toHaveLength(1);
      expect(res.body.data.items[0].downloadToken).toBe(sampleToken);
      expect(res.body.data.items[0].isDownloadable).toBe(true);
      expect(res.body.data.items[0].maxDownloads).toBe(5);
    });

    it("should reject token retrieval for PENDING (unsettled) order with HTTP 422", async () => {
      const order = buildMockOrder(OrderStatus.PENDING);
      orderRepository.findById.mockResolvedValueOnce(order);

      const res = await request(app.getHttpServer())
        .get(`/orders/${sampleOrderId}/download-tokens`)
        .set("Authorization", "Bearer customer-token");

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Download tokens are only available for completed orders");
    });

    it("should reject token retrieval by unauthorized customer with HTTP 403 Forbidden", async () => {
      const order = buildMockOrder(OrderStatus.COMPLETED);
      orderRepository.findById.mockResolvedValueOnce(order);

      const res = await request(app.getHttpServer())
        .get(`/orders/${sampleOrderId}/download-tokens`)
        .set("Authorization", "Bearer other-token");

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("not authorized");
    });

    it("should allow administrator to retrieve download tokens for any order", async () => {
      const order = buildMockOrder(OrderStatus.COMPLETED);
      orderRepository.findById.mockResolvedValueOnce(order);

      const res = await request(app.getHttpServer())
        .get(`/orders/${sampleOrderId}/download-tokens`)
        .set("Authorization", "Bearer admin-token");

      expect(res.status).toBe(200);
      expect(res.body.data.orderId).toBe(sampleOrderId);
    });
  });

  describe("Webhook Automated Fulfillment & Token Issuance", () => {
    it("should automatically fulfill order and generate download tokens upon Stripe payment_intent.succeeded", async () => {
      const pendingOrder = buildMockOrder(OrderStatus.PENDING);
      const completedOrder = buildMockOrder(OrderStatus.COMPLETED);

      orderRepository.findById
        .mockResolvedValueOnce(pendingOrder)
        .mockResolvedValueOnce(pendingOrder)
        .mockResolvedValueOnce(completedOrder);
      orderRepository.updateStatus.mockResolvedValue(completedOrder);
      orderRepository.updateItemDownloadTokens.mockResolvedValue(undefined);

      const stripePayload = {
        id: "evt_stripe_fulfillment_001",
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_test_tx_123",
            metadata: {
              orderId: sampleOrderId,
            },
          },
        },
      };

      const res = await request(app.getHttpServer())
        .post("/orders/webhook/stripe")
        .set("stripe-signature", "valid_sig")
        .send(stripePayload);

      expect(res.status).toBe(200);
      expect(orderRepository.updateStatus).toHaveBeenCalledWith(
        sampleOrderId,
        OrderStatus.COMPLETED,
        "pi_test_tx_123",
        expect.anything()
      );
      expect(orderRepository.updateItemDownloadTokens).toHaveBeenCalledWith(
        sampleOrderId,
        [
          expect.objectContaining({
            itemId: sampleItemId,
            downloadToken: expect.any(String),
          }),
        ],
        expect.anything()
      );
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "ORDER_FULFILLED",
          entityId: sampleOrderId,
        }),
        expect.anything()
      );
    });
  });

  describe("Token Validation & Usage Governance", () => {
    it("should validate active token and confirm asset details", async () => {
      const completedOrder = buildMockOrder(OrderStatus.COMPLETED);
      orderRepository.findByDownloadToken.mockResolvedValueOnce({
        order: completedOrder,
        item: completedOrder.items[0]!,
        contentS3Key: "products/ebooks/dairy-guide.pdf",
        productType: "EBOOK",
      });

      const validation = await fulfillmentService.validateDownloadToken(sampleToken);

      expect(validation.isValid).toBe(true);
      expect(validation.orderId).toBe(sampleOrderId);
      expect(validation.contentS3Key).toBe("products/ebooks/dairy-guide.pdf");
      expect(validation.productType).toBe("EBOOK");
    });

    it("should reject token when download quota limit is reached (5 downloads)", async () => {
      const completedOrder = buildMockOrder(OrderStatus.COMPLETED, 5);
      orderRepository.findByDownloadToken.mockResolvedValueOnce({
        order: completedOrder,
        item: completedOrder.items[0]!,
        contentS3Key: "products/ebooks/dairy-guide.pdf",
        productType: "EBOOK",
      });

      const validation = await fulfillmentService.validateDownloadToken(sampleToken);

      expect(validation.isValid).toBe(false);
      expect(validation.reason).toContain("Maximum download limit reached");
    });

    it("should record download attempt and increment counter", async () => {
      const completedOrder = buildMockOrder(OrderStatus.COMPLETED);
      orderRepository.findByDownloadToken.mockResolvedValueOnce({
        order: completedOrder,
        item: completedOrder.items[0]!,
        contentS3Key: "products/ebooks/dairy-guide.pdf",
        productType: "EBOOK",
      });
      orderRepository.incrementDownloadCount.mockResolvedValueOnce(
        completedOrder.items[0]!
      );

      await fulfillmentService.recordDownload(sampleToken);

      expect(orderRepository.incrementDownloadCount).toHaveBeenCalledWith(
        sampleItemId,
        undefined
      );
    });
  });
});
