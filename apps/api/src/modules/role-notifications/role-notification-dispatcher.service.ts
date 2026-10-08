import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { InjectQueue } from "@nestjs/bullmq";
import { Queue } from "bullmq";
import { RoleNotificationRepository } from "./role-notification.repository";
@Injectable()
export class RoleNotificationDispatcher
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(RoleNotificationDispatcher.name);
  private timer?: ReturnType<typeof setInterval>;
  private running = false;
  constructor(
    private readonly records: RoleNotificationRepository,
    @InjectQueue("role-notifications") private readonly queue: Queue,
  ) {}
  onModuleInit() {
    this.timer = setInterval(() => {
      void this.dispatch();
    }, 5000);
    void this.dispatch();
  }
  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }
  async dispatch() {
    if (this.running) return;
    this.running = true;
    try {
      for (const event of await this.records.claim()) {
        try {
          const recipients = await this.records.recipients(event);
          if (recipients.obsolete) {
            await this.records.finish(event.id);
            continue;
          }
          if (!recipients.ids.length) {
            await this.records.retry(event.id, "NO_ACTIVE_REVIEWER");
            continue;
          }
          for (const recipientId of recipients.ids) {
            const delivery = await this.records.delivery(event.id, recipientId);
            if (["SENT", "SKIPPED", "FAILED"].includes(delivery.status))
              continue;
            await this.queue.add(
              "role-email",
              { deliveryId: delivery.id },
              {
                jobId: `role-mail-${delivery.id}`,
                attempts: 5,
                backoff: { type: "exponential", delay: 2000 },
                removeOnComplete: true,
                removeOnFail: false,
              },
            );
          }
          if ((await this.records.unsettled(event.id)) === 0)
            await this.records.finish(event.id);
          else await this.records.retry(event.id, "DELIVERY_PENDING");
        } catch {
          await this.records.retry(event.id, "DISPATCH_FAILED");
        }
      }
    } catch {
      this.logger.warn(
        "Role notification dispatch unavailable; durable events will be retried.",
      );
    } finally {
      this.running = false;
    }
  }
}
