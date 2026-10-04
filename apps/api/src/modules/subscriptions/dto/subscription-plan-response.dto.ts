import { ApiProperty } from "@nestjs/swagger";
import {
  SubscriptionPlanDto,
  SubscriptionPlanFeaturesDto,
  SubscriptionTier,
} from "@vetralink/shared-types";

export class SubscriptionPlanResponseDto implements SubscriptionPlanDto {
  @ApiProperty({
    description: "Unique plan ID",
    example: "b3b2ec62-9fa9-43c7-8bb3-dcf742f9a712",
  })
  id!: string;

  @ApiProperty({
    description: "Display name of the subscription plan",
    example: "Pro Farmer",
  })
  name!: string;

  @ApiProperty({
    description: "Subscription tier enum",
    enum: SubscriptionTier,
    example: SubscriptionTier.PRO,
  })
  tier!: SubscriptionTier;

  @ApiProperty({
    description: "Monthly price in integer cents",
    example: 900,
  })
  priceMonthlyCents!: number;

  @ApiProperty({
    description: "Annual price in integer cents",
    example: 8900,
  })
  priceAnnualCents!: number;

  @ApiProperty({
    description: "Maximum animals allowed under this tier (-1 for unlimited)",
    example: 30,
  })
  maxAnimals!: number;

  @ApiProperty({
    description: "Features and quota limits",
    example: {
      maxAnimals: 30,
      maxStaff: 3,
      teleVetPriority: "EXPEDITED",
      advancedAnalytics: true,
      bulkImportExport: true,
      customReports: false,
    },
  })
  features!: SubscriptionPlanFeaturesDto;

  @ApiProperty({
    description: "Whether the plan is available for selection",
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    description: "ISO 8601 creation timestamp",
    example: "2026-09-13T12:00:00.000Z",
  })
  createdAt!: string;

  @ApiProperty({
    description: "Calculated annual savings in integer cents compared to monthly billing",
    example: 1900,
  })
  annualSavingsCents!: number;

  @ApiProperty({
    description: "Whether the plan allows unlimited animals",
    example: false,
  })
  isUnlimitedAnimals!: boolean;
}
