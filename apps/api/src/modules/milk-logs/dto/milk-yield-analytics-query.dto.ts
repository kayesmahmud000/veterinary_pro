import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsDateString, IsIn, IsOptional, IsUUID } from "class-validator";
import { MilkYieldAnalyticsQueryDto } from "@vetralink/shared-types";

export class MilkYieldAnalyticsQueryInputDto implements MilkYieldAnalyticsQueryDto {
  @ApiPropertyOptional({
    example: "a81bc81b-dead-4e5d-abff-90865d1e13b1",
    description: "Scope yield analytics to an individual animal UUID. If omitted, computes overall farm analytics.",
  })
  @IsOptional()
  @IsUUID()
  public readonly animalId?: string;

  @ApiPropertyOptional({
    example: "2026-08-14",
    description: "Start date of analytics window (YYYY-MM-DD). Defaults to 30 days prior to end date if omitted.",
  })
  @IsOptional()
  @IsDateString()
  public readonly startDate?: string;

  @ApiPropertyOptional({
    example: "2026-09-13",
    description: "End date of analytics window (YYYY-MM-DD). Defaults to current date if omitted.",
  })
  @IsOptional()
  @IsDateString()
  public readonly endDate?: string;

  @ApiPropertyOptional({
    enum: ["INDIVIDUAL", "BULK", "ALL"],
    default: "ALL",
    description: "Filter yield data source: INDIVIDUAL animal recordings, BULK herd tank collections, or ALL combined.",
  })
  @IsOptional()
  @IsIn(["INDIVIDUAL", "BULK", "ALL"])
  public readonly entryType?: "INDIVIDUAL" | "BULK" | "ALL" = "ALL";
}
