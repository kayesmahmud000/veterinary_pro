import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from "class-validator";
import { MonthlyStatementQueryDto as IMonthlyStatementQueryDto } from "@vetralink/shared-types";

export class MonthlyStatementQueryDto implements IMonthlyStatementQueryDto {
  @ApiPropertyOptional({
    description: "Target reporting year (e.g. 2026, defaults to current year)",
    example: 2026,
    minimum: 2000,
    maximum: 2100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(2000)
  @Max(2100)
  year?: number;

  @ApiPropertyOptional({
    description: "Target reporting month (1-12, defaults to current month)",
    example: 9,
    minimum: 1,
    maximum: 12,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @ApiPropertyOptional({
    description: "Statement currency code (ISO 4217, default: USD)",
    example: "USD",
    default: "USD",
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;
}
