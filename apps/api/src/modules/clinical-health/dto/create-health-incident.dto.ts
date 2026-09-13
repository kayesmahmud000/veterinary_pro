import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  MinLength,
} from "class-validator";
import {
  CreateHealthIncidentRequestDto,
  HealthEventType,
  SeverityLevel,
} from "@vetralink/shared-types";

export class CreateHealthIncidentDto implements CreateHealthIncidentRequestDto {
  @ApiProperty({
    example: "a81bc81b-dead-4e5d-abff-90865d1e13b1",
    description: "UUID of the animal experiencing the health incident",
  })
  @IsUUID()
  @IsNotEmpty()
  public readonly animalId!: string;

  @ApiProperty({
    enum: HealthEventType,
    example: HealthEventType.ILLNESS,
    description: "Category of clinical health event",
  })
  @IsEnum(HealthEventType)
  @IsNotEmpty()
  public readonly eventType!: HealthEventType;

  @ApiPropertyOptional({
    enum: SeverityLevel,
    example: SeverityLevel.MEDIUM,
    description: "Clinical severity grade (LOW, MEDIUM, HIGH, CRITICAL)",
    default: SeverityLevel.LOW,
  })
  @IsOptional()
  @IsEnum(SeverityLevel)
  public readonly severity?: SeverityLevel;

  @ApiProperty({
    example: "Animal exhibits sudden lethargy, nasal discharge, and elevated temperature (40.5C).",
    description: "Detailed description of clinical symptoms and abnormal signs",
    minLength: 3,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: "Symptoms must be at least 3 characters long." })
  public readonly symptoms!: string;

  @ApiPropertyOptional({
    example: "Suspected Bovine Respiratory Disease (BRD)",
    description: "Clinical or provisional veterinary diagnosis",
  })
  @IsOptional()
  @IsString()
  public readonly diagnosis?: string | null;

  @ApiPropertyOptional({
    example: "Administered NSAID and antimicrobial therapy according to protocol",
    description: "Prescribed medication, therapy or procedural treatment details",
  })
  @IsOptional()
  @IsString()
  public readonly treatment?: string | null;

  @ApiPropertyOptional({
    example: 45.0,
    description: "Total cost of clinical treatment and medications in farm currency",
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: "Treatment cost cannot be negative." })
  public readonly cost?: number;

  @ApiPropertyOptional({
    example: "b92bc81b-dead-4e5d-abff-90865d1e13c2",
    description: "UUID of attending veterinarian or veterinary staff member",
  })
  @IsOptional()
  @IsUUID()
  public readonly attendingVetId?: string | null;

  @ApiPropertyOptional({
    example: "2026-09-13T10:30:00.000Z",
    description: "Optional resolution date/time if incident is already resolved upon logging",
  })
  @IsOptional()
  @IsDateString()
  public readonly resolvedAt?: string | null;
}
