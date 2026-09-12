import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
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
  RegisterAnimalRequestDto,
} from "@vetralink/shared-types";

export class RegisterAnimalDto implements RegisterAnimalRequestDto {
  @ApiProperty({
    example: "COW-00124",
    description: "Unique visual ear tag number for this animal within the farm",
    maxLength: 50,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  public readonly tagNumber!: string;

  @ApiPropertyOptional({
    example: "982000123456789",
    description:
      "Optional electronic RFID transponder, EID, or microchip number (unique per farm)",
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  public readonly rfidNumber?: string | null;

  @ApiPropertyOptional({
    example: "Daisy",
    description: "Optional informal name or nickname of the animal",
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  public readonly name?: string | null;

  @ApiProperty({
    enum: AnimalSpecies,
    example: AnimalSpecies.COW,
    description: "Species taxonomy classification",
  })
  @IsEnum(AnimalSpecies)
  public readonly species!: AnimalSpecies;

  @ApiPropertyOptional({
    example: "Holstein Friesian",
    description: "Specific breed classification",
    maxLength: 100,
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  public readonly breed?: string | null;

  @ApiProperty({
    enum: AnimalGender,
    example: AnimalGender.FEMALE,
    description: "Biological sex of the animal",
  })
  @IsEnum(AnimalGender)
  public readonly gender!: AnimalGender;

  @ApiPropertyOptional({
    example: "2023-04-15",
    description: "Date of birth in ISO 8601 YYYY-MM-DD format (cannot be future date)",
  })
  @IsOptional()
  @IsDateString()
  public readonly dateOfBirth?: string | null;

  @ApiPropertyOptional({
    example: 450.5,
    description: "Weight in kilograms (0.01 - 9999.99)",
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
    default: AnimalStatus.ACTIVE,
    description: "Current herd operational status",
  })
  @IsOptional()
  @IsEnum(AnimalStatus)
  public readonly status?: AnimalStatus;

  @ApiPropertyOptional({
    example: "c7f99ff9-7b3b-48aa-b5a8-ef6e534f3c7a",
    description: "UUID of the biological sire (male parent) in the same farm",
  })
  @IsOptional()
  @IsUUID("4")
  public readonly sireId?: string | null;

  @ApiPropertyOptional({
    example: "a1e88ff8-7b3b-48aa-b5a8-ef6e534f3c7b",
    description: "UUID of the biological dam (female parent) in the same farm",
  })
  @IsOptional()
  @IsUUID("4")
  public readonly damId?: string | null;

  @ApiPropertyOptional({
    example: { hornStatus: "polled", lactationNumber: 2 },
    description: "Arbitrary species-specific or farm-specific JSON metadata",
  })
  @IsOptional()
  @IsObject()
  public readonly metadata?: Record<string, unknown>;
}
