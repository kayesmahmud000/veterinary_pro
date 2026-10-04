import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { ResolveHealthIncidentRequestDto } from "@vetralink/shared-types";

export class ResolveHealthIncidentDto implements ResolveHealthIncidentRequestDto {
  @ApiPropertyOptional({
    example: "2026-09-14T10:00:00.000Z",
    description: "Timestamp of clinical recovery/resolution (defaults to current time if omitted)",
  })
  @IsOptional()
  @IsDateString()
  public readonly resolvedAt?: string | null;

  @ApiPropertyOptional({
    example: "Resolved: Full clinical recovery following 3-day treatment",
    description: "Final clinical diagnosis or resolution assessment",
  })
  @IsOptional()
  @IsString()
  public readonly diagnosis?: string | null;

  @ApiPropertyOptional({
    example: "Completed scheduled antibiotic regimen and discharged from quarantine",
    description: "Final treatment outcome notes",
  })
  @IsOptional()
  @IsString()
  public readonly treatment?: string | null;

  @ApiPropertyOptional({
    example: 65.5,
    description: "Final cumulative treatment and medication cost",
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: "Treatment cost cannot be negative." })
  public readonly cost?: number;

  @ApiPropertyOptional({
    example: 1,
    description: "Optimistic concurrency lock version counter",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  public readonly syncVersion?: number;
}
