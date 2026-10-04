import { ApiPropertyOptional, PartialType } from "@nestjs/swagger";
import { CreateSubscriptionPlanDto } from "./create-subscription-plan.dto";

export class UpdateSubscriptionPlanDto extends PartialType(
  CreateSubscriptionPlanDto,
) {
  @ApiPropertyOptional({
    description: "Display name of the subscription plan",
    example: "Pro Farmer (Updated)",
  })
  override name?: string;

  @ApiPropertyOptional({
    description: "Monthly price in integer cents",
    example: 950,
  })
  override priceMonthlyCents?: number;

  @ApiPropertyOptional({
    description: "Annual price in integer cents",
    example: 9500,
  })
  override priceAnnualCents?: number;

  @ApiPropertyOptional({
    description: "Maximum animals allowed (-1 for unlimited)",
    example: 35,
  })
  override maxAnimals?: number;
}
