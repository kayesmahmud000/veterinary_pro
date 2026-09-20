import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bullmq";
import { AuthModule } from "../auth";
import { PrismaModule } from "../prisma";
import { UsersModule } from "../users";
import { MailModule } from "../mail";
import { AuditModule } from "../audit";
import { SubscriptionPlanRepository } from "./repositories/subscription-plan.repository";
import { SUBSCRIPTION_PLAN_REPOSITORY } from "./repositories/subscription-plan.repository.interface";
import { SubscriptionRepository } from "./repositories/subscription.repository";
import { SUBSCRIPTION_REPOSITORY } from "./repositories/subscription.repository.interface";
import { SubscriptionUsageRepository } from "./repositories/subscription-usage.repository";
import { SUBSCRIPTION_USAGE_REPOSITORY } from "./repositories/subscription-usage.repository.interface";
import { SubscriptionDunningLogRepository } from "./repositories/subscription-dunning-log.repository";
import { SUBSCRIPTION_DUNNING_LOG_REPOSITORY } from "./repositories/subscription-dunning-log.repository.interface";
import { StripePortalService } from "./services/stripe-portal.service";
import { STRIPE_PORTAL_SERVICE } from "./services/stripe-portal.service.interface";
import { SubscriptionLifecycleService } from "./services/subscription-lifecycle.service";
import { SUBSCRIPTION_LIFECYCLE_SERVICE } from "./services/subscription-lifecycle.service.interface";
import { SubscriptionPlanChangeService } from "./services/subscription-plan-change.service";
import { SUBSCRIPTION_PLAN_CHANGE_SERVICE } from "./services/subscription-plan-change.service.interface";
import { SubscriptionPlanService } from "./services/subscription-plan.service";
import { SUBSCRIPTION_PLAN_SERVICE } from "./services/subscription-plan.service.interface";
import { SubscriptionQuotaService } from "./services/subscription-quota.service";
import { SUBSCRIPTION_QUOTA_SERVICE } from "./services/subscription-quota.service.interface";
import { SubscriptionQuotaGuard } from "./guards/subscription-quota.guard";
import { SubscriptionReadOnlyGuard } from "./guards/subscription-read-only.guard";
import { SubscriptionGracePeriodService } from "./services/subscription-grace-period.service";
import { SUBSCRIPTION_GRACE_PERIOD_SERVICE } from "./services/subscription-grace-period.service.interface";
import { SubscriptionPlanController } from "./subscription-plan.controller";
import { SubscriptionController } from "./subscription.controller";
import { SubscriptionWebhookController } from "./controllers/subscription-webhook.controller";
import { SubscriptionWebhookService } from "./services/subscription-webhook.service";
import { SUBSCRIPTION_WEBHOOK_SERVICE } from "./services/subscription-webhook.service.interface";
import { SubscriptionDunningService } from "./services/subscription-dunning.service";
import { SUBSCRIPTION_DUNNING_SERVICE } from "./services/subscription-dunning.service.interface";
import { SubscriptionDunningQueueService } from "./services/subscription-dunning-queue.service";
import {
  SUBSCRIPTION_DUNNING_QUEUE,
  SUBSCRIPTION_DUNNING_QUEUE_SERVICE,
} from "./services/subscription-dunning-queue.service.interface";
import { SubscriptionDunningProcessor } from "./processors/subscription-dunning.processor";
import { SubscriptionDunningController } from "./controllers/subscription-dunning.controller";
import { SubscriptionMetricsController } from "./controllers/subscription-metrics.controller";
import { SubscriptionMetricsService } from "./services/subscription-metrics.service";
import { SUBSCRIPTION_METRICS_SERVICE } from "./services/subscription-metrics.service.interface";

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    UsersModule,
    MailModule,
    AuditModule,
    BullModule.registerQueue({
      name: SUBSCRIPTION_DUNNING_QUEUE,
    }),
  ],
  controllers: [
    SubscriptionPlanController,
    SubscriptionController,
    SubscriptionWebhookController,
    SubscriptionDunningController,
    SubscriptionMetricsController,
  ],
  providers: [
    SubscriptionPlanRepository,
    {
      provide: SUBSCRIPTION_PLAN_REPOSITORY,
      useClass: SubscriptionPlanRepository,
    },
    SubscriptionPlanService,
    {
      provide: SUBSCRIPTION_PLAN_SERVICE,
      useClass: SubscriptionPlanService,
    },
    SubscriptionRepository,
    {
      provide: SUBSCRIPTION_REPOSITORY,
      useClass: SubscriptionRepository,
    },
    SubscriptionUsageRepository,
    {
      provide: SUBSCRIPTION_USAGE_REPOSITORY,
      useClass: SubscriptionUsageRepository,
    },
    SubscriptionDunningLogRepository,
    {
      provide: SUBSCRIPTION_DUNNING_LOG_REPOSITORY,
      useClass: SubscriptionDunningLogRepository,
    },
    SubscriptionLifecycleService,
    {
      provide: SUBSCRIPTION_LIFECYCLE_SERVICE,
      useClass: SubscriptionLifecycleService,
    },
    SubscriptionPlanChangeService,
    {
      provide: SUBSCRIPTION_PLAN_CHANGE_SERVICE,
      useClass: SubscriptionPlanChangeService,
    },
    SubscriptionQuotaService,
    {
      provide: SUBSCRIPTION_QUOTA_SERVICE,
      useClass: SubscriptionQuotaService,
    },
    SubscriptionQuotaGuard,
    SubscriptionReadOnlyGuard,
    SubscriptionGracePeriodService,
    {
      provide: SUBSCRIPTION_GRACE_PERIOD_SERVICE,
      useClass: SubscriptionGracePeriodService,
    },
    StripePortalService,
    {
      provide: STRIPE_PORTAL_SERVICE,
      useClass: StripePortalService,
    },
    SubscriptionWebhookService,
    {
      provide: SUBSCRIPTION_WEBHOOK_SERVICE,
      useClass: SubscriptionWebhookService,
    },
    SubscriptionDunningService,
    {
      provide: SUBSCRIPTION_DUNNING_SERVICE,
      useClass: SubscriptionDunningService,
    },
    SubscriptionDunningQueueService,
    {
      provide: SUBSCRIPTION_DUNNING_QUEUE_SERVICE,
      useClass: SubscriptionDunningQueueService,
    },
    SubscriptionDunningProcessor,
    SubscriptionMetricsService,
    {
      provide: SUBSCRIPTION_METRICS_SERVICE,
      useClass: SubscriptionMetricsService,
    },
  ],
  exports: [
    SubscriptionPlanRepository,
    SUBSCRIPTION_PLAN_REPOSITORY,
    SubscriptionPlanService,
    SUBSCRIPTION_PLAN_SERVICE,
    SubscriptionRepository,
    SUBSCRIPTION_REPOSITORY,
    SubscriptionUsageRepository,
    SUBSCRIPTION_USAGE_REPOSITORY,
    SubscriptionDunningLogRepository,
    SUBSCRIPTION_DUNNING_LOG_REPOSITORY,
    SubscriptionLifecycleService,
    SUBSCRIPTION_LIFECYCLE_SERVICE,
    SubscriptionPlanChangeService,
    SUBSCRIPTION_PLAN_CHANGE_SERVICE,
    SubscriptionQuotaService,
    SUBSCRIPTION_QUOTA_SERVICE,
    SubscriptionQuotaGuard,
    SubscriptionReadOnlyGuard,
    SubscriptionGracePeriodService,
    SUBSCRIPTION_GRACE_PERIOD_SERVICE,
    SubscriptionMetricsService,
    SUBSCRIPTION_METRICS_SERVICE,
    StripePortalService,
    STRIPE_PORTAL_SERVICE,
    SubscriptionWebhookService,
    SUBSCRIPTION_WEBHOOK_SERVICE,
    SubscriptionDunningService,
    SUBSCRIPTION_DUNNING_SERVICE,
    SubscriptionDunningQueueService,
    SUBSCRIPTION_DUNNING_QUEUE_SERVICE,
    SubscriptionDunningProcessor,
  ],
})
export class SubscriptionsModule {}
