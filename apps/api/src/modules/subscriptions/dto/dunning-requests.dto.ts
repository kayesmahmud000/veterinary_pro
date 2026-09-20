import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  DunningChannel,
  DunningStage,
  DunningStatus,
} from "@vetralink/shared-types";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";
import { Type } from "class-transformer";

export class TriggerDunningScanRequestDto {
  @ApiPropertyOptional({
    description: "Whether to run a dry-run scan without dispatching emails",
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  dryRun?: boolean;

  @ApiPropertyOptional({
    description: "Target a specific subscription ID",
  })
  @IsOptional()
  @IsUUID()
  targetSubscriptionId?: string;

  @ApiPropertyOptional({
    description: "Simulate scan as of a specific date (ISO 8601)",
    example: "2026-09-20T00:00:00.000Z",
  })
  @IsOptional()
  @IsDateString()
  asOfDate?: string;
}

export class DispatchDunningStageDto {
  @ApiProperty({
    description: "The subscription ID to dispatch notification for",
  })
  @IsNotEmpty()
  @IsUUID()
  subscriptionId!: string;

  @ApiProperty({
    description: "The dunning stage to dispatch (DAY_1, DAY_3, DAY_7)",
    enum: DunningStage,
  })
  @IsNotEmpty()
  @IsEnum(DunningStage)
  stage!: DunningStage;

  @ApiPropertyOptional({
    description: "Notification channel (default: EMAIL)",
    enum: DunningChannel,
    default: DunningChannel.EMAIL,
  })
  @IsOptional()
  @IsEnum(DunningChannel)
  channel?: DunningChannel;

  @ApiPropertyOptional({
    description: "Associated Stripe gateway invoice ID if applicable",
  })
  @IsOptional()
  @IsString()
  gatewayInvoiceId?: string;
}

export class QueryDunningLogsRequestDto {
  @ApiPropertyOptional({ description: "Filter by subscription ID" })
  @IsOptional()
  @IsUUID()
  subscriptionId?: string;

  @ApiPropertyOptional({ description: "Filter by user ID" })
  @IsOptional()
  @IsUUID()
  userId?: string;

  @ApiPropertyOptional({ description: "Filter by farm ID" })
  @IsOptional()
  @IsUUID()
  farmId?: string;

  @ApiPropertyOptional({
    description: "Filter by stage",
    enum: DunningStage,
  })
  @IsOptional()
  @IsEnum(DunningStage)
  stage?: DunningStage;

  @ApiPropertyOptional({
    description: "Filter by channel",
    enum: DunningChannel,
  })
  @IsOptional()
  @IsEnum(DunningChannel)
  channel?: DunningChannel;

  @ApiPropertyOptional({
    description: "Filter by delivery status",
    enum: DunningStatus,
  })
  @IsOptional()
  @IsEnum(DunningStatus)
  status?: DunningStatus;

  @ApiPropertyOptional({ description: "Start date (ISO 8601)" })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({ description: "End date (ISO 8601)" })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: "Page number", default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: "Items per page", default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit?: number = 20;
}
