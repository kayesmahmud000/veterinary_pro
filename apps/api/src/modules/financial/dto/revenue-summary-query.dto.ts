import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsOptional, IsUUID } from "class-validator";
import { RevenueSummaryQueryDto as IRevenueSummaryQueryDto } from "@vetralink/shared-types";

export class RevenueSummaryQueryDto implements IRevenueSummaryQueryDto {
  @ApiPropertyOptional({
    description:
      "Start date for revenue aggregation window (YYYY-MM-DD, defaults to 30 days ago)",
    example: "2026-08-14",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description:
      "End date for revenue aggregation window (YYYY-MM-DD, defaults to current date)",
    example: "2026-09-13",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: "Filter summary analytics to a specific animal UUID",
    example: "c7b415b3-3a1b-4f93-b816-c73db2f60d3d",
  })
  @IsOptional()
  @IsUUID()
  animalId?: string;
}
