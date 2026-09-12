import { Test, TestingModule } from "@nestjs/testing";
import { MfsWebhookController } from "./mfs-webhook.controller";
import {
  IMfsWebhookService,
  MFS_WEBHOOK_SERVICE,
  MfsWebhookResult,
} from "../services/mfs-webhook.service.interface";

describe("MfsWebhookController", () => {
  let controller: MfsWebhookController;
  let webhookService: jest.Mocked<IMfsWebhookService>;

  const mockResult: MfsWebhookResult = {
    received: true,
    provider: "sslcommerz",
    orderId: "order-123",
    gatewayTxId: "tx-456",
    status: "processed",
    message: "Order settled to COMPLETED",
  };

  beforeEach(async () => {
    webhookService = {
      processIpn: jest.fn(),
      processSslCommerz: jest.fn(),
      processBkash: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [MfsWebhookController],
      providers: [
        {
          provide: MFS_WEBHOOK_SERVICE,
          useValue: webhookService,
        },
      ],
    }).compile();

    controller = module.get<MfsWebhookController>(MfsWebhookController);
  });

  it("should delegate handleGenericMfsIpn to MfsWebhookService", async () => {
    webhookService.processIpn.mockResolvedValueOnce(mockResult);

    const payload = {
      provider: "sslcommerz",
      transactionId: "order-123",
      gatewayTxId: "tx-456",
      amountCents: 5000,
      status: "VALID" as const,
    };

    const result = await controller.handleGenericMfsIpn(
      payload,
      "sig-1",
      "trace-1"
    );

    expect(webhookService.processIpn).toHaveBeenCalledWith(
      payload,
      "sig-1",
      "trace-1"
    );
    expect(result).toEqual(mockResult);
  });

  it("should delegate handleSslCommerzIpn to MfsWebhookService", async () => {
    webhookService.processSslCommerz.mockResolvedValueOnce(mockResult);

    const payload = {
      tran_id: "order-123",
      val_id: "tx-456",
      amount: "50.00",
      status: "VALID",
    };

    const result = await controller.handleSslCommerzIpn(
      payload,
      "sig-1",
      "trace-1"
    );

    expect(webhookService.processSslCommerz).toHaveBeenCalledWith(
      payload,
      "sig-1",
      "trace-1"
    );
    expect(result).toEqual(mockResult);
  });

  it("should delegate handleBkashCallback to MfsWebhookService", async () => {
    webhookService.processBkash.mockResolvedValueOnce(mockResult);

    const payload = {
      paymentID: "order-123",
      trxID: "tx-456",
      amount: 50,
      transactionStatus: "Completed",
    };

    const result = await controller.handleBkashCallback(
      payload,
      "sig-1",
      "trace-1"
    );

    expect(webhookService.processBkash).toHaveBeenCalledWith(
      payload,
      "sig-1",
      "trace-1"
    );
    expect(result).toEqual(mockResult);
  });
});
