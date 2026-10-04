import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { PrismaModule } from "../prisma";
import { AuditModule } from "../audit";
import { AuthModule } from "../auth";
import { FarmsModule } from "../farms";
import { AnimalsModule } from "../animals";
import { UsersModule } from "../users";
import { MediaModule } from "../media";
import { HealthRecordRepository } from "./repositories/health-record.repository";
import { HEALTH_RECORD_REPOSITORY } from "./repositories/health-record.repository.interface";
import { HealthRecordAttachmentRepository } from "./repositories/health-record-attachment.repository";
import { HEALTH_RECORD_ATTACHMENT_REPOSITORY } from "./repositories/health-record-attachment.repository.interface";
import { VaccineRecordRepository } from "./repositories/vaccine-record.repository";
import { VACCINE_RECORD_REPOSITORY } from "./repositories/vaccine-record.repository.interface";
import { VaccineReminderLogRepository } from "./repositories/vaccine-reminder-log.repository";
import { VACCINE_REMINDER_LOG_REPOSITORY } from "./repositories/vaccine-reminder-log.repository.interface";
import { HealthEscalationLogRepository } from "./repositories/health-escalation-log.repository";
import { HEALTH_ESCALATION_LOG_REPOSITORY } from "./repositories/health-escalation-log.repository.interface";
import { ClinicalHealthService } from "./services/clinical-health.service";
import { CLINICAL_HEALTH_SERVICE } from "./services/clinical-health.service.interface";
import { HealthAttachmentService } from "./services/health-attachment.service";
import { HEALTH_ATTACHMENT_SERVICE } from "./services/health-attachment.service.interface";
import { VaccineScheduleService } from "./services/vaccine-schedule.service";
import { VACCINE_SCHEDULE_SERVICE } from "./services/vaccine-schedule.service.interface";
import { VaccineNotificationService } from "./services/vaccine-notification.service";
import { VACCINE_NOTIFICATION_SERVICE } from "./services/vaccine-notification.service.interface";
import { VaccineReminderQueueService } from "./services/vaccine-reminder-queue.service";
import {
  VACCINE_REMINDER_QUEUE,
  VACCINE_REMINDER_QUEUE_SERVICE,
} from "./services/vaccine-reminder-queue.service.interface";
import { HealthEscalationService } from "./services/health-escalation.service";
import {
  HEALTH_ESCALATION_SERVICE,
  IHealthEscalationService,
} from "./services/health-escalation.service.interface";
import { HealthEscalationQueueService } from "./services/health-escalation-queue.service";
import {
  HEALTH_ESCALATION_QUEUE,
  HEALTH_ESCALATION_QUEUE_SERVICE,
} from "./services/health-escalation-queue.service.interface";
import {
  PUSH_NOTIFICATION_PROVIDER,
  SMS_NOTIFICATION_PROVIDER,
} from "./providers/notification-provider.interface";
import {
  MockPushNotificationProvider,
  MockSmsNotificationProvider,
} from "./providers/mock-notification.provider";
import { VaccineReminderProcessor } from "./processors/vaccine-reminder.processor";
import { HealthEscalationProcessor } from "./processors/health-escalation.processor";
import { ClinicalHealthController } from "./clinical-health.controller";
import { VaccineScheduleController } from "./vaccine-schedule.controller";

@Module({
  imports: [
    PrismaModule,
    AuditModule,
    AuthModule,
    FarmsModule,
    AnimalsModule,
    UsersModule,
    MediaModule,
    BullModule.registerQueue(
      {
        name: VACCINE_REMINDER_QUEUE,
      },
      {
        name: HEALTH_ESCALATION_QUEUE,
      }
    ),
  ],
  controllers: [ClinicalHealthController, VaccineScheduleController],
  providers: [
    {
      provide: HEALTH_RECORD_REPOSITORY,
      useClass: HealthRecordRepository,
    },
    {
      provide: CLINICAL_HEALTH_SERVICE,
      useClass: ClinicalHealthService,
    },
    {
      provide: HEALTH_RECORD_ATTACHMENT_REPOSITORY,
      useClass: HealthRecordAttachmentRepository,
    },
    {
      provide: HEALTH_ATTACHMENT_SERVICE,
      useClass: HealthAttachmentService,
    },
    {
      provide: VACCINE_RECORD_REPOSITORY,
      useClass: VaccineRecordRepository,
    },
    {
      provide: VACCINE_SCHEDULE_SERVICE,
      useClass: VaccineScheduleService,
    },
    {
      provide: VACCINE_REMINDER_LOG_REPOSITORY,
      useClass: VaccineReminderLogRepository,
    },
    {
      provide: SMS_NOTIFICATION_PROVIDER,
      useClass: MockSmsNotificationProvider,
    },
    {
      provide: PUSH_NOTIFICATION_PROVIDER,
      useClass: MockPushNotificationProvider,
    },
    {
      provide: VACCINE_NOTIFICATION_SERVICE,
      useClass: VaccineNotificationService,
    },
    {
      provide: VACCINE_REMINDER_QUEUE_SERVICE,
      useClass: VaccineReminderQueueService,
    },
    {
      provide: HEALTH_ESCALATION_LOG_REPOSITORY,
      useClass: HealthEscalationLogRepository,
    },
    {
      provide: HEALTH_ESCALATION_SERVICE,
      useClass: HealthEscalationService,
    },
    {
      provide: HEALTH_ESCALATION_QUEUE_SERVICE,
      useClass: HealthEscalationQueueService,
    },
    HealthRecordRepository,
    HealthRecordAttachmentRepository,
    ClinicalHealthService,
    HealthAttachmentService,
    VaccineRecordRepository,
    VaccineScheduleService,
    VaccineReminderLogRepository,
    HealthEscalationLogRepository,
    MockSmsNotificationProvider,
    MockPushNotificationProvider,
    VaccineNotificationService,
    VaccineReminderQueueService,
    VaccineReminderProcessor,
    HealthEscalationService,
    HealthEscalationQueueService,
    HealthEscalationProcessor,
  ],
  exports: [
    HEALTH_RECORD_REPOSITORY,
    CLINICAL_HEALTH_SERVICE,
    HealthRecordRepository,
    ClinicalHealthService,
    HEALTH_RECORD_ATTACHMENT_REPOSITORY,
    HealthRecordAttachmentRepository,
    HEALTH_ATTACHMENT_SERVICE,
    HealthAttachmentService,
    VACCINE_RECORD_REPOSITORY,
    VACCINE_SCHEDULE_SERVICE,
    VaccineRecordRepository,
    VaccineScheduleService,
    VACCINE_REMINDER_LOG_REPOSITORY,
    VaccineReminderLogRepository,
    VACCINE_NOTIFICATION_SERVICE,
    VaccineNotificationService,
    VACCINE_REMINDER_QUEUE_SERVICE,
    VaccineReminderQueueService,
    HEALTH_ESCALATION_LOG_REPOSITORY,
    HealthEscalationLogRepository,
    HEALTH_ESCALATION_SERVICE,
    HealthEscalationService,
    HEALTH_ESCALATION_QUEUE_SERVICE,
    HealthEscalationQueueService,
  ],
})
export class ClinicalHealthModule {}
