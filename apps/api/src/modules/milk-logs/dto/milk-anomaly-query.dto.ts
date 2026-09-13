import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";
import {
  AcknowledgeMilkAnomalyRequestDto,
  MilkAnomalyQueryRequestDto,
  MilkAnomalySeverity,
  MilkAnomalyStatus,
  ResolveMilkAnomalyRequestDto,
  TriggerAnomalyScanRequestDto,
} from "@vetralink/shared-types";

export class MilkAnomalyQueryDto implements MilkAnomalyQueryRequestDto {
  @ApiPropertyOptional({
    example: "a81bc81b-dead-4e5d-abff-90865d1e13b1",
    description: "Filter anomalies by specific animal UUID",
  })
  @IsOptional()
  @IsUUID()
  public readonly animalId?: string;

  @ApiPropertyOptional({
    enum: MilkAnomalySeverity,
    description: "Filter anomalies by severity (LOW, MEDIUM, CRITICAL)",
  })
  @IsOptional()
  @IsEnum(MilkAnomalySeverity)
  public readonly severity?: MilkAnomalySeverity;

  @ApiPropertyOptional({
    enum: MilkAnomalyStatus,
    description:
      "Filter anomalies by lifecycle status (DETECTED, ACKNOWLEDGED, RESOLVED, FALSE_POSITIVE)",
  })
  @IsOptional()
  @IsEnum(MilkAnomalyStatus)
  public readonly status?: MilkAnomalyStatus;

  @ApiPropertyOptional({
    example: "2026-09-01",
    description: "Filter anomalies on or after this date (YYYY-MM-DD)",
  })
  @IsOptional()
  @IsDateString()
  public readonly startDate?: string;

  @ApiPropertyOptional({
    example: "2026-09-13",
    description: "Filter anomalies on or before this date (YYYY-MM-DD)",
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
    description: "Maximum records per page (1-100)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public readonly limit?: number = 20;
}

export class AcknowledgeMilkAnomalyDto implements AcknowledgeMilkAnomalyRequestDto {
  @ApiPropertyOptional({
    example: "Cow observed with slight udder swelling in rear-left quarter. Performing CMT.",
    description: "Clinical or veterinary assessment notes when acknowledging alert",
  })
  @IsOptional()
  @IsString()
  public readonly clinicalNotes?: string;
}

export class ResolveMilkAnomalyDto implements ResolveMilkAnomalyRequestDto {
  @ApiPropertyOptional({
    example: "CMT negative; drop was due to delayed afternoon parlour shift.",
    description: "Veterinary resolution notes and root-cause summary",
  })
  @IsOptional()
  @IsString()
  public readonly resolutionNotes?: string;

  @ApiPropertyOptional({
    enum: [MilkAnomalyStatus.RESOLVED, MilkAnomalyStatus.FALSE_POSITIVE],
    default: MilkAnomalyStatus.RESOLVED,
    description: "Resolution outcome status",
  })
  @IsOptional()
  @IsIn([MilkAnomalyStatus.RESOLVED, MilkAnomalyStatus.FALSE_POSITIVE])
  public readonly status?:
    | MilkAnomalyStatus.RESOLVED
    | MilkAnomalyStatus.FALSE_POSITIVE = MilkAnomalyStatus.RESOLVED;
}

export class TriggerAnomalyScanDto implements TriggerAnomalyScanRequestDto {
  @ApiPropertyOptional({
    example: "2026-09-13",
    description: "Target date to evaluate (YYYY-MM-DD). Defaults to current date if omitted.",
  })
  @IsOptional()
  @IsDateString()
  public readonly targetDate?: string;
}
