import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AppConfigModule, EnvService } from "../../config";
import { MailProviderModule } from "../mail/mail-provider.module";
import { RoleEventsModule } from "./role-events.module";
import { RoleNotificationProcessor } from "./role-notification.processor";
import { RoleNotificationDispatcher } from "./role-notification-dispatcher.service";
@Module({
  imports: [
    AppConfigModule,
    MailProviderModule,
    RoleEventsModule,
    BullModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [EnvService],
      useFactory: (env: EnvService) => {
        const url = new URL(env.redisUrl);
        return {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            username: url.username
              ? decodeURIComponent(url.username)
              : undefined,
            password: url.password
              ? decodeURIComponent(url.password)
              : undefined,
            tls: url.protocol === "rediss:" ? {} : undefined,
            maxRetriesPerRequest: null,
          },
        };
      },
    }),
    BullModule.registerQueue({ name: "role-notifications" }),
  ],
  providers: [RoleNotificationProcessor, RoleNotificationDispatcher],
})
export class RoleNotificationsWorkerModule {}
