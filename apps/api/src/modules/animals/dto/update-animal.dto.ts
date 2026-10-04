import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import {
  AnimalGender,
  AnimalSpecies,
  AnimalStatus,
  UpdateAnimalRequestDto,
} from "@vetralink/shared-types";

export class UpdateAnimalDto implements UpdateAnimalRequestDto {
  @ApiPropertyOptional({
    example: "COW-00124-B",
    description: "Updated visual ear tag number",
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  public readonly tagNumber?: string;

  @ApiPropertyOptional({
    example: "982000123456789",
    description:
      "Updated electronic RFID transponder, EID, or microchip number",
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  public readonly rfidNumber?: string | null;

  @ApiPropertyOptional({
    example: "Daisy Bell",
    description: "Updated informal name",
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  public readonly name?: string | null;

  @ApiPropertyOptional({
    enum: AnimalSpecies,
    example: AnimalSpecies.COW,
    description: "Species classification",
  })
  @IsOptional()
  @IsEnum(AnimalSpecies)
  public readonly species?: AnimalSpecies;

  @ApiPropertyOptional({
    example: "Jersey",
    description: "Breed classification",
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  public readonly breed?: string | null;

  @ApiPropertyOptional({
    enum: AnimalGender,
    example: AnimalGender.FEMALE,
    description: "Biological sex",
  })
  @IsOptional()
  @IsEnum(AnimalGender)
  public readonly gender?: AnimalGender;

  @ApiPropertyOptional({
    example: "2023-04-15",
    description: "Date of birth in ISO 8601 YYYY-MM-DD format",
  })
  @IsOptional()
  @IsDateString()
  public readonly dateOfBirth?: string | null;

  @ApiPropertyOptional({
    example: 465.0,
    description: "Updated weight in kilograms",
    minimum: 0.01,
    maximum: 9999.99,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  @Max(9999.99)
  public readonly weightKg?: number | null;

  @ApiPropertyOptional({
    enum: AnimalStatus,
    description: "Operational status",
  })
  @IsOptional()
  @IsEnum(AnimalStatus)
  public readonly status?: AnimalStatus;

  @ApiPropertyOptional({
    example: "c7f99ff9-7b3b-48aa-b5a8-ef6e534f3c7a",
    description: "Sire UUID in the same farm",
  })
  @IsOptional()
  @IsUUID("4")
  public readonly sireId?: string | null;

  @ApiPropertyOptional({
    example: "a1e88ff8-7b3b-48aa-b5a8-ef6e534f3c7b",
    description: "Dam UUID in the same farm",
  })
  @IsOptional()
  @IsUUID("4")
  public readonly damId?: string | null;

  @ApiPropertyOptional({
    example: { hornStatus: "polled", lactationNumber: 3 },
    description: "Custom metadata payload",
  })
  @IsOptional()
  @IsObject()
  public readonly metadata?: Record<string, unknown>;
}
