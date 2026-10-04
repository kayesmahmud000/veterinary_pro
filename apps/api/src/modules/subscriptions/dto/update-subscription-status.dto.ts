import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  SubscriptionStatus,
  UpdateSubscriptionStatusDto as IUpdateSubscriptionStatusDto,
} from "@vetralink/shared-types";
import { IsDateString, IsEnum, IsOptional, IsString } from "class-validator";

export class UpdateSubscriptionStatusDto
  implements IUpdateSubscriptionStatusDto
{
  @ApiProperty({
    description: "Target subscription status",
    enum: SubscriptionStatus,
    example: SubscriptionStatus.ACTIVE,
  })
  @IsEnum(SubscriptionStatus)
  status!: SubscriptionStatus;

  @ApiPropertyOptional({
    description: "Payment gateway subscription ID (e.g. sub_123 from Stripe)",
    example: "sub_1234567890",
  })
  @IsString()
  @IsOptional()
  gatewaySubId?: string;

  @ApiPropertyOptional({
    description: "New current period end timestamp in ISO format",
    example: "2026-10-13T00:00:00.000Z",
  })
  @IsDateString()
  @IsOptional()
  currentPeriodEnd?: string;
}
