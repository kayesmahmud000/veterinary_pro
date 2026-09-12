import { Test, TestingModule } from "@nestjs/testing";
import { OrderStatus, UserRole, UserStatus } from "@vetralink/shared-types";
import { OrdersController } from "./orders.controller";
import {
  ICheckoutService,
  CHECKOUT_SERVICE,
} from "./services/checkout.service.interface";
import { TOKEN_SERVICE } from "../auth/services/token.service.interface";
import { Reflector } from "@nestjs/core";
import { IDEMPOTENCY_SERVICE } from "../../common/idempotency";

describe("OrdersController", () => {
  let controller: OrdersController;
  let checkoutService: jest.Mocked<ICheckoutService>;

  const mockUser = {
    sub: "user-1111-1111-1111-111111111111",
    email: "farmer@vetralink.pro",
    role: UserRole.FARMER,
    status: UserStatus.ACTIVE,
  };

  const mockAdmin = {
    sub: "admin-1111-1111-1111-111111111111",
    email: "admin@vetralink.pro",
    role: UserRole.ADMIN,
    status: UserStatus.ACTIVE,
  };

  const mockCheckoutResponse = {
    orderId: "order-1111-1111-1111-111111111111",
    totalCents: 4900,
    currency: "USD",
    status: OrderStatus.PENDING,
    paymentGateway: "stripe",
    gatewayTxId: "pi_stripe_123",
    clientSecret: "pi_stripe_123_secret",
    checkoutUrl: "https://checkout.stripe.com/pay/123",
    items: [
      {
        id: "item-1",
        productId: "prod-1",
        productTitle: "Veterinary Handbook",
        priceCents: 4900,
        downloadToken: "dl-token-1",
        downloadCount: 0,
        lastDownloadedAt: null,
      },
    ],
    createdAt: new Date().toISOString(),
  };

  const mockOrderDetail = {
    id: "order-1111-1111-1111-111111111111",
    userId: mockUser.sub,
    totalCents: 4900,
    currency: "USD",
    status: OrderStatus.PENDING,
    paymentGateway: "stripe",
    gatewayTxId: "pi_stripe_123",
    items: mockCheckoutResponse.items,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  beforeEach(async () => {
    checkoutService = {
      checkout: jest.fn(),
      getOrderById: jest.fn(),
      getUserOrders: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: CHECKOUT_SERVICE,
          useValue: checkoutService,
        },
        {
          provide: TOKEN_SERVICE,
          useValue: {
            verifyAccessToken: jest.fn(),
          },
        },
        {
          provide: IDEMPOTENCY_SERVICE,
          useValue: {
            execute: jest.fn().mockImplementation((_k, _p, _t, fn) => fn()),
          },
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
  });

  describe("checkout", () => {
    it("should delegate checkout call to CheckoutService", async () => {
      checkoutService.checkout.mockResolvedValueOnce(mockCheckoutResponse);

      const dto = {
        items: [{ productId: "prod-1" }],
        paymentGateway: "stripe",
      };

      const result = await controller.checkout(
        mockUser,
        dto,
        "trace-uuid-123",
        "127.0.0.1"
      );

      expect(checkoutService.checkout).toHaveBeenCalledWith(
        mockUser.sub,
        dto,
        mockUser.email,
        "trace-uuid-123",
        "127.0.0.1"
      );
      expect(result).toEqual(mockCheckoutResponse);
    });
  });

  describe("getMyOrders", () => {
    it("should query user orders with pagination defaults", async () => {
      checkoutService.getUserOrders.mockResolvedValueOnce({
        orders: [mockOrderDetail],
        total: 1,
      });

      const result = await controller.getMyOrders(mockUser, "1", "10");

      expect(checkoutService.getUserOrders).toHaveBeenCalledWith(
        mockUser.sub,
        1,
        10
      );
      expect(result.orders).toHaveLength(1);
      expect(result.total).toBe(1);
    });
  });

  describe("getOrderById", () => {
    it("should call getOrderById with isAdmin=false for regular user", async () => {
      checkoutService.getOrderById.mockResolvedValueOnce(mockOrderDetail);

      const result = await controller.getOrderById(mockUser, mockOrderDetail.id);

      expect(checkoutService.getOrderById).toHaveBeenCalledWith(
        mockOrderDetail.id,
        mockUser.sub,
        false
      );
      expect(result).toEqual(mockOrderDetail);
    });

    it("should call getOrderById with isAdmin=true for admin user", async () => {
      checkoutService.getOrderById.mockResolvedValueOnce(mockOrderDetail);

      const result = await controller.getOrderById(mockAdmin, mockOrderDetail.id);

      expect(checkoutService.getOrderById).toHaveBeenCalledWith(
        mockOrderDetail.id,
        mockAdmin.sub,
        true
      );
      expect(result).toEqual(mockOrderDetail);
    });
  });
});
