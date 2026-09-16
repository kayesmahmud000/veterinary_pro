import { Module } from "@nestjs/common";
import { AuthModule } from "../auth";
import { PrismaModule } from "../prisma";
import { UsersModule } from "../users";
import { SubscriptionPlanRepository } from "./repositories/subscription-plan.repository";
import { SUBSCRIPTION_PLAN_REPOSITORY } from "./repositories/subscription-plan.repository.interface";
import { SubscriptionRepository } from "./repositories/subscription.repository";
import { SUBSCRIPTION_REPOSITORY } from "./repositories/subscription.repository.interface";
import { SubscriptionUsageRepository } from "./repositories/subscription-usage.repository";
import { SUBSCRIPTION_USAGE_REPOSITORY } from "./repositories/subscription-usage.repository.interface";
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
import { SubscriptionPlanController } from "./subscription-plan.controller";
import { SubscriptionController } from "./subscription.controller";
import { SubscriptionWebhookController } from "./controllers/subscription-webhook.controller";
import { SubscriptionWebhookService } from "./services/subscription-webhook.service";
import { SUBSCRIPTION_WEBHOOK_SERVICE } from "./services/subscription-webhook.service.interface";

@Module({
  imports: [PrismaModule, AuthModule, UsersModule],
  controllers: [
    SubscriptionPlanController,
    SubscriptionController,
    SubscriptionWebhookController,
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
    SubscriptionLifecycleService,
    SUBSCRIPTION_LIFECYCLE_SERVICE,
    SubscriptionPlanChangeService,
    SUBSCRIPTION_PLAN_CHANGE_SERVICE,
    SubscriptionQuotaService,
    SUBSCRIPTION_QUOTA_SERVICE,
    SubscriptionQuotaGuard,
    StripePortalService,
    STRIPE_PORTAL_SERVICE,
    SubscriptionWebhookService,
    SUBSCRIPTION_WEBHOOK_SERVICE,
  ],
})
export class SubscriptionsModule {}
