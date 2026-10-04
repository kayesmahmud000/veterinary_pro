import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from "class-validator";
import {
  UpdateHealthIncidentRequestDto,
  HealthEventType,
  SeverityLevel,
} from "@vetralink/shared-types";

export class UpdateHealthIncidentDto implements UpdateHealthIncidentRequestDto {
  @ApiPropertyOptional({
    enum: HealthEventType,
    example: HealthEventType.ILLNESS,
    description: "Updated category of clinical health event",
  })
  @IsOptional()
  @IsEnum(HealthEventType)
  public readonly eventType?: HealthEventType;

  @ApiPropertyOptional({
    enum: SeverityLevel,
    example: SeverityLevel.HIGH,
    description: "Updated clinical severity grade",
  })
  @IsOptional()
  @IsEnum(SeverityLevel)
  public readonly severity?: SeverityLevel;

  @ApiPropertyOptional({
    example: "Persistent dry cough, respiratory distress, and reduced feed intake.",
    description: "Updated symptoms description",
    minLength: 3,
  })
  @IsOptional()
  @IsString()
  @MinLength(3, { message: "Symptoms must be at least 3 characters long." })
  public readonly symptoms?: string;

  @ApiPropertyOptional({
    example: "Confirmed acute bronchopneumonia",
    description: "Updated veterinary diagnosis",
  })
  @IsOptional()
  @IsString()
  public readonly diagnosis?: string | null;

  @ApiPropertyOptional({
    example: "Completed 3-day course of broad-spectrum antibiotics and anti-inflammatories",
    description: "Updated treatment regimen",
  })
  @IsOptional()
  @IsString()
  public readonly treatment?: string | null;

  @ApiPropertyOptional({
    example: 65.5,
    description: "Updated total treatment cost",
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: "Treatment cost cannot be negative." })
  public readonly cost?: number;

  @ApiPropertyOptional({
    example: "b92bc81b-dead-4e5d-abff-90865d1e13c2",
    description: "Attending veterinarian UUID",
  })
  @IsOptional()
  @IsUUID()
  public readonly attendingVetId?: string | null;

  @ApiPropertyOptional({
    example: "2026-09-14T14:00:00.000Z",
    description: "Updated resolution date/time",
  })
  @IsOptional()
  @IsDateString()
  public readonly resolvedAt?: string | null;

  @ApiPropertyOptional({
    example: 1,
    description: "Optimistic concurrency lock version counter",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  public readonly syncVersion?: number;
}
