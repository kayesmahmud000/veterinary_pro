import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { OrderStatus } from "@vetralink/shared-types";
import { StripeWebhookService } from "./stripe-webhook.service";
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
import { EnvService } from "../../../config/env.service";
import { OrderEntity } from "../entities/order.entity";

const mockConstructEvent = jest.fn();

jest.mock("stripe", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => {
      return {
        webhooks: {
          constructEvent: (...args: unknown[]) => mockConstructEvent(...args),
        },
      };
    }),
  };
});

describe("StripeWebhookService", () => {
  let service: StripeWebhookService;
  let orderRepository: jest.Mocked<IOrderRepository>;
  let transactionManager: jest.Mocked<ITransactionManager>;
  let auditLogRepository: jest.Mocked<IAuditLogRepository>;
  let envService: jest.Mocked<EnvService>;

  const mockOrderId = "order-uuid-1111";
  const mockGatewayTxId = "pi_stripe_1111";

  beforeEach(async () => {
    mockConstructEvent.mockReset();

    envService = {
      stripeSecretKey: "sk_test_123",
      stripeWebhookSecret: "whsec_test_123",
      nodeEnv: "test",
    } as unknown as jest.Mocked<EnvService>;

    orderRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByGatewayTxId: jest.fn(),
      findUserOrders: jest.fn(),
      updateStatus: jest.fn(),
    };

    transactionManager = {
      run: jest.fn().mockImplementation(async (callback) => {
        return callback({} as never);
      }),
    };

    auditLogRepository = {
      record: jest.fn(),
    } as unknown as jest.Mocked<IAuditLogRepository>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StripeWebhookService,
        {
          provide: EnvService,
          useValue: envService,
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
      ],
    }).compile();

    service = module.get<StripeWebhookService>(StripeWebhookService);
  });

  describe("signature verification", () => {
    it("should throw BadRequestException when stripe signature fails", async () => {
      mockConstructEvent.mockImplementation(() => {
        throw new Error("Signature verification failed");
      });

      const buffer = Buffer.from(JSON.stringify({ id: "evt_1" }));
      await expect(
        service.processWebhook(buffer, "invalid-sig")
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException in production if secret is missing", async () => {
      (envService as any).stripeWebhookSecret = undefined;
      (envService as any).nodeEnv = "production";

      const buffer = Buffer.from(JSON.stringify({ id: "evt_1" }));
      await expect(
        service.processWebhook(buffer, "sig")
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("payment_intent.succeeded", () => {
    const succeededEvent = {
      id: "evt_succeeded_1",
      type: "payment_intent.succeeded",
      data: {
        object: {
          id: mockGatewayTxId,
          metadata: { orderId: mockOrderId },
        },
      },
    };

    it("should settle order to COMPLETED and emit audit log inside transaction", async () => {
      mockConstructEvent.mockReturnValue(succeededEvent);

      const pendingOrder = OrderEntity.create({
        id: mockOrderId,
        userId: "user-1",
        totalCents: 4900,
        status: OrderStatus.PENDING,
        gatewayTxId: mockGatewayTxId,
      });

      orderRepository.findById.mockResolvedValueOnce(pendingOrder);
      orderRepository.updateStatus.mockResolvedValueOnce(pendingOrder);

      const result = await service.processWebhook(
        Buffer.from("payload"),
        "sig-1"
      );

      expect(result.status).toBe("processed");
      expect(result.orderId).toBe(mockOrderId);
      expect(transactionManager.run).toHaveBeenCalled();
      expect(orderRepository.updateStatus).toHaveBeenCalledWith(
        mockOrderId,
        OrderStatus.COMPLETED,
        mockGatewayTxId,
        expect.anything()
      );
      expect(auditLogRepository.record).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: "user-1",
          action: "ORDER_COMPLETED",
          entityId: mockOrderId,
        }),
        expect.anything()
      );
    });

    it("should return already_processed if order is already COMPLETED (idempotency guard)", async () => {
      mockConstructEvent.mockReturnValue(succeededEvent);

      const completedOrder = OrderEntity.create({
        id: mockOrderId,
        userId: "user-1",
        totalCents: 4900,
        status: OrderStatus.COMPLETED,
        gatewayTxId: mockGatewayTxId,
      });

      orderRepository.findById.mockResolvedValueOnce(completedOrder);

      const result = await service.processWebhook(
        Buffer.from("payload"),
        "sig-1"
      );

      expect(result.status).toBe("already_processed");
      expect(result.orderId).toBe(mockOrderId);
      expect(transactionManager.run).not.toHaveBeenCalled();
      expect(orderRepository.updateStatus).not.toHaveBeenCalled();
    });

    it("should return ignored if order is not found", async () => {
      mockConstructEvent.mockReturnValue(succeededEvent);

      orderRepository.findById.mockResolvedValueOnce(null);
      orderRepository.findByGatewayTxId.mockResolvedValueOnce(null);

      const result = await service.processWebhook(
        Buffer.from("payload"),
        "sig-1"
      );

      expect(result.status).toBe("ignored");
      expect(transactionManager.run).not.toHaveBeenCalled();
    });
  });

  describe("payment_intent.payment_failed", () => {
    const failedEvent = {
      id: "evt_failed_1",
      type: "payment_intent.payment_failed",
      data: {
        object: {
          id: mockGatewayTxId,
          metadata: { orderId: mockOrderId },
          last_payment_error: { message: "Card declined" },
        },
      },
    };

    it("should mark order as FAILED and record audit log inside transaction", async () => {
      mockConstructEvent.mockReturnValue(failedEvent);

      const pendingOrder = OrderEntity.create({
        id: mockOrderId,
        userId: "user-1",
        totalCents: 4900,
        status: OrderStatus.PENDING,
        gatewayTxId: mockGatewayTxId,
      });

      orderRepository.findById.mockResolvedValueOnce(pendingOrder);
      orderRepository.updateStatus.mockResolvedValueOnce(pendingOrder);

      const result = await service.processWebhook(
        Buffer.from("payload"),
        "sig-1"
      );

      expect(result.status).toBe("processed");
      expect(transactionManager.run).toHaveBeenCalled();
      expect(orderRepository.updateStatus).toHaveBeenCalledWith(
        mockOrderId,
        OrderStatus.FAILED,
        mockGatewayTxId,
        expect.anything()
      );
    });

    it("should return already_processed if order is already FAILED", async () => {
      mockConstructEvent.mockReturnValue(failedEvent);

      const failedOrder = OrderEntity.create({
        id: mockOrderId,
        userId: "user-1",
        totalCents: 4900,
        status: OrderStatus.FAILED,
        gatewayTxId: mockGatewayTxId,
      });

      orderRepository.findById.mockResolvedValueOnce(failedOrder);

      const result = await service.processWebhook(
        Buffer.from("payload"),
        "sig-1"
      );

      expect(result.status).toBe("already_processed");
      expect(transactionManager.run).not.toHaveBeenCalled();
    });
  });

  describe("charge.refunded", () => {
    const refundedEvent = {
      id: "evt_refund_1",
      type: "charge.refunded",
      data: {
        object: {
          id: "ch_123",
          payment_intent: mockGatewayTxId,
          amount_refunded: 4900,
        },
      },
    };

    it("should mark order as REFUNDED and emit audit log inside transaction", async () => {
      mockConstructEvent.mockReturnValue(refundedEvent);

      const completedOrder = OrderEntity.create({
        id: mockOrderId,
        userId: "user-1",
        totalCents: 4900,
        status: OrderStatus.COMPLETED,
        gatewayTxId: mockGatewayTxId,
      });

      orderRepository.findByGatewayTxId.mockResolvedValueOnce(completedOrder);
      orderRepository.updateStatus.mockResolvedValueOnce(completedOrder);

      const result = await service.processWebhook(
        Buffer.from("payload"),
        "sig-1"
      );

      expect(result.status).toBe("processed");
      expect(transactionManager.run).toHaveBeenCalled();
      expect(orderRepository.updateStatus).toHaveBeenCalledWith(
        mockOrderId,
        OrderStatus.REFUNDED,
        undefined,
        expect.anything()
      );
    });
  });

  describe("unhandled events", () => {
    it("should safely ignore unknown events with status ignored", async () => {
      mockConstructEvent.mockReturnValue({
        id: "evt_unknown_1",
        type: "customer.created",
        data: { object: {} },
      });

      const result = await service.processWebhook(
        Buffer.from("payload"),
        "sig-1"
      );

      expect(result.received).toBe(true);
      expect(result.status).toBe("ignored");
      expect(transactionManager.run).not.toHaveBeenCalled();
    });
  });
});
