import { Test, TestingModule } from "@nestjs/testing";
import { Job } from "bullmq";
import { OrderDeliveryEmailJobData } from "@vetralink/shared-types";
import { MailProcessor } from "./mail.processor";
import {
  IMailService,
  MAIL_SERVICE,
} from "../interfaces/mail-service.interface";

describe("MailProcessor", () => {
  let processor: MailProcessor;
  let mailService: jest.Mocked<IMailService>;

  beforeEach(async () => {
    mailService = {
      sendEmail: jest.fn(),
      sendOrderFulfillmentEmail: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailProcessor,
        {
          provide: MAIL_SERVICE,
          useValue: mailService,
        },
      ],
    }).compile();

    processor = module.get<MailProcessor>(MailProcessor);
  });

  it("should process job, update progress, and return successful result", async () => {
    const mockJob = {
      id: "job-123",
      data: {
        orderId: "order-1111",
        recipientEmail: "farmer@vetralink.pro",
        recipientName: "John Farmer",
        traceId: "trace-999",
      },
      updateProgress: jest.fn().mockResolvedValue(undefined),
    } as unknown as Job<OrderDeliveryEmailJobData>;

    mailService.sendOrderFulfillmentEmail.mockResolvedValueOnce({
      success: true,
      messageId: "msg-777",
      provider: "mock",
    });

    const result = await processor.process(mockJob);

    expect(mockJob.updateProgress).toHaveBeenCalledWith(20);
    expect(mockJob.updateProgress).toHaveBeenCalledWith(100);
    expect(mailService.sendOrderFulfillmentEmail).toHaveBeenCalledWith(
      "order-1111",
      "farmer@vetralink.pro",
      "John Farmer",
      "trace-999"
    );
    expect(result.success).toBe(true);
    expect(result.messageId).toBe("msg-777");
  });

  it("should throw error if email dispatch fails so BullMQ can trigger retry", async () => {
    const mockJob = {
      id: "job-123",
      data: {
        orderId: "order-1111",
        recipientEmail: "farmer@vetralink.pro",
      },
      updateProgress: jest.fn().mockResolvedValue(undefined),
    } as unknown as Job<OrderDeliveryEmailJobData>;

    mailService.sendOrderFulfillmentEmail.mockResolvedValueOnce({
      success: false,
      provider: "resend",
      error: "API timeout",
    });

    await expect(processor.process(mockJob)).rejects.toThrow(
      "Email dispatch failed via resend: API timeout"
    );
  });
});
