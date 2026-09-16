import { BadRequestException } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { SubscriptionWebhookResultDto } from "@vetralink/shared-types";
import { Request } from "express";
import {
  ISubscriptionWebhookService,
  SUBSCRIPTION_WEBHOOK_SERVICE,
} from "../services/subscription-webhook.service.interface";
import { SubscriptionWebhookController } from "./subscription-webhook.controller";

describe("SubscriptionWebhookController", () => {
  let controller: SubscriptionWebhookController;
  let webhookService: jest.Mocked<ISubscriptionWebhookService>;

  const mockResult: SubscriptionWebhookResultDto = {
    received: true,
    eventId: "evt_sub_test_123",
    eventType: "invoice.payment_failed",
    subscriptionId: "sub-123",
    status: "settled",
    message: "Subscription 'sub-123' marked PAST_DUE after renewal payment failure.",
  };

  beforeEach(async () => {
    webhookService = {
      processWebhook: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [SubscriptionWebhookController],
      providers: [
        {
          provide: SUBSCRIPTION_WEBHOOK_SERVICE,
          useValue: webhookService,
        },
      ],
    }).compile();

    controller = module.get<SubscriptionWebhookController>(
      SubscriptionWebhookController,
    );
  });

  it("should throw BadRequestException if stripe-signature header is missing", async () => {
    const mockReq = {
      rawBody: Buffer.from("payload"),
    } as unknown as Request & { rawBody?: Buffer };

    await expect(
      controller.handleStripeWebhook(undefined, mockReq),
    ).rejects.toThrow(BadRequestException);
  });

  it("should throw BadRequestException if rawBody and body are missing", async () => {
    const mockReq = {} as unknown as Request & { rawBody?: Buffer };

    await expect(
      controller.handleStripeWebhook("valid-sig", mockReq),
    ).rejects.toThrow(BadRequestException);
  });

  it("should delegate to SubscriptionWebhookService when signature and rawBody are present", async () => {
    webhookService.processWebhook.mockResolvedValueOnce(mockResult);

    const buffer = Buffer.from("payload");
    const mockReq = {
      rawBody: buffer,
    } as unknown as Request & { rawBody?: Buffer };

    const result = await controller.handleStripeWebhook(
      "valid-sig",
      mockReq,
      "trace-123",
    );

    expect(webhookService.processWebhook).toHaveBeenCalledWith(
      buffer,
      "valid-sig",
      "trace-123",
    );
    expect(result).toEqual(mockResult);
  });

  it("should construct buffer from req.body string or object when req.rawBody is absent", async () => {
    webhookService.processWebhook.mockResolvedValueOnce(mockResult);

    const payloadObj = { id: "evt_123" };
    const mockReq = {
      body: payloadObj,
    } as unknown as Request & { rawBody?: Buffer };

    const result = await controller.handleStripeWebhook(
      "valid-sig",
      mockReq,
    );

    expect(webhookService.processWebhook).toHaveBeenCalledWith(
      Buffer.from(JSON.stringify(payloadObj), "utf-8"),
      "valid-sig",
      undefined,
    );
    expect(result).toEqual(mockResult);
  });
});
