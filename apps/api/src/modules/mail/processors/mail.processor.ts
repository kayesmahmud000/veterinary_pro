import { Inject, Injectable, Logger } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { OrderDeliveryEmailJobData } from "@vetralink/shared-types";
import {
  IMailService,
  MAIL_SERVICE,
  MAIL_QUEUE_NAME,
} from "../interfaces/mail-service.interface";
import { EmailSendResult } from "../interfaces/mail-provider.interface";

@Injectable()
@Processor(MAIL_QUEUE_NAME)
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(
    @Inject(MAIL_SERVICE)
    private readonly mailService: IMailService
  ) {
    super();
  }

  public async process(
    job: Job<OrderDeliveryEmailJobData>
  ): Promise<EmailSendResult> {
    const { orderId, recipientEmail, recipientName, traceId } = job.data;

    this.logger.log(
      `[MailProcessor] Processing transactional email job [${job.id}] for order [${orderId}] -> <${recipientEmail}>`
    );

    await job.updateProgress(20);

    const result = await this.mailService.sendOrderFulfillmentEmail(
      orderId,
      recipientEmail,
      recipientName,
      traceId
    );

    await job.updateProgress(100);

    if (!result.success) {
      throw new Error(
        `Email dispatch failed via ${result.provider}: ${result.error || "Unknown error"}`
      );
    }

    this.logger.log(
      `[MailProcessor] Successfully completed email job [${job.id}] via [${result.provider}] (MessageId: ${result.messageId})`
    );

    return result;
  }
}
