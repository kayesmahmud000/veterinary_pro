import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import {
  HealthEventType,
  HealthIncidentQueryDto as IHealthIncidentQueryDto,
  SeverityLevel,
} from "@vetralink/shared-types";

export class HealthIncidentQueryDto implements IHealthIncidentQueryDto {
  @ApiPropertyOptional({
    example: "a81bc81b-dead-4e5d-abff-90865d1e13b1",
    description: "Filter health incidents by specific animal UUID",
  })
  @IsOptional()
  @IsUUID()
  public readonly animalId?: string;

  @ApiPropertyOptional({
    enum: HealthEventType,
    description: "Filter health incidents by category",
  })
  @IsOptional()
  @IsEnum(HealthEventType)
  public readonly eventType?: HealthEventType;

  @ApiPropertyOptional({
    enum: SeverityLevel,
    description: "Filter health incidents by clinical severity grade",
  })
  @IsOptional()
  @IsEnum(SeverityLevel)
  public readonly severity?: SeverityLevel;

  @ApiPropertyOptional({
    example: false,
    description: "Filter by resolution status (true = resolved, false = active/unresolved)",
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true" || value === true) return true;
    if (value === "false" || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  public readonly isResolved?: boolean;

  @ApiPropertyOptional({
    example: "2026-09-01",
    description: "Filter incidents recorded on or after this date (ISO 8601 or YYYY-MM-DD)",
  })
  @IsOptional()
  @IsDateString()
  public readonly startDate?: string;

  @ApiPropertyOptional({
    example: "2026-09-13",
    description: "Filter incidents recorded on or before this date (ISO 8601 or YYYY-MM-DD)",
  })
  @IsOptional()
  @IsDateString()
  public readonly endDate?: string;

  @ApiPropertyOptional({
    example: 1,
    default: 1,
    description: "Page number (1-based)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public readonly page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    default: 20,
    description: "Maximum records to return per page (1-100)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public readonly limit?: number = 20;

  @ApiPropertyOptional({
    enum: ["createdAt", "severity", "cost", "resolvedAt"],
    default: "createdAt",
    description: "Field to sort results by",
  })
  @IsOptional()
  @IsIn(["createdAt", "severity", "cost", "resolvedAt"])
  public readonly sortBy?: "createdAt" | "severity" | "cost" | "resolvedAt" = "createdAt";

  @ApiPropertyOptional({
    enum: ["asc", "desc"],
    default: "desc",
    description: "Sort direction",
  })
  @IsOptional()
  @IsIn(["asc", "desc"])
  public readonly sortOrder?: "asc" | "desc" = "desc";
}
