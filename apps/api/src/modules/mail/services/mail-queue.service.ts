import { Injectable, Logger } from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { OrderDeliveryEmailJobData } from "@vetralink/shared-types";
import {
  IMailQueueService,
  MAIL_QUEUE_NAME,
} from "../interfaces/mail-service.interface";

@Injectable()
export class MailQueueService implements IMailQueueService {
  private readonly logger = new Logger(MailQueueService.name);

  constructor(
    @InjectQueue(MAIL_QUEUE_NAME)
    private readonly mailQueue: Queue<OrderDeliveryEmailJobData>
  ) {}

  public async enqueueOrderDeliveryEmail(
    orderId: string,
    recipientEmail: string,
    recipientName?: string,
    traceId?: string
  ): Promise<string> {
    const jobId = `mail:order:${orderId}:${Date.now()}`;

    const job = await this.mailQueue.add(
      "send-order-delivery",
      {
        orderId,
        recipientEmail,
        recipientName,
        traceId,
      },
      {
        jobId,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );

    this.logger.log(
      `[MailQueueService] Enqueued delivery email job [${job.id}] for order [${orderId}] -> <${recipientEmail}>`
    );

    return job.id!;
  }
}
