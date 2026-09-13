import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  CreateTrialSubscriptionDto as ICreateTrialSubscriptionDto,
  SubscriptionTier,
} from "@vetralink/shared-types";
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from "class-validator";

export class CreateTrialSubscriptionDto implements ICreateTrialSubscriptionDto {
  @ApiPropertyOptional({
    description: "Farm tenant UUID to link the subscription to",
    example: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  })
  @IsUUID()
  @IsOptional()
  farmId?: string;

  @ApiPropertyOptional({
    description: "Plan tier to trial (defaults to PRO for full feature trial)",
    enum: SubscriptionTier,
    example: SubscriptionTier.PRO,
  })
  @IsEnum(SubscriptionTier)
  @IsOptional()
  planTier?: SubscriptionTier = SubscriptionTier.PRO;

  @ApiPropertyOptional({
    description: "Trial duration in days (default: 14)",
    example: 14,
    minimum: 1,
    maximum: 90,
  })
  @IsInt()
  @Min(1)
  @Max(90)
  @IsOptional()
  trialDays?: number = 14;
}
