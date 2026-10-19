import { Inject } from "@nestjs/common";
import { Processor, WorkerHost } from "@nestjs/bullmq";
import { Job } from "bullmq";
import { EnvService } from "../../config/env.service";
import {
  EMAIL_PROVIDER_TOKEN,
  IEmailProvider,
} from "../mail/interfaces/mail-provider.interface";
import { RoleNotificationRepository } from "./role-notification.repository";
import { roleNotificationTemplate } from "./role-notification.template";
@Processor("role-notifications")
export class RoleNotificationProcessor extends WorkerHost {
  constructor(
    private readonly records: RoleNotificationRepository,
    @Inject(EMAIL_PROVIDER_TOKEN) private readonly mail: IEmailProvider,
    private readonly env: EnvService,
  ) {
    super();
  }
  async process(job: Job<{ deliveryId: string; generation?: number }>): Promise<void> {
    const context = await this.records.context(job.data.deliveryId);
    if (!context || ["SENT", "SKIPPED"].includes(context.delivery.status))
      return;
    const { delivery, request } = context;
    const generation = job.data.generation ?? 0;
    if (generation !== (delivery.retryGeneration ?? 0)) return;
    const reviewer = delivery.outbox.eventType === "ROLE_REQUEST_SUBMITTED";
    if (
      delivery.recipient.deletedAt ||
      delivery.recipient.status !== "ACTIVE" ||
      (!["ROLE_REQUEST_SUBMITTED", "ROLE_REQUEST_APPROVED", "ROLE_REQUEST_REJECTED", "PRIVILEGED_ROLE_CHANGED"].includes(delivery.outbox.eventType)) ||
      (!reviewer && (delivery.outbox.targetUserId !== delivery.recipient.id || (delivery.outbox.authorizationVersion != null && delivery.outbox.authorizationVersion !== delivery.recipient.authorizationVersion))) ||
      (reviewer &&
        (!["ADMIN", "SUPER_ADMIN"].includes(delivery.recipient.role) ||
          request?.status !== "PENDING"))
    ) {
      await this.records.skip(delivery.id, generation);
      return;
    }
    const path = reviewer
      ? `/admin/role-requests/${request!.id}`
      : delivery.outbox.eventType === "PRIVILEGED_ROLE_CHANGED"
        ? "/"
        : "/account/role-requests";
    const message = roleNotificationTemplate(
      delivery.outbox.locale,
      delivery.outbox.eventType,
      request?.targetRole ?? delivery.recipient.role,
      new URL(path, this.env.webBaseUrl).toString(),
      reviewer ? null : request?.publicDecisionReason,
    );
    try {
      const result = await this.mail.sendEmail({
        to: delivery.recipient.email,
        from: this.env.emailFrom,
        ...message,
      });
      if (!result.success) throw new Error("Provider did not accept email.");
      await this.records.sent(delivery.id, result.messageId, generation);
    } catch {
      await this.records.failed(
        delivery.id,
        job.attemptsMade + 1 >= (job.opts.attempts ?? 5),
        generation,
      );
      throw new Error("ROLE_EMAIL_PROVIDER_FAILURE");
    }
  }
}
