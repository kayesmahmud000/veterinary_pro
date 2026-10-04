import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
} from "class-validator";
import { FeedConversionQueryDto as IFeedConversionQueryDto } from "@vetralink/shared-types";

export class FeedConversionQueryDto implements IFeedConversionQueryDto {
  @ApiPropertyOptional({
    description: "Start date of evaluation window (YYYY-MM-DD, defaults to start of current month)",
    example: "2026-09-01",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: "End date of evaluation window (YYYY-MM-DD, defaults to current date)",
    example: "2026-09-30",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: "Filter FCR analysis to a specific animal UUID",
    example: "c7b415b3-3a1b-4f93-b816-c73db2f60d3d",
  })
  @IsOptional()
  @IsUUID()
  animalId?: string;

  @ApiPropertyOptional({
    description: "Optional manual override of total feed intake (kg) during the period",
    example: 1500,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  assumedFeedKg?: number;

  @ApiPropertyOptional({
    description: "Optional manual override of feed price per kg (currency/kg)",
    example: 0.35,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  assumedFeedCostPerKg?: number;
}
