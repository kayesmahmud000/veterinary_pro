import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDateString, IsInt, IsOptional, Max, Min } from "class-validator";
import { QuerySaasMetricsDto } from "@vetralink/shared-types";

export class QuerySaasMetricsRequestDto implements QuerySaasMetricsDto {
  @ApiPropertyOptional({
    description: "Start date for trend aggregation (ISO 8601)",
    example: "2026-01-01T00:00:00.000Z",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: "End date for trend aggregation (ISO 8601)",
    example: "2026-09-20T23:59:59.999Z",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: "Number of monthly cohort periods to look back (default: 6, max: 36)",
    example: 6,
    default: 6,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(36)
  months?: number;
}
