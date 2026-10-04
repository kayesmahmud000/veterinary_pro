import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import { CreateBulkMilkLogRequestDto, MilkSession } from "@vetralink/shared-types";

export class CreateBulkMilkLogDto implements CreateBulkMilkLogRequestDto {
  @ApiProperty({
    enum: MilkSession,
    example: MilkSession.MORNING,
    description: "Milking session (MORNING, AFTERNOON, EVENING)",
  })
  @IsEnum(MilkSession)
  @IsNotEmpty()
  public readonly session!: MilkSession;

  @ApiProperty({
    example: 850.5,
    description: "Total bulk milk yield in liters collected in the cooling tank (up to 100,000L)",
    minimum: 0.1,
    maximum: 100000,
  })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.1, { message: "Bulk yield must be at least 0.1 liters." })
  @Max(100000, { message: "Bulk yield cannot exceed 100,000 liters in a single session." })
  public readonly yieldLiters!: number;

  @ApiPropertyOptional({
    example: 3.95,
    description: "Bulk tank milk fat percentage (0.00% to 20.00%)",
    minimum: 0,
    maximum: 20,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(20)
  public readonly fatPercent?: number | null;

  @ApiPropertyOptional({
    example: 8.75,
    description: "Bulk tank milk Solids-Not-Fat (SNF) percentage (0.00% to 20.00%)",
    minimum: 0,
    maximum: 20,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(20)
  public readonly snfPercent?: number | null;

  @ApiProperty({
    example: "2026-09-13",
    description: "Date of the milking session (YYYY-MM-DD)",
  })
  @IsDateString()
  @IsNotEmpty()
  public readonly loggedDate!: string;

  @ApiPropertyOptional({
    example: 65,
    description: "Total number of animals contributing to this bulk milking session",
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public readonly milkingAnimalsCount?: number | null;

  @ApiPropertyOptional({
    example: 3.8,
    description: "Bulk milk cooling tank temperature in Celsius (-5.0°C to 45.0°C)",
    minimum: -5,
    maximum: 45,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(-5)
  @Max(45)
  public readonly tankTemperatureCelsius?: number | null;

  @ApiPropertyOptional({
    example: "Morning parlour milking - cooling compressor running normally",
    description: "Operational notes or comments for this bulk collection",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  public readonly notes?: string | null;
}
