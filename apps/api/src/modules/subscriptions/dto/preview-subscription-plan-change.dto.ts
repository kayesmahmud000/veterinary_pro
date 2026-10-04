import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  PreviewSubscriptionPlanChangeDto as IPreviewSubscriptionPlanChangeDto,
  SubscriptionBillingInterval,
  SubscriptionTier,
} from "@vetralink/shared-types";
import { IsEnum, IsOptional, IsUUID } from "class-validator";

export class PreviewSubscriptionPlanChangeDto
  implements IPreviewSubscriptionPlanChangeDto
{
  @ApiPropertyOptional({
    description: "Target subscription plan UUID",
    example: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  })
  @IsUUID()
  @IsOptional()
  targetPlanId?: string;

  @ApiPropertyOptional({
    description: "Target subscription tier (if targetPlanId is not specified)",
    enum: SubscriptionTier,
    example: SubscriptionTier.ENTERPRISE,
  })
  @IsEnum(SubscriptionTier)
  @IsOptional()
  targetTier?: SubscriptionTier;

  @ApiProperty({
    description: "Desired billing interval (MONTHLY or ANNUAL)",
    enum: SubscriptionBillingInterval,
    default: SubscriptionBillingInterval.MONTHLY,
    example: SubscriptionBillingInterval.MONTHLY,
  })
  @IsEnum(SubscriptionBillingInterval)
  @IsOptional()
  billingInterval: SubscriptionBillingInterval =
    SubscriptionBillingInterval.MONTHLY;
}
