import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsOptional,
} from "class-validator";
import { TriggerEscalationScanDto as ITriggerEscalationScanDto } from "@vetralink/shared-types";

export class TriggerEscalationScanDto implements ITriggerEscalationScanDto {
  @ApiPropertyOptional({
    description: "Simulated evaluation date in ISO-8601 format (defaults to current date)",
    example: "2026-09-13",
  })
  @IsOptional()
  @IsDateString()
  public readonly asOfDate?: string;

  @ApiPropertyOptional({
    description: "If true, simulates the scan and returns preview without sending notifications or mutating state",
    example: false,
    default: false,
  })
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  public readonly dryRun?: boolean;
}
