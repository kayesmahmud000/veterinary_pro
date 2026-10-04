import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  SubscriptionPlanDto,
  SubscriptionResponseDto as ISubscriptionResponseDto,
  SubscriptionStatus,
} from "@vetralink/shared-types";
import { SubscriptionPlanResponseDto } from "./subscription-plan-response.dto";

export class SubscriptionResponseDto implements ISubscriptionResponseDto {
  @ApiProperty({
    description: "Unique subscription UUID",
    example: "c1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  })
  id!: string;

  @ApiProperty({
    description: "User UUID who owns the subscription",
    example: "u1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  })
  userId!: string;

  @ApiPropertyOptional({
    description: "Farm tenant UUID linked to this subscription",
    example: "f1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
    nullable: true,
  })
  farmId!: string | null;

  @ApiProperty({
    description: "Subscription plan UUID",
    example: "p1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  })
  planId!: string;

  @ApiPropertyOptional({
    description: "Subscription plan metadata",
    type: () => SubscriptionPlanResponseDto,
  })
  plan?: SubscriptionPlanDto;

  @ApiProperty({
    description: "Subscription lifecycle status",
    enum: SubscriptionStatus,
    example: SubscriptionStatus.ACTIVE,
  })
  status!: SubscriptionStatus;

  @ApiProperty({
    description: "Current billing or trial period start date",
    example: "2026-09-01T00:00:00.000Z",
  })
  currentPeriodStart!: string;

  @ApiProperty({
    description: "Current billing or trial period end date",
    example: "2026-10-01T00:00:00.000Z",
  })
  currentPeriodEnd!: string;

  @ApiPropertyOptional({
    description: "External payment gateway subscription ID",
    example: "sub_1234567890",
    nullable: true,
  })
  gatewaySubId!: string | null;

  @ApiProperty({
    description: "Whether the subscription is scheduled for cancellation at the end of the current period",
    example: false,
  })
  cancelAtPeriodEnd!: boolean;

  @ApiProperty({
    description: "Creation timestamp",
    example: "2026-09-01T00:00:00.000Z",
  })
  createdAt!: string;

  @ApiProperty({
    description: "Last updated timestamp",
    example: "2026-09-13T12:00:00.000Z",
  })
  updatedAt!: string;

  @ApiProperty({
    description: "Whether the subscription is currently active or in valid trial",
    example: true,
  })
  isActive!: boolean;

  @ApiProperty({
    description: "Whether the subscription is in trial state",
    example: false,
  })
  isTrial!: boolean;

  @ApiProperty({
    description: "Whether the subscription is in past due state",
    example: false,
  })
  isPastDue!: boolean;

  @ApiProperty({
    description: "Days remaining until current period expires",
    example: 18,
  })
  daysRemaining!: number;
}
