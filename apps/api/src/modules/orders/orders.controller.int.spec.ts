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
import {
  EntityNotFoundException,
  ForbiddenOperationException,
  ValidationDomainException,
} from "../../common/exceptions/domain.exception";

describe("OrdersController (Integration via Supertest)", () => {
  let app: INestApplication;
  let checkoutService: jest.Mocked<ICheckoutService>;
  let tokenService: jest.Mocked<ITokenService>;

  const customerPayload = {
    sub: "11111111-1111-4111-8111-111111111111",
    email: "customer@vetralink.pro",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const adminPayload = {
    sub: "99999999-9999-4999-8999-999999999999",
    email: "admin@vetralink.pro",
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  };

  const validProductId = "44444444-4444-4444-8444-444444444444";
  const validOrderId = "22222222-2222-4222-8222-222222222222";
  const foreignOrderId = "77777777-7777-4777-8777-777777777777";

  const mockCheckoutResponse = {
    orderId: validOrderId,
    totalCents: 4900,
    currency: "USD",
    status: OrderStatus.PENDING,
    paymentGateway: "stripe",
    gatewayTxId: "pi_test_123",
    clientSecret: "pi_test_123_secret",
    checkoutUrl: "https://checkout.stripe.com/test",
    items: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        productId: validProductId,
        productTitle: "Clinical Cattle Protocol",
        priceCents: 4900,
        downloadToken: "55555555-5555-4555-8555-555555555555",
        downloadCount: 0,
        lastDownloadedAt: null,
      },
    ],
    createdAt: new Date().toISOString(),
  };

  const mockOrderDetail = {
    id: validOrderId,
    userId: customerPayload.sub,
    totalCents: 4900,
    currency: "USD",
    status: OrderStatus.PENDING,
    paymentGateway: "stripe",
    gatewayTxId: "pi_test_123",
    items: mockCheckoutResponse.items,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
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
        if (token === "customer-token") return customerPayload;
        if (token === "admin-token") return adminPayload;
        throw new Error("Invalid token");
      }),
      hashRefreshToken: jest.fn(),
      getRefreshTokenExpiresAt: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
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
      ],
    }).compile();

    app = moduleFixture.createNestApplication();

    const reflector = app.get(Reflector);
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );
    app.useGlobalInterceptors(new ResponseInterceptor(reflector));
    app.useGlobalFilters(new GlobalExceptionFilter());

    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("POST /orders/checkout", () => {
    it("should return 401 Unauthorized without auth token", async () => {
      const response = await request(app.getHttpServer())
        .post("/orders/checkout")
        .send({
          items: [{ productId: validProductId }],
        });

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should return 400 Bad Request if items array is empty", async () => {
      const response = await request(app.getHttpServer())
        .post("/orders/checkout")
        .set("Authorization", "Bearer customer-token")
        .send({
          items: [],
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should return 400 Bad Request if productId is not a valid UUID v4", async () => {
      const response = await request(app.getHttpServer())
        .post("/orders/checkout")
        .set("Authorization", "Bearer customer-token")
        .send({
          items: [{ productId: "not-a-uuid" }],
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should return 422 Unprocessable Entity when domain validation fails (e.g. duplicate or unavailable product)", async () => {
      checkoutService.checkout.mockRejectedValueOnce(
        new ValidationDomainException("Duplicate products in checkout are not allowed.")
      );

      const response = await request(app.getHttpServer())
        .post("/orders/checkout")
        .set("Authorization", "Bearer customer-token")
        .send({
          items: [{ productId: validProductId }],
        });

      expect(response.status).toBe(422);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("Duplicate products");
    });

    it("should return 201 Created and wrapped envelope when checkout succeeds", async () => {
      checkoutService.checkout.mockResolvedValueOnce(mockCheckoutResponse);

      const response = await request(app.getHttpServer())
        .post("/orders/checkout")
        .set("Authorization", "Bearer customer-token")
        .send({
          items: [{ productId: validProductId }],
          paymentGateway: "stripe",
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.orderId).toBe(mockCheckoutResponse.orderId);
      expect(response.body.data.totalCents).toBe(4900);
      expect(response.body.data.clientSecret).toBe("pi_test_123_secret");
      expect(response.body.data.items).toHaveLength(1);
    });
  });

  describe("GET /orders/my-orders", () => {
    it("should return 401 Unauthorized without auth token", async () => {
      const response = await request(app.getHttpServer()).get("/orders/my-orders");

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should return 200 OK with paginated orders list", async () => {
      checkoutService.getUserOrders.mockResolvedValueOnce({
        orders: [mockOrderDetail],
        total: 1,
      });

      const response = await request(app.getHttpServer())
        .get("/orders/my-orders?page=1&limit=10")
        .set("Authorization", "Bearer customer-token");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.orders).toHaveLength(1);
      expect(response.body.data.total).toBe(1);
    });
  });

  describe("GET /orders/:id", () => {
    it("should return 401 Unauthorized without auth token", async () => {
      const response = await request(app.getHttpServer()).get(
        `/orders/${validOrderId}`
      );

      expect(response.status).toBe(401);
      expect(response.body.success).toBe(false);
    });

    it("should return 400 Bad Request when ID is not a UUID", async () => {
      const response = await request(app.getHttpServer())
        .get("/orders/not-a-valid-uuid")
        .set("Authorization", "Bearer customer-token");

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it("should return 404 Not Found when order does not exist", async () => {
      checkoutService.getOrderById.mockRejectedValueOnce(
        new EntityNotFoundException("Order", foreignOrderId)
      );

      const response = await request(app.getHttpServer())
        .get(`/orders/${foreignOrderId}`)
        .set("Authorization", "Bearer customer-token");

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it("should return 403 Forbidden when customer accesses foreign order", async () => {
      checkoutService.getOrderById.mockRejectedValueOnce(
        new ForbiddenOperationException("You do not have permission to view this order.")
      );

      const response = await request(app.getHttpServer())
        .get(`/orders/${foreignOrderId}`)
        .set("Authorization", "Bearer customer-token");

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("permission");
    });

    it("should return 200 OK when owner accesses their own order", async () => {
      checkoutService.getOrderById.mockResolvedValueOnce(mockOrderDetail);

      const response = await request(app.getHttpServer())
        .get(`/orders/${validOrderId}`)
        .set("Authorization", "Bearer customer-token");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(validOrderId);
      expect(response.body.data.userId).toBe(customerPayload.sub);
    });

    it("should return 200 OK when admin accesses any order", async () => {
      checkoutService.getOrderById.mockResolvedValueOnce(mockOrderDetail);

      const response = await request(app.getHttpServer())
        .get(`/orders/${validOrderId}`)
        .set("Authorization", "Bearer admin-token");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(validOrderId);
    });
  });
});
