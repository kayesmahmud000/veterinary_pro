import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Length,
  Min,
} from "class-validator";
import {
  SubscriptionTier,
  SubscriptionPlanFeaturesDto,
} from "@vetralink/shared-types";

export class CreateSubscriptionPlanDto {
  @ApiProperty({
    description: "Display name of the subscription plan",
    example: "Pro Farmer",
    minLength: 1,
    maxLength: 100,
  })
  @IsString()
  @Length(1, 100)
  name!: string;

  @ApiProperty({
    description: "Subscription tier level",
    enum: SubscriptionTier,
    example: SubscriptionTier.PRO,
  })
  @IsEnum(SubscriptionTier)
  tier!: SubscriptionTier;

  @ApiProperty({
    description: "Monthly price in integer cents (e.g. 900 for $9.00)",
    example: 900,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  priceMonthlyCents!: number;

  @ApiProperty({
    description: "Annual price in integer cents (e.g. 8900 for $89.00)",
    example: 8900,
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  priceAnnualCents!: number;

  @ApiProperty({
    description:
      "Maximum animals allowed under this tier (-1 or >=999999 denotes unlimited)",
    example: 30,
    minimum: -1,
  })
  @IsInt()
  @Min(-1)
  maxAnimals!: number;

  @ApiPropertyOptional({
    description: "Configurable feature flags and metadata",
    example: {
      maxAnimals: 30,
      maxStaff: 3,
      teleVetPriority: "EXPEDITED",
      advancedAnalytics: true,
      bulkImportExport: true,
      customReports: false,
    },
  })
  @IsObject()
  @IsOptional()
  features?: SubscriptionPlanFeaturesDto;

  @ApiPropertyOptional({
    description: "Whether the plan is actively available for purchase",
    default: true,
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
