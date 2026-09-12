import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsInt, IsISO8601, IsOptional, Max, Min } from "class-validator";
import { WeightHistoryQueryDto } from "@vetralink/shared-types";

export class WeightHistoryQueryRequestDto implements WeightHistoryQueryDto {
  @ApiPropertyOptional({
    description: "Filter weigh-in records on or after this ISO date",
    example: "2024-01-01",
  })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({
    description: "Filter weigh-in records on or before this ISO date",
    example: "2024-12-31",
  })
  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @ApiPropertyOptional({
    description: "Page number (1-indexed)",
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: "Items per page (max 100)",
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
