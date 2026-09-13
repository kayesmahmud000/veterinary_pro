import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from "class-validator";
import {
  HealthEscalationLevel,
  HealthEscalationLogQueryDto as IHealthEscalationLogQueryDto,
  ReminderChannel,
  ReminderStatus,
} from "@vetralink/shared-types";

export class HealthEscalationLogQueryDto implements IHealthEscalationLogQueryDto {
  @ApiPropertyOptional({
    description: "Filter by animal UUID",
    example: "22222222-2222-2222-2222-222222222222",
  })
  @IsOptional()
  @IsUUID()
  public readonly animalId?: string;

  @ApiPropertyOptional({
    description: "Filter by health record UUID",
    example: "33333333-3333-3333-3333-333333333333",
  })
  @IsOptional()
  @IsUUID()
  public readonly healthRecordId?: string;

  @ApiPropertyOptional({
    description: "Filter by escalation level",
    enum: HealthEscalationLevel,
  })
  @IsOptional()
  @IsEnum(HealthEscalationLevel)
  public readonly level?: HealthEscalationLevel;

  @ApiPropertyOptional({
    description: "Filter by notification channel",
    enum: ReminderChannel,
  })
  @IsOptional()
  @IsEnum(ReminderChannel)
  public readonly channel?: ReminderChannel;

  @ApiPropertyOptional({
    description: "Filter by delivery status",
    enum: ReminderStatus,
  })
  @IsOptional()
  @IsEnum(ReminderStatus)
  public readonly status?: ReminderStatus;

  @ApiPropertyOptional({
    description: "Filter logs dispatched on or after this ISO date",
    example: "2026-09-01T00:00:00.000Z",
  })
  @IsOptional()
  @IsDateString()
  public readonly startDate?: string;

  @ApiPropertyOptional({
    description: "Filter logs dispatched on or before this ISO date",
    example: "2026-09-30T23:59:59.999Z",
  })
  @IsOptional()
  @IsDateString()
  public readonly endDate?: string;

  @ApiPropertyOptional({
    description: "Page number (1-indexed)",
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public readonly page?: number = 1;

  @ApiPropertyOptional({
    description: "Page limit (max 100)",
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public readonly limit?: number = 20;
}
