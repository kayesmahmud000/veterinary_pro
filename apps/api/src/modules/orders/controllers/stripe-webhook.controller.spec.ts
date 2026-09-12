import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Request } from "express";
import { StripeWebhookController } from "./stripe-webhook.controller";
import {
  IStripeWebhookService,
  STRIPE_WEBHOOK_SERVICE,
  WebhookProcessingResult,
} from "../services/stripe-webhook.service.interface";

describe("StripeWebhookController", () => {
  let controller: StripeWebhookController;
  let webhookService: jest.Mocked<IStripeWebhookService>;

  const mockResult: WebhookProcessingResult = {
    received: true,
    eventId: "evt_test_123",
    eventType: "payment_intent.succeeded",
    orderId: "order-123",
    status: "processed",
    message: "Order settled to COMPLETED",
  };

  beforeEach(async () => {
    webhookService = {
      processWebhook: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [StripeWebhookController],
      providers: [
        {
          provide: STRIPE_WEBHOOK_SERVICE,
          useValue: webhookService,
        },
      ],
    }).compile();

    controller = module.get<StripeWebhookController>(StripeWebhookController);
  });

  it("should throw BadRequestException if stripe-signature header is missing", async () => {
    const mockReq = {
      rawBody: Buffer.from("payload"),
    } as unknown as Request & { rawBody?: Buffer };

    await expect(
      controller.handleStripeWebhook(undefined, mockReq)
    ).rejects.toThrow(BadRequestException);
  });

  it("should throw BadRequestException if rawBody and body are missing", async () => {
    const mockReq = {} as unknown as Request & { rawBody?: Buffer };

    await expect(
      controller.handleStripeWebhook("valid-sig", mockReq)
    ).rejects.toThrow(BadRequestException);
  });

  it("should delegate to StripeWebhookService when signature and rawBody are present", async () => {
    webhookService.processWebhook.mockResolvedValueOnce(mockResult);

    const buffer = Buffer.from("payload");
    const mockReq = {
      rawBody: buffer,
    } as unknown as Request & { rawBody?: Buffer };

    const result = await controller.handleStripeWebhook(
      "valid-sig",
      mockReq,
      "trace-123"
    );

    expect(webhookService.processWebhook).toHaveBeenCalledWith(
      buffer,
      "valid-sig",
      "trace-123"
    );
    expect(result).toEqual(mockResult);
  });
});
