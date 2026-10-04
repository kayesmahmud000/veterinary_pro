import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import {
  UpdateVaccineRecordRequestDto,
  VaccineRecordType,
} from "@vetralink/shared-types";

export class UpdateVaccineRecordDto implements UpdateVaccineRecordRequestDto {
  @ApiPropertyOptional({
    enum: VaccineRecordType,
    description: "Type of preventative treatment (VACCINATION or DEWORMING)",
  })
  @IsOptional()
  @IsEnum(VaccineRecordType)
  public readonly recordType?: VaccineRecordType;

  @ApiPropertyOptional({
    example: "Updated FMD Quadrivalent",
    description: "Vaccine or dewormer product name",
  })
  @IsOptional()
  @IsString()
  public readonly vaccineName?: string;

  @ApiPropertyOptional({
    example: "FMD-2026-B90",
    description: "Updated batch number",
  })
  @IsOptional()
  @IsString()
  public readonly batchNumber?: string | null;

  @ApiPropertyOptional({
    example: 3.0,
    description: "Updated dose amount",
    minimum: 0.01,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01, { message: "Dose amount must be greater than zero." })
  public readonly doseAmount?: number;

  @ApiPropertyOptional({
    example: "ml",
    description: "Updated dose unit",
  })
  @IsOptional()
  @IsString()
  public readonly doseUnit?: string;

  @ApiPropertyOptional({
    example: "2026-09-13T09:00:00.000Z",
    description: "Updated administration timestamp",
  })
  @IsOptional()
  @IsDateString()
  public readonly administeredAt?: string;

  @ApiPropertyOptional({
    example: "2027-03-15",
    description: "Updated next due date (YYYY-MM-DD)",
  })
  @IsOptional()
  @IsDateString()
  public readonly nextDueDate?: string | null;

  @ApiPropertyOptional({
    example: 22.0,
    description: "Updated cost",
    minimum: 0,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0, { message: "Cost cannot be negative." })
  public readonly cost?: number;

  @ApiPropertyOptional({
    example: "Booster administered without adverse reaction",
    description: "Updated notes",
  })
  @IsOptional()
  @IsString()
  public readonly notes?: string | null;

  @ApiPropertyOptional({
    example: 1,
    description: "Optimistic concurrency lock version counter",
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  public readonly syncVersion?: number;
}
