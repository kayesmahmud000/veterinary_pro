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
import { ResponseInterceptor } from "../../common/interceptors/response.interceptor";
import { GlobalExceptionFilter } from "../../common/filters/global-exception.filter";
import { IdempotencyModule } from "../../common/idempotency";
import { StripeWebhookService } from "./services/stripe-webhook.service";
import { MfsWebhookService } from "./services/mfs-webhook.service";
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
import { OrderEntity } from "./entities/order.entity";

describe("Orders Idempotency Engine (Supertest & Service Integration)", () => {
  let app: INestApplication;
  let checkoutService: jest.Mocked<ICheckoutService>;
  let tokenService: jest.Mocked<ITokenService>;
  let stripeWebhookService: StripeWebhookService;
  let mfsWebhookService: MfsWebhookService;
  let orderRepository: jest.Mocked<IOrderRepository>;
  let transactionManager: jest.Mocked<ITransactionManager>;
  let auditLogRepository: jest.Mocked<IAuditLogRepository>;

  const customerUser = {
    sub: "11111111-1111-4111-8111-111111111111",
    email: "buyer@vetralink.pro",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const sampleCheckoutResponse = {
    orderId: "order-idem-1111",
    totalCents: 4900,
    currency: "USD",
    status: OrderStatus.PENDING,
    paymentGateway: "stripe",
    gatewayTxId: "pi_stripe_idem_1",
    clientSecret: "pi_secret_idem_1",
    checkoutUrl: "https://checkout.stripe.com/pay/idem1",
    items: [
      {
        id: "item-1",
        productId: "44444444-4444-4444-8444-444444444444",
        productTitle: "Clinical Cattle Protocol",
        priceCents: 4900,
        downloadToken: "dl-token-1",
        downloadCount: 0,
        lastDownloadedAt: null,
      },
    ],
    createdAt: new Date().toISOString(),
  };

  beforeAll(async () => {
    checkoutService = {
      checkout: jest.fn(),
      getOrderById: jest.fn(),
      getUserOrders: jest.fn(),
    };

    tokenService = {
      generateTokens: jest.fn(),
      generateAccessToken: jest.fn(),
      generateRefreshToken: jest.fn(),
      verifyAccessToken: jest.fn().mockImplementation(async (token: string) => {
        if (token === "customer-bearer-token") return customerUser;
        throw new Error("Invalid token");
      }),
      hashRefreshToken: jest.fn(),
      getRefreshTokenExpiresAt: jest.fn(),
    };

    orderRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByGatewayTxId: jest.fn(),
      findUserOrders: jest.fn(),
      updateStatus: jest.fn(),
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

    const mockEnvService = {
      nodeEnv: "test",
      stripeSecretKey: "",
      stripeWebhookSecret: "",
      mfsWebhookSecret: "test-mfs-secret",
    } as unknown as EnvService;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [IdempotencyModule],
      controllers: [OrdersController],
      providers: [
        {
          provide: CHECKOUT_SERVICE,
          useValue: checkoutService,
        },
        {
          provide: TOKEN_SERVICE,
          useValue: tokenService,
        },
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
          provide: EnvService,
          useValue: mockEnvService,
        },
        StripeWebhookService,
        MfsWebhookService,
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

    stripeWebhookService = moduleFixture.get<StripeWebhookService>(StripeWebhookService);
    mfsWebhookService = moduleFixture.get<MfsWebhookService>(MfsWebhookService);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Checkout Double-Click & Replay Defense", () => {
    it("should process checkout on first attempt and return 201 Created", async () => {
      checkoutService.checkout.mockResolvedValueOnce(sampleCheckoutResponse);

      const payload = {
        items: [{ productId: "44444444-4444-4444-8444-444444444444" }],
        paymentGateway: "stripe",
      };

      const res = await request(app.getHttpServer())
        .post("/orders/checkout")
        .set("Authorization", "Bearer customer-bearer-token")
        .set("Idempotency-Key", "idempotency-key-001")
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderId).toBe(sampleCheckoutResponse.orderId);
      expect(checkoutService.checkout).toHaveBeenCalledTimes(1);
    });

    it("should replay identical response on duplicate checkout without re-executing checkout logic", async () => {
      const payload = {
        items: [{ productId: "44444444-4444-4444-8444-444444444444" }],
        paymentGateway: "stripe",
      };

      // Resend exact same key and payload
      const res = await request(app.getHttpServer())
        .post("/orders/checkout")
        .set("Authorization", "Bearer customer-bearer-token")
        .set("Idempotency-Key", "idempotency-key-001")
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.orderId).toBe(sampleCheckoutResponse.orderId);
      // Critical check: checkoutService was NOT called again (0 calls in this test)
      expect(checkoutService.checkout).toHaveBeenCalledTimes(0);
    });

    it("should reject reused idempotency key with altered payload with HTTP 422 Unprocessable Entity", async () => {
      const alteredPayload = {
        items: [{ productId: "44444444-4444-4444-8444-444444444444" }],
        paymentGateway: "bkash",
      };

      const res = await request(app.getHttpServer())
        .post("/orders/checkout")
        .set("Authorization", "Bearer customer-bearer-token")
        .set("Idempotency-Key", "idempotency-key-001")
        .send(alteredPayload);

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Idempotency key payload mismatch");
      expect(checkoutService.checkout).not.toHaveBeenCalled();
    });

    it("should support X-Idempotency-Key header synonymously", async () => {
      const customResponse = {
        ...sampleCheckoutResponse,
        orderId: "order-x-header-2222",
      };
      checkoutService.checkout.mockResolvedValueOnce(customResponse);

      const payload = {
        items: [{ productId: "44444444-4444-4444-8444-444444444444" }],
        paymentGateway: "stripe",
      };

      // 1st request with X-Idempotency-Key
      const res1 = await request(app.getHttpServer())
        .post("/orders/checkout")
        .set("Authorization", "Bearer customer-bearer-token")
        .set("X-Idempotency-Key", "x-key-unique-777")
        .send(payload);

      expect(res1.status).toBe(201);
      expect(res1.body.data.orderId).toBe("order-x-header-2222");
      expect(checkoutService.checkout).toHaveBeenCalledTimes(1);

      // 2nd duplicate request
      const res2 = await request(app.getHttpServer())
        .post("/orders/checkout")
        .set("Authorization", "Bearer customer-bearer-token")
        .set("X-Idempotency-Key", "x-key-unique-777")
        .send(payload);

      expect(res2.status).toBe(201);
      expect(res2.body.data.orderId).toBe("order-x-header-2222");
      expect(checkoutService.checkout).toHaveBeenCalledTimes(1);
    });

    it("should pass through normally when no idempotency key header is supplied", async () => {
      checkoutService.checkout
        .mockResolvedValueOnce({ ...sampleCheckoutResponse, orderId: "order-no-key-1" })
        .mockResolvedValueOnce({ ...sampleCheckoutResponse, orderId: "order-no-key-2" });

      const payload = {
        items: [{ productId: "44444444-4444-4444-8444-444444444444" }],
        paymentGateway: "stripe",
      };

      const res1 = await request(app.getHttpServer())
        .post("/orders/checkout")
        .set("Authorization", "Bearer customer-bearer-token")
        .send(payload);

      const res2 = await request(app.getHttpServer())
        .post("/orders/checkout")
        .set("Authorization", "Bearer customer-bearer-token")
        .send(payload);

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      expect(res1.body.data.orderId).toBe("order-no-key-1");
      expect(res2.body.data.orderId).toBe("order-no-key-2");
      expect(checkoutService.checkout).toHaveBeenCalledTimes(2);
    });
  });

  describe("Webhook Deduplication via Idempotency Engine", () => {
    it("should deduplicate repeated Stripe webhook events via IdempotencyService", async () => {
      const order = OrderEntity.create({
        id: "order-stripe-webhook-dedup",
        userId: customerUser.sub,
        totalCents: 4900,
        status: OrderStatus.PENDING,
        gatewayTxId: "pi_stripe_dedup_1",
      });

      orderRepository.findById.mockResolvedValue(order);

      const eventPayload = {
        id: "evt_stripe_test_dedup_001",
        type: "payment_intent.succeeded",
        data: {
          object: {
            id: "pi_stripe_dedup_1",
            metadata: {
              orderId: "order-stripe-webhook-dedup",
            },
          },
        },
      };

      const rawBuffer = Buffer.from(JSON.stringify(eventPayload), "utf-8");

      // First webhook delivery
      const result1 = await stripeWebhookService.processWebhook(rawBuffer, "test-sig");
      expect(result1.status).toBe("processed");
      expect(result1.orderId).toBe("order-stripe-webhook-dedup");
      expect(transactionManager.run).toHaveBeenCalledTimes(1);

      // Second identical webhook delivery
      const result2 = await stripeWebhookService.processWebhook(rawBuffer, "test-sig");
      expect(result2.status).toBe("processed");
      expect(result2.orderId).toBe("order-stripe-webhook-dedup");
      // Critical check: transactionManager.run was NOT called again because response was cached!
      expect(transactionManager.run).toHaveBeenCalledTimes(1);
    });

    it("should deduplicate repeated Regional MFS IPN events via IdempotencyService", async () => {
      const order = OrderEntity.create({
        id: "order-mfs-webhook-dedup",
        userId: customerUser.sub,
        totalCents: 5000,
        status: OrderStatus.PENDING,
        gatewayTxId: "mfs_val_dedup_1",
      });

      orderRepository.findByGatewayTxId.mockResolvedValue(order);
      orderRepository.findById.mockResolvedValue(order);

      const ipnPayload = {
        provider: "bkash",
        transactionId: "TRX_MFS_DEDUP_001",
        gatewayTxId: "mfs_val_dedup_1",
        amountCents: 5000,
        currency: "BDT",
        status: "VALID" as const,
        signature: "test_mfs_valid_signature",
        rawPayload: { paymentID: "mfs_val_dedup_1", trxID: "TRX_MFS_DEDUP_001" },
      };

      // First IPN delivery
      const result1 = await mfsWebhookService.processIpn(ipnPayload, "test_mfs_valid_signature");
      expect(result1.status).toBe("processed");
      expect(result1.orderId).toBe("order-mfs-webhook-dedup");
      expect(transactionManager.run).toHaveBeenCalledTimes(1);

      // Second duplicate IPN delivery
      const result2 = await mfsWebhookService.processIpn(ipnPayload, "test_mfs_valid_signature");
      expect(result2.status).toBe("processed");
      expect(result2.orderId).toBe("order-mfs-webhook-dedup");
      // Transaction was NOT run again!
      expect(transactionManager.run).toHaveBeenCalledTimes(1);
    });
  });
});
