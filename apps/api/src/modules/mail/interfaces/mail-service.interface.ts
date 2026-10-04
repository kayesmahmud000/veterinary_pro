import { EmailMessage, EmailSendResult } from "./mail-provider.interface";

export const MAIL_QUEUE_NAME = "transactional-mail";
export const MAIL_SERVICE = "MAIL_SERVICE";
export const MAIL_QUEUE_SERVICE = "MAIL_QUEUE_SERVICE";

export interface IMailService {
  sendEmail(message: EmailMessage): Promise<EmailSendResult>;
  sendOrderFulfillmentEmail(
    orderId: string,
    recipientEmail: string,
    recipientName?: string,
    traceId?: string
  ): Promise<EmailSendResult>;
}

export interface IMailQueueService {
  enqueueOrderDeliveryEmail(
    orderId: string,
    recipientEmail: string,
    recipientName?: string,
    traceId?: string
  ): Promise<string>;
}
