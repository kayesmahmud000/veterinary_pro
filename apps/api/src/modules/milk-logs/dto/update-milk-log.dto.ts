import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  Max,
  Min,
} from "class-validator";
import { MilkSession, UpdateMilkLogRequestDto } from "@vetralink/shared-types";

export class UpdateMilkLogDto implements UpdateMilkLogRequestDto {
  @ApiPropertyOptional({
    example: 15.2,
    description: "Updated milk yield in liters",
    minimum: 0.001,
    maximum: 100,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001, { message: "Yield must be greater than 0 liters." })
  @Max(100, { message: "Yield cannot exceed 100 liters in a single session." })
  public readonly yieldLiters?: number;

  @ApiPropertyOptional({
    example: 4.1,
    description: "Updated fat percentage (0.00% to 20.00%)",
    minimum: 0,
    maximum: 20,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(20)
  public readonly fatPercent?: number | null;

  @ApiPropertyOptional({
    example: 8.8,
    description: "Updated solids-not-fat (SNF) percentage (0.00% to 20.00%)",
    minimum: 0,
    maximum: 20,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(20)
  public readonly snfPercent?: number | null;

  @ApiPropertyOptional({
    enum: MilkSession,
    example: MilkSession.EVENING,
    description: "Updated milking session",
  })
  @IsOptional()
  @IsEnum(MilkSession)
  public readonly session?: MilkSession;

  @ApiPropertyOptional({
    example: "2026-09-13",
    description: "Updated date of the milking session (YYYY-MM-DD)",
  })
  @IsOptional()
  @IsDateString()
  public readonly loggedDate?: string;
}
