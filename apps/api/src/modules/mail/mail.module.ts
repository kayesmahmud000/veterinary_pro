import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AppConfigModule, EnvService } from "../../config";
import { PrismaModule } from "../prisma/prisma.module";
import { AuditModule } from "../audit/audit.module";
import { OrderRepository } from "../orders/repositories/order.repository";
import { ORDER_REPOSITORY } from "../orders/repositories/order.repository.interface";
import {
  EMAIL_PROVIDER_TOKEN,
} from "./interfaces/mail-provider.interface";
import {
  MAIL_QUEUE_NAME,
  MAIL_QUEUE_SERVICE,
  MAIL_SERVICE,
} from "./interfaces/mail-service.interface";
import { MockMailProvider } from "./providers/mock-mail.provider";
import { ResendMailProvider } from "./providers/resend-mail.provider";
import { SesMailProvider } from "./providers/ses-mail.provider";
import { MailService } from "./services/mail.service";
import { MailQueueService } from "./services/mail-queue.service";
import { MailProcessor } from "./processors/mail.processor";

@Module({
  imports: [
    AppConfigModule,
    PrismaModule,
    AuditModule,
    BullModule.registerQueue({
      name: MAIL_QUEUE_NAME,
    }),
  ],
  providers: [
    {
      provide: ORDER_REPOSITORY,
      useClass: OrderRepository,
    },
    MockMailProvider,
    ResendMailProvider,
    SesMailProvider,
    {
      provide: EMAIL_PROVIDER_TOKEN,
      useFactory: (
        envService: EnvService,
        mockProvider: MockMailProvider,
        resendProvider: ResendMailProvider,
        sesProvider: SesMailProvider
      ) => {
        const provider = envService.emailProvider;
        if (provider === "resend") {
          return resendProvider;
        }
        if (provider === "ses") {
          return sesProvider;
        }
        return mockProvider;
      },
      inject: [
        EnvService,
        MockMailProvider,
        ResendMailProvider,
        SesMailProvider,
      ],
    },
    MailService,
    {
      provide: MAIL_SERVICE,
      useClass: MailService,
    },
    MailQueueService,
    {
      provide: MAIL_QUEUE_SERVICE,
      useClass: MailQueueService,
    },
    MailProcessor,
  ],
  exports: [
    MAIL_SERVICE,
    MAIL_QUEUE_SERVICE,
    EMAIL_PROVIDER_TOKEN,
    MockMailProvider,
    ResendMailProvider,
    SesMailProvider,
    MailProcessor,
  ],
})
export class MailModule {}
