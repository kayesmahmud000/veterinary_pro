import { Test, TestingModule } from "@nestjs/testing";
import { AppModule } from "./app.module";
import { SubscriptionPlanService } from "./modules/subscriptions/services/subscription-plan.service";
import { SUBSCRIPTION_PLAN_SERVICE } from "./modules/subscriptions/services/subscription-plan.service.interface";

describe("AppModule Dependency Injection Bootstrap", () => {
  it("should compile AppModule and resolve all provider dependencies without DI errors", async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    try {
      expect(moduleRef).toBeDefined();
      // Two instances both seed missing tiers during startup and race on tier.
      expect(
        moduleRef.get(SUBSCRIPTION_PLAN_SERVICE) ===
          moduleRef.get(SubscriptionPlanService),
      ).toBe(true);
    } finally {
      await moduleRef.close();
    }
  });
});
