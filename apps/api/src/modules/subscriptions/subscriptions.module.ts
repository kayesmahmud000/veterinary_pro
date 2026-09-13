import { Module } from "@nestjs/common";
import { AuthModule } from "../auth";
import { PrismaModule } from "../prisma";
import { SubscriptionPlanRepository } from "./repositories/subscription-plan.repository";
import { SUBSCRIPTION_PLAN_REPOSITORY } from "./repositories/subscription-plan.repository.interface";
import { SubscriptionRepository } from "./repositories/subscription.repository";
import { SUBSCRIPTION_REPOSITORY } from "./repositories/subscription.repository.interface";
import { SubscriptionUsageRepository } from "./repositories/subscription-usage.repository";
import { SUBSCRIPTION_USAGE_REPOSITORY } from "./repositories/subscription-usage.repository.interface";
import { SubscriptionLifecycleService } from "./services/subscription-lifecycle.service";
import { SUBSCRIPTION_LIFECYCLE_SERVICE } from "./services/subscription-lifecycle.service.interface";
import { SubscriptionPlanService } from "./services/subscription-plan.service";
import { SUBSCRIPTION_PLAN_SERVICE } from "./services/subscription-plan.service.interface";
import { SubscriptionQuotaService } from "./services/subscription-quota.service";
import { SUBSCRIPTION_QUOTA_SERVICE } from "./services/subscription-quota.service.interface";
import { SubscriptionQuotaGuard } from "./guards/subscription-quota.guard";
import { SubscriptionPlanController } from "./subscription-plan.controller";
import { SubscriptionController } from "./subscription.controller";

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [SubscriptionPlanController, SubscriptionController],
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
    SubscriptionQuotaService,
    {
      provide: SUBSCRIPTION_QUOTA_SERVICE,
      useClass: SubscriptionQuotaService,
    },
    SubscriptionQuotaGuard,
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
    SubscriptionQuotaService,
    SUBSCRIPTION_QUOTA_SERVICE,
    SubscriptionQuotaGuard,
  ],
})
export class SubscriptionsModule {}
