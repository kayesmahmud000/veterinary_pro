import { BadRequestException, INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import * as supertest from "supertest";

const request =
  typeof supertest === "function"
    ? supertest
    : ((supertest as any).default ?? supertest);

import { MfsWebhookController } from "./mfs-webhook.controller";
import {
  IMfsWebhookService,
  MFS_WEBHOOK_SERVICE,
  MfsWebhookResult,
} from "../services/mfs-webhook.service.interface";
import { ResponseInterceptor } from "../../../common/interceptors/response.interceptor";
import { GlobalExceptionFilter } from "../../../common/filters/global-exception.filter";

describe("MfsWebhookController (Integration via Supertest)", () => {
  let app: INestApplication;
  let mfsWebhookService: jest.Mocked<IMfsWebhookService>;

  beforeAll(async () => {
    mfsWebhookService = {
      processIpn: jest.fn(),
      processSslCommerz: jest.fn(),
      processBkash: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [MfsWebhookController],
      providers: [
        {
          provide: MFS_WEBHOOK_SERVICE,
          useValue: mfsWebhookService,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();

    const reflector = app.get(Reflector);
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

  describe("POST /orders/webhook/mfs", () => {
    it("should return 400 Bad Request when signature is invalid", async () => {
      mfsWebhookService.processIpn.mockRejectedValueOnce(
        new BadRequestException("Invalid MFS cryptographic signature.")
      );

      const response = await request(app.getHttpServer())
        .post("/orders/webhook/mfs")
        .set("x-mfs-signature", "invalid_sig")
        .send({
          provider: "generic",
          transactionId: "order-123",
          gatewayTxId: "tx-456",
          amountCents: 5000,
          status: "VALID",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("signature");
    });

    it("should return 400 Bad Request when amount is mismatched", async () => {
      mfsWebhookService.processIpn.mockRejectedValueOnce(
        new BadRequestException(
          "Payment amount mismatch: expected 5000 cents but received 1000 cents."
        )
      );

      const response = await request(app.getHttpServer())
        .post("/orders/webhook/mfs")
        .set("x-mfs-signature", "valid_sig")
        .send({
          provider: "generic",
          transactionId: "order-123",
          gatewayTxId: "tx-456",
          amountCents: 1000,
          status: "VALID",
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("amount mismatch");
    });

    it("should return 200 OK and settle order on valid generic IPN", async () => {
      const successResult: MfsWebhookResult = {
        received: true,
        provider: "generic",
        orderId: "order-123",
        gatewayTxId: "tx-456",
        status: "processed",
        message: "Order settled to COMPLETED",
      };

      mfsWebhookService.processIpn.mockResolvedValueOnce(successResult);

      const response = await request(app.getHttpServer())
        .post("/orders/webhook/mfs")
        .set("x-mfs-signature", "valid_sig")
        .send({
          provider: "generic",
          transactionId: "order-123",
          gatewayTxId: "tx-456",
          amountCents: 5000,
          status: "VALID",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("processed");
      expect(response.body.data.orderId).toBe("order-123");
    });

    it("should return 200 OK with already_processed on duplicate generic IPN", async () => {
      const duplicateResult: MfsWebhookResult = {
        received: true,
        provider: "generic",
        orderId: "order-123",
        gatewayTxId: "tx-456",
        status: "already_processed",
        message: "Order already completed",
      };

      mfsWebhookService.processIpn.mockResolvedValueOnce(duplicateResult);

      const response = await request(app.getHttpServer())
        .post("/orders/webhook/mfs")
        .set("x-mfs-signature", "valid_sig")
        .send({
          provider: "generic",
          transactionId: "order-123",
          gatewayTxId: "tx-456",
          amountCents: 5000,
          status: "VALID",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("already_processed");
    });
  });

  describe("POST /orders/webhook/sslcommerz", () => {
    it("should return 200 OK and settle order on VALID status", async () => {
      const sslResult: MfsWebhookResult = {
        received: true,
        provider: "sslcommerz",
        orderId: "order-123",
        gatewayTxId: "val-789",
        status: "processed",
        message: "Order settled to COMPLETED",
      };

      mfsWebhookService.processSslCommerz.mockResolvedValueOnce(sslResult);

      const response = await request(app.getHttpServer())
        .post("/orders/webhook/sslcommerz")
        .send({
          tran_id: "order-123",
          val_id: "val-789",
          amount: "50.00",
          status: "VALID",
          verify_sign: "sign-abc",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.provider).toBe("sslcommerz");
      expect(response.body.data.status).toBe("processed");
    });

    it("should return 200 OK and settle order to FAILED on FAILED status", async () => {
      const sslFailedResult: MfsWebhookResult = {
        received: true,
        provider: "sslcommerz",
        orderId: "order-123",
        gatewayTxId: "val-789",
        status: "processed",
        message: "Order marked as FAILED",
      };

      mfsWebhookService.processSslCommerz.mockResolvedValueOnce(sslFailedResult);

      const response = await request(app.getHttpServer())
        .post("/orders/webhook/sslcommerz")
        .send({
          tran_id: "order-123",
          val_id: "val-789",
          amount: "50.00",
          status: "FAILED",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain("FAILED");
    });
  });

  describe("POST /orders/webhook/bkash", () => {
    it("should return 200 OK and settle order on Completed status", async () => {
      const bkashResult: MfsWebhookResult = {
        received: true,
        provider: "bkash",
        orderId: "order-123",
        gatewayTxId: "trx-999",
        status: "processed",
        message: "Order settled to COMPLETED",
      };

      mfsWebhookService.processBkash.mockResolvedValueOnce(bkashResult);

      const response = await request(app.getHttpServer())
        .post("/orders/webhook/bkash")
        .send({
          paymentID: "order-123",
          trxID: "trx-999",
          amount: 50,
          transactionStatus: "Completed",
          signature: "bkash-sig",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.provider).toBe("bkash");
      expect(response.body.data.status).toBe("processed");
    });

    it("should return 200 OK and settle order to FAILED on Failed status", async () => {
      const bkashFailedResult: MfsWebhookResult = {
        received: true,
        provider: "bkash",
        orderId: "order-123",
        gatewayTxId: "trx-999",
        status: "processed",
        message: "Order marked as FAILED",
      };

      mfsWebhookService.processBkash.mockResolvedValueOnce(bkashFailedResult);

      const response = await request(app.getHttpServer())
        .post("/orders/webhook/bkash")
        .send({
          paymentID: "order-123",
          trxID: "trx-999",
          amount: 50,
          transactionStatus: "Failed",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain("FAILED");
    });
  });
});
