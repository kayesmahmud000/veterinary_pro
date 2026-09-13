import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from "class-validator";
import { CreateMilkLogRequestDto, MilkSession } from "@vetralink/shared-types";

export class CreateMilkLogDto implements CreateMilkLogRequestDto {
  @ApiProperty({
    example: "a81bc81b-dead-4e5d-abff-90865d1e13b1",
    description: "UUID of the female lactating animal producing the milk",
  })
  @IsUUID()
  @IsNotEmpty()
  public readonly animalId!: string;

  @ApiProperty({
    enum: MilkSession,
    example: MilkSession.MORNING,
    description: "Milking session (MORNING, AFTERNOON, EVENING)",
  })
  @IsEnum(MilkSession)
  @IsNotEmpty()
  public readonly session!: MilkSession;

  @ApiProperty({
    example: 14.75,
    description: "Milk yield in liters for this session (up to 3 decimal places)",
    minimum: 0.001,
    maximum: 100,
  })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001, { message: "Yield must be greater than 0 liters." })
  @Max(100, { message: "Yield cannot exceed 100 liters in a single session." })
  public readonly yieldLiters!: number;

  @ApiPropertyOptional({
    example: 3.85,
    description: "Milk fat percentage (0.00% to 20.00%)",
    minimum: 0,
    maximum: 20,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(20)
  public readonly fatPercent?: number | null;

  @ApiPropertyOptional({
    example: 8.65,
    description: "Milk Solids-Not-Fat (SNF) percentage (0.00% to 20.00%)",
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
}
