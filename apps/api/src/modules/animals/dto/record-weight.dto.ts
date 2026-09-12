import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from "class-validator";
import { RecordWeightDto } from "@vetralink/shared-types";

export class RecordWeightRequestDto implements RecordWeightDto {
  @ApiProperty({
    description: "Measured body weight in kilograms",
    example: 540.25,
    minimum: 0.1,
    maximum: 2500,
  })
  @IsNotEmpty()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.1)
  @Max(2500)
  weightKg!: number;

  @ApiProperty({
    description: "Timestamp of weigh-in (ISO 8601)",
    example: "2024-03-15T08:30:00.000Z",
  })
  @IsNotEmpty()
  @IsISO8601()
  recordedAt!: string;

  @ApiPropertyOptional({
    description: "Optional notes regarding diet, health, or weighing condition",
    example: "Post-milking weigh-in on calibrated digital scale.",
    maxLength: 1000,
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
