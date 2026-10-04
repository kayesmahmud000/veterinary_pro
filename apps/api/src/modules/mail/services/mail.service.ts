import { Inject, Injectable, Logger } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import {
  EmailMessage,
  EmailSendResult,
  IEmailProvider,
  EMAIL_PROVIDER_TOKEN,
} from "../interfaces/mail-provider.interface";
import { IMailService } from "../interfaces/mail-service.interface";
import {
  IOrderRepository,
  ORDER_REPOSITORY,
} from "../../orders/repositories/order.repository.interface";
import {
  IAuditLogRepository,
  AUDIT_LOG_REPOSITORY,
} from "../../audit/repositories/audit-log.repository.interface";
import { EnvService } from "../../../config/env.service";
import { EntityNotFoundException } from "../../../common/exceptions/domain.exception";
import {
  generateOrderDownloadDeliveryEmail,
  OrderDeliveryTemplateItem,
} from "../templates/order-download-delivery.template";

export const MAX_DOWNLOADS_LIMIT = 5;

@Injectable()
export class MailService implements IMailService {
  private readonly logger = new Logger(MailService.name);

  constructor(
    @Inject(EMAIL_PROVIDER_TOKEN)
    private readonly emailProvider: IEmailProvider,
    @Inject(ORDER_REPOSITORY)
    private readonly orderRepository: IOrderRepository,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: IAuditLogRepository,
    private readonly envService: EnvService
  ) {}

  public async sendEmail(message: EmailMessage): Promise<EmailSendResult> {
    return this.emailProvider.sendEmail(message);
  }

  public async sendOrderFulfillmentEmail(
    orderId: string,
    recipientEmail: string,
    recipientName?: string,
    traceId?: string
  ): Promise<EmailSendResult> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new EntityNotFoundException("Order", orderId);
    }

    const orderTotalFormatted = `$${(order.totalCents / 100).toFixed(2)} ${order.currency.toUpperCase()}`;
    const baseUrl = this.envService.apiBaseUrl.replace(/\/$/, "");

    const items: OrderDeliveryTemplateItem[] = order.items.map((item) => {
      const remaining = Math.max(0, MAX_DOWNLOADS_LIMIT - item.downloadCount);
      const downloadUrl = `${baseUrl}/api/v1/orders/${order.id}/download?token=${item.downloadToken}&redirect=true`;

      return {
        itemId: item.id,
        productTitle: item.productTitle,
        productType: "DIGITAL_ASSET",
        downloadUrl,
        maxDownloads: MAX_DOWNLOADS_LIMIT,
        remainingDownloads: remaining,
      };
    });

    const activeRecipientName = recipientName || "Valued Farmer";

    const { subject, html, text } = generateOrderDownloadDeliveryEmail({
      orderId: order.id,
      orderTotalFormatted,
      recipientName: activeRecipientName,
      recipientEmail,
      items,
      orderDate: order.createdAt.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    });

    const sendResult = await this.emailProvider.sendEmail({
      to: recipientEmail,
      subject,
      html,
      text,
    });

    // Record immutable audit log
    const activeTraceId = traceId || randomUUID();
    await this.auditLogRepository.record({
      userId: order.userId,
      action: "ORDER_EMAIL_DISPATCHED",
      entityType: "Order",
      entityId: order.id,
      newValues: {
        recipientEmail,
        provider: sendResult.provider,
        messageId: sendResult.messageId,
        success: sendResult.success,
        itemCount: items.length,
      },
      traceId: activeTraceId,
    });

    if (sendResult.success) {
      this.logger.log(
        `[MailService] Order confirmation email dispatched successfully for order [${orderId}] via [${sendResult.provider}] to <${recipientEmail}>`
      );
    } else {
      this.logger.warn(
        `[MailService] Order confirmation email dispatch failed for order [${orderId}]: ${sendResult.error}`
      );
    }

    return sendResult;
  }
}
