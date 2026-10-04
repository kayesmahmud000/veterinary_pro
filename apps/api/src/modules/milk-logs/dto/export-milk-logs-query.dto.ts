import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import {
  ExportMilkLogsRequestDto,
  MilkExportFormat,
  MilkSession,
} from "@vetralink/shared-types";

export class ExportMilkLogsQueryDto implements ExportMilkLogsRequestDto {
  @ApiPropertyOptional({
    enum: MilkExportFormat,
    default: MilkExportFormat.CSV,
    description: "Export file format (CSV or EXCEL)",
  })
  @IsOptional()
  @IsEnum(MilkExportFormat)
  public readonly format?: MilkExportFormat = MilkExportFormat.CSV;

  @ApiPropertyOptional({
    example: "2026-09-01",
    description: "Filter milk logs on or after this date (YYYY-MM-DD)",
  })
  @IsOptional()
  @IsDateString()
  public readonly startDate?: string;

  @ApiPropertyOptional({
    example: "2026-09-13",
    description: "Filter milk logs on or before this date (YYYY-MM-DD)",
  })
  @IsOptional()
  @IsDateString()
  public readonly endDate?: string;

  @ApiPropertyOptional({
    example: "a81bc81b-dead-4e5d-abff-90865d1e13b1",
    description: "Filter milk logs by specific animal UUID",
  })
  @IsOptional()
  @IsUUID()
  public readonly animalId?: string;

  @ApiPropertyOptional({
    enum: MilkSession,
    description: "Filter milk logs by session (MORNING, AFTERNOON, EVENING)",
  })
  @IsOptional()
  @IsEnum(MilkSession)
  public readonly session?: MilkSession;

  @ApiPropertyOptional({
    enum: ["INDIVIDUAL", "BULK", "ALL"],
    default: "ALL",
    description: "Filter by record entry type",
  })
  @IsOptional()
  @IsIn(["INDIVIDUAL", "BULK", "ALL"])
  public readonly entryType?: "INDIVIDUAL" | "BULK" | "ALL" = "ALL";

  @ApiPropertyOptional({
    example: 5000,
    default: 5000,
    description: "Maximum number of records to export (up to 10000)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  public readonly limit?: number = 5000;
}
