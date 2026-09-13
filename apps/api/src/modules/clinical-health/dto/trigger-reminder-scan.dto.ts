import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsInt,
  IsOptional,
  Max,
  Min,
} from "class-validator";
import { TriggerReminderScanDto as ITriggerReminderScanDto } from "@vetralink/shared-types";

export class TriggerReminderScanDto implements ITriggerReminderScanDto {
  @ApiPropertyOptional({
    description: "Simulated evaluation date in ISO-8601 format (defaults to current date)",
    example: "2026-09-13",
  })
  @IsOptional()
  @IsDateString()
  public readonly asOfDate?: string;

  @ApiPropertyOptional({
    description: "Number of days ahead to scan for upcoming due dates (default: 7, max: 30)",
    example: 7,
    default: 7,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(30)
  public readonly daysAhead?: number;

  @ApiPropertyOptional({
    description: "If true, simulates the scan and returns preview without sending notifications",
    example: false,
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  public readonly dryRun?: boolean;
}
