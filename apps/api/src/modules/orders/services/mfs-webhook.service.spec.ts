import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import * as crypto from "crypto";
import { OrderStatus } from "@vetralink/shared-types";
import { MfsWebhookService } from "./mfs-webhook.service";
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

describe("MfsWebhookService", () => {
  let service: MfsWebhookService;
  let orderRepository: jest.Mocked<IOrderRepository>;
  let transactionManager: jest.Mocked<ITransactionManager>;
  let auditLogRepository: jest.Mocked<IAuditLogRepository>;
  let envService: jest.Mocked<EnvService>;

  const secret = "test_secret_key_for_mfs_webhooks";
  const mockOrderId = "order-uuid-mfs-1";
  const mockTxId = "val_id_9999";
  const orderAmountCents = 5000;

  function generateValidSignature(orderId: string, amountCents: number, txId: string): string {
    return crypto
      .createHmac("sha256", secret)
      .update(`${orderId}:${amountCents}:${txId}`)
      .digest("hex");
  }

  beforeEach(async () => {
    envService = {
      mfsWebhookSecret: secret,
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
        MfsWebhookService,
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

    service = module.get<MfsWebhookService>(MfsWebhookService);
  });

  describe("signature verification", () => {
    it("should throw BadRequestException when signature is invalid", async () => {
      await expect(
        service.processIpn({
          provider: "generic",
          transactionId: mockOrderId,
          gatewayTxId: mockTxId,
          amountCents: orderAmountCents,
          status: "VALID",
          signature: "invalid_sig",
        })
      ).rejects.toThrow(BadRequestException);
    });

    it("should throw BadRequestException when signature is missing in production", async () => {
      (envService as any).nodeEnv = "production";

      await expect(
        service.processIpn({
          provider: "generic",
          transactionId: mockOrderId,
          gatewayTxId: mockTxId,
          amountCents: orderAmountCents,
          status: "VALID",
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("amount verification (underpayment defense)", () => {
    it("should throw BadRequestException when paid amount does not match order total", async () => {
      const order = OrderEntity.create({
        id: mockOrderId,
        userId: "user-1",
        totalCents: orderAmountCents,
        status: OrderStatus.PENDING,
      });

      orderRepository.findById.mockResolvedValueOnce(order);

      const tamperedAmountCents = 1000;
      const signature = generateValidSignature(mockOrderId, tamperedAmountCents, mockTxId);

      await expect(
        service.processIpn({
          provider: "generic",
          transactionId: mockOrderId,
          gatewayTxId: mockTxId,
          amountCents: tamperedAmountCents,
          status: "VALID",
          signature,
        })
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe("processSslCommerz", () => {
    it("should settle order to COMPLETED on VALID status", async () => {
      const order = OrderEntity.create({
        id: mockOrderId,
        userId: "user-1",
        totalCents: orderAmountCents,
        status: OrderStatus.PENDING,
      });

      orderRepository.findById.mockResolvedValueOnce(order);
      orderRepository.updateStatus.mockResolvedValueOnce(order);

      const signature = generateValidSignature(mockOrderId, orderAmountCents, mockTxId);

      const result = await service.processSslCommerz({
        tran_id: mockOrderId,
        val_id: mockTxId,
        amount: "50.00",
        currency: "BDT",
        status: "VALID",
        verify_sign: signature,
      });

      expect(result.status).toBe("processed");
      expect(result.orderId).toBe(mockOrderId);
      expect(transactionManager.run).toHaveBeenCalled();
      expect(orderRepository.updateStatus).toHaveBeenCalledWith(
        mockOrderId,
        OrderStatus.COMPLETED,
        mockTxId,
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

    it("should return already_processed when order is already COMPLETED (idempotency)", async () => {
      const order = OrderEntity.create({
        id: mockOrderId,
        userId: "user-1",
        totalCents: orderAmountCents,
        status: OrderStatus.COMPLETED,
      });

      orderRepository.findById.mockResolvedValueOnce(order);
      const signature = generateValidSignature(mockOrderId, orderAmountCents, mockTxId);

      const result = await service.processSslCommerz({
        tran_id: mockOrderId,
        val_id: mockTxId,
        amount: "50.00",
        status: "VALID",
        verify_sign: signature,
      });

      expect(result.status).toBe("already_processed");
      expect(transactionManager.run).not.toHaveBeenCalled();
    });
  });

  describe("processBkash", () => {
    it("should settle order to COMPLETED on Completed status", async () => {
      const order = OrderEntity.create({
        id: mockOrderId,
        userId: "user-1",
        totalCents: orderAmountCents,
        status: OrderStatus.PENDING,
      });

      orderRepository.findById.mockResolvedValueOnce(order);
      orderRepository.updateStatus.mockResolvedValueOnce(order);

      const signature = generateValidSignature(mockOrderId, orderAmountCents, mockTxId);

      const result = await service.processBkash({
        paymentID: mockOrderId,
        trxID: mockTxId,
        amount: 50,
        transactionStatus: "Completed",
        signature,
      });

      expect(result.status).toBe("processed");
      expect(transactionManager.run).toHaveBeenCalled();
      expect(orderRepository.updateStatus).toHaveBeenCalledWith(
        mockOrderId,
        OrderStatus.COMPLETED,
        mockTxId,
        expect.anything()
      );
    });

    it("should settle order to FAILED on Failed transactionStatus", async () => {
      const order = OrderEntity.create({
        id: mockOrderId,
        userId: "user-1",
        totalCents: orderAmountCents,
        status: OrderStatus.PENDING,
      });

      orderRepository.findById.mockResolvedValueOnce(order);
      orderRepository.updateStatus.mockResolvedValueOnce(order);

      const signature = generateValidSignature(mockOrderId, orderAmountCents, mockTxId);

      const result = await service.processBkash({
        paymentID: mockOrderId,
        trxID: mockTxId,
        amount: 50,
        transactionStatus: "Failed",
        signature,
      });

      expect(result.status).toBe("processed");
      expect(result.message).toContain("FAILED");
      expect(transactionManager.run).toHaveBeenCalled();
      expect(orderRepository.updateStatus).toHaveBeenCalledWith(
        mockOrderId,
        OrderStatus.FAILED,
        mockTxId,
        expect.anything()
      );
    });
  });

  describe("unknown order", () => {
    it("should return ignored status when order does not exist", async () => {
      orderRepository.findById.mockResolvedValueOnce(null);
      orderRepository.findByGatewayTxId.mockResolvedValueOnce(null);

      const signature = generateValidSignature("unknown-id", orderAmountCents, mockTxId);

      const result = await service.processIpn({
        provider: "generic",
        transactionId: "unknown-id",
        gatewayTxId: mockTxId,
        amountCents: orderAmountCents,
        status: "VALID",
        signature,
      });

      expect(result.status).toBe("ignored");
      expect(transactionManager.run).not.toHaveBeenCalled();
    });
  });
});
