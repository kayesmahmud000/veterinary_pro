import { Inject, Injectable, Logger, OnModuleInit } from "@nestjs/common";
import {
  DEFAULT_SUBSCRIPTION_PLANS,
  SubscriptionTier,
} from "@vetralink/shared-types";
import { EntityNotFoundException } from "../../../common/exceptions/domain.exception";
import {
  SubscriptionPlanResponseDto,
  UpdateSubscriptionPlanDto,
} from "../dto";
import {
  ISubscriptionPlanRepository,
  SUBSCRIPTION_PLAN_REPOSITORY,
} from "../repositories/subscription-plan.repository.interface";
import { ISubscriptionPlanService } from "./subscription-plan.service.interface";

@Injectable()
export class SubscriptionPlanService
  implements ISubscriptionPlanService, OnModuleInit
{
  private readonly logger = new Logger(SubscriptionPlanService.name);

  constructor(
    @Inject(SUBSCRIPTION_PLAN_REPOSITORY)
    private readonly planRepo: ISubscriptionPlanRepository,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const existing = await this.planRepo.findAll(true);
      if (existing.length < DEFAULT_SUBSCRIPTION_PLANS.length) {
        this.logger.log("Missing default subscription plans detected. Seeding defaults...");
        await this.seedDefaultPlans();
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Could not verify default subscription plans on bootstrap: ${message}`,
      );
    }
  }

  async getAvailablePlans(
    includeInactive: boolean = false,
  ): Promise<SubscriptionPlanResponseDto[]> {
    const plans = await this.planRepo.findAll(includeInactive);
    return plans.map((plan) => plan.toResponseDto());
  }

  async getPlanByTier(tier: SubscriptionTier): Promise<SubscriptionPlanResponseDto> {
    const plan = await this.planRepo.findByTier(tier);
    if (!plan) {
      throw new EntityNotFoundException("SubscriptionPlan", tier);
    }
    return plan.toResponseDto();
  }

  async getPlanById(id: string): Promise<SubscriptionPlanResponseDto> {
    const plan = await this.planRepo.findById(id);
    if (!plan) {
      throw new EntityNotFoundException("SubscriptionPlan", id);
    }
    return plan.toResponseDto();
  }

  async seedDefaultPlans(): Promise<SubscriptionPlanResponseDto[]> {
    this.logger.log(
      "Upserting default subscription plans (STARTER, PRO, ENTERPRISE)...",
    );
    const seeded = await this.planRepo.upsertDefaultPlans(
      DEFAULT_SUBSCRIPTION_PLANS,
    );
    return seeded.map((plan) => plan.toResponseDto());
  }

  async updatePlan(
    id: string,
    dto: UpdateSubscriptionPlanDto,
  ): Promise<SubscriptionPlanResponseDto> {
    const plan = await this.planRepo.findById(id);
    if (!plan) {
      throw new EntityNotFoundException("SubscriptionPlan", id);
    }

    plan.updateDetails({
      name: dto.name,
      priceMonthlyCents: dto.priceMonthlyCents,
      priceAnnualCents: dto.priceAnnualCents,
      maxAnimals: dto.maxAnimals,
      features: dto.features,
      isActive: dto.isActive,
    });

    const updated = await this.planRepo.save(plan);
    this.logger.log(
      `Updated subscription plan '${updated.name}' (${updated.tier})`,
    );
    return updated.toResponseDto();
  }
}
