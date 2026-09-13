import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsString, Length } from "class-validator";
import { ProfitLossSummaryQueryDto as IProfitLossSummaryQueryDto } from "@vetralink/shared-types";

export class ProfitLossSummaryQueryDto implements IProfitLossSummaryQueryDto {
  @ApiPropertyOptional({
    description: "Start date of P&L window (YYYY-MM-DD, defaults to start of current month)",
    example: "2026-09-01",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: "End date of P&L window (YYYY-MM-DD, defaults to today)",
    example: "2026-09-13",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: "Currency code (ISO 4217, default: USD)",
    example: "USD",
    default: "USD",
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;
}
