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
} from "class-validator";
import {
  CreateVaccineRecordRequestDto,
  VaccineRecordType,
} from "@vetralink/shared-types";

export class CreateVaccineRecordDto implements CreateVaccineRecordRequestDto {
  @ApiProperty({
    example: "a81bc81b-dead-4e5d-abff-90865d1e13b1",
    description: "UUID of the animal receiving vaccination or deworming",
  })
  @IsUUID()
  @IsNotEmpty()
  public readonly animalId!: string;

  @ApiPropertyOptional({
    enum: VaccineRecordType,
    example: VaccineRecordType.VACCINATION,
    default: VaccineRecordType.VACCINATION,
    description: "Type of preventative treatment (VACCINATION or DEWORMING)",
  })
  @IsOptional()
  @IsEnum(VaccineRecordType)
  public readonly recordType?: VaccineRecordType;

  @ApiProperty({
    example: "Foot and Mouth Disease (FMD) Quadrivalent",
    description: "Commercial or biological name of the vaccine/dewormer administered",
  })
  @IsString()
  @IsNotEmpty()
  public readonly vaccineName!: string;

  @ApiPropertyOptional({
    example: "FMD-2026-B89",
    description: "Manufacturing batch/lot number for vaccine traceability",
  })
  @IsOptional()
  @IsString()
  public readonly batchNumber?: string | null;

  @ApiProperty({
    example: 2.5,
    description: "Administered dose amount",
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: "Dose amount must be greater than zero." })
  public readonly doseAmount!: number;

  @ApiPropertyOptional({
    example: "ml",
    default: "ml",
    description: "Measurement unit for dose (ml, mg, tablets, drops)",
  })
  @IsOptional()
  @IsString()
  public readonly doseUnit?: string;

  @ApiProperty({
    example: "2026-09-13T08:30:00.000Z",
    description: "Timestamp when vaccination/deworming was administered",
  })
  @IsDateString()
  @IsNotEmpty()
  public readonly administeredAt!: string;

  @ApiPropertyOptional({
    example: "2027-03-13",
    description: "Recommended next due date for booster or repeated deworming (YYYY-MM-DD)",
  })
  @IsOptional()
  @IsDateString()
  public readonly nextDueDate?: string | null;

  @ApiPropertyOptional({
    example: 18.5,
    default: 0,
    description: "Direct cost incurred for the vaccine/dewormer",
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: "Cost cannot be negative." })
  public readonly cost?: number;

  @ApiPropertyOptional({
    example: "Administered in right prescapular region with sterile needle",
    description: "Clinical or procedural administration notes",
  })
  @IsOptional()
  @IsString()
  public readonly notes?: string | null;
}
