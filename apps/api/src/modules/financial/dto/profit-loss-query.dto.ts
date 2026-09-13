import { ApiPropertyOptional } from "@nestjs/swagger";
import { Transform } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from "class-validator";
import {
  ProfitLossInterval,
  ProfitLossQueryDto as IProfitLossQueryDto,
} from "@vetralink/shared-types";

export class ProfitLossQueryDto implements IProfitLossQueryDto {
  @ApiPropertyOptional({
    description: "Start date of P&L window (YYYY-MM-DD, defaults to start of current month)",
    example: "2026-09-01",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: "End date of P&L window (YYYY-MM-DD, defaults to today or end of current month)",
    example: "2026-09-30",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: "Grouping interval for time-series chart data points (DAY, WEEK, MONTH, YEAR)",
    enum: ProfitLossInterval,
    default: ProfitLossInterval.DAY,
  })
  @IsOptional()
  @IsEnum(ProfitLossInterval)
  interval?: ProfitLossInterval;

  @ApiPropertyOptional({
    description: "Filter P&L metrics to a specific animal UUID",
    example: "c7b415b3-3a1b-4f93-b816-c73db2f60d3d",
  })
  @IsOptional()
  @IsUUID()
  animalId?: string;

  @ApiPropertyOptional({
    description: "Currency code (ISO 4217, default: USD)",
    example: "USD",
    default: "USD",
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({
    description: "Whether to include comparative metrics for the preceding equivalent period",
    default: false,
  })
  @IsOptional()
  @Transform(({ value }) => value === "true" || value === true)
  @IsBoolean()
  includePreviousPeriod?: boolean;
}
