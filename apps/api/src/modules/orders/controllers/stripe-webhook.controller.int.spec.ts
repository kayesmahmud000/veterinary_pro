import { BadRequestException, INestApplication } from "@nestjs/common";
import { Test, TestingModule } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import * as supertest from "supertest";

const request =
  typeof supertest === "function"
    ? supertest
    : ((supertest as any).default ?? supertest);

import { StripeWebhookController } from "./stripe-webhook.controller";
import {
  IStripeWebhookService,
  STRIPE_WEBHOOK_SERVICE,
  WebhookProcessingResult,
} from "../services/stripe-webhook.service.interface";
import { ResponseInterceptor } from "../../../common/interceptors/response.interceptor";
import { GlobalExceptionFilter } from "../../../common/filters/global-exception.filter";

describe("StripeWebhookController (Integration via Supertest)", () => {
  let app: INestApplication;
  let stripeWebhookService: jest.Mocked<IStripeWebhookService>;

  beforeAll(async () => {
    stripeWebhookService = {
      processWebhook: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [StripeWebhookController],
      providers: [
        {
          provide: STRIPE_WEBHOOK_SERVICE,
          useValue: stripeWebhookService,
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

  describe("POST /orders/webhook/stripe", () => {
    it("should return 400 Bad Request when stripe-signature header is missing", async () => {
      const response = await request(app.getHttpServer())
        .post("/orders/webhook/stripe")
        .send({ id: "evt_123" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("stripe-signature");
    });

    it("should return 400 Bad Request when signature is invalid or tampered", async () => {
      stripeWebhookService.processWebhook.mockRejectedValueOnce(
        new BadRequestException("Stripe signature verification failed: No signatures found matching the expected signature for payload")
      );

      const response = await request(app.getHttpServer())
        .post("/orders/webhook/stripe")
        .set("stripe-signature", "t=123,v1=invalid_signature")
        .send({ id: "evt_tampered" });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain("verification failed");
    });

    it("should return 200 OK and settle order to COMPLETED on payment_intent.succeeded", async () => {
      const successResult: WebhookProcessingResult = {
        received: true,
        eventId: "evt_succeeded_100",
        eventType: "payment_intent.succeeded",
        orderId: "22222222-2222-4222-8222-222222222222",
        status: "processed",
        message: "Order settled to COMPLETED",
      };

      stripeWebhookService.processWebhook.mockResolvedValueOnce(successResult);

      const response = await request(app.getHttpServer())
        .post("/orders/webhook/stripe")
        .set("stripe-signature", "t=123,v1=valid_sig")
        .send({
          id: "evt_succeeded_100",
          type: "payment_intent.succeeded",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("processed");
      expect(response.body.data.orderId).toBe("22222222-2222-4222-8222-222222222222");
    });

    it("should return 200 OK with already_processed status on duplicate webhook delivery (idempotency)", async () => {
      const duplicateResult: WebhookProcessingResult = {
        received: true,
        eventId: "evt_succeeded_100",
        eventType: "payment_intent.succeeded",
        orderId: "22222222-2222-4222-8222-222222222222",
        status: "already_processed",
        message: "Order already completed",
      };

      stripeWebhookService.processWebhook.mockResolvedValueOnce(duplicateResult);

      const response = await request(app.getHttpServer())
        .post("/orders/webhook/stripe")
        .set("stripe-signature", "t=123,v1=valid_sig")
        .send({
          id: "evt_succeeded_100",
          type: "payment_intent.succeeded",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("already_processed");
    });

    it("should return 200 OK and settle order to FAILED on payment_intent.payment_failed", async () => {
      const failedResult: WebhookProcessingResult = {
        received: true,
        eventId: "evt_failed_200",
        eventType: "payment_intent.payment_failed",
        orderId: "22222222-2222-4222-8222-222222222222",
        status: "processed",
        message: "Order marked as FAILED",
      };

      stripeWebhookService.processWebhook.mockResolvedValueOnce(failedResult);

      const response = await request(app.getHttpServer())
        .post("/orders/webhook/stripe")
        .set("stripe-signature", "t=123,v1=valid_sig")
        .send({
          id: "evt_failed_200",
          type: "payment_intent.payment_failed",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("processed");
      expect(response.body.data.orderId).toBe("22222222-2222-4222-8222-222222222222");
    });

    it("should return 200 OK with ignored status for unhandled event types", async () => {
      const ignoredResult: WebhookProcessingResult = {
        received: true,
        eventId: "evt_unknown_300",
        eventType: "customer.subscription.created",
        status: "ignored",
        message: "Unhandled event type",
      };

      stripeWebhookService.processWebhook.mockResolvedValueOnce(ignoredResult);

      const response = await request(app.getHttpServer())
        .post("/orders/webhook/stripe")
        .set("stripe-signature", "t=123,v1=valid_sig")
        .send({
          id: "evt_unknown_300",
          type: "customer.subscription.created",
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe("ignored");
    });
  });
});
