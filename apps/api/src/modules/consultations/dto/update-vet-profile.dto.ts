import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  UpdateVetProfileDto as IUpdateVetProfileDto,
  VetWorkingHoursDto as IVetWorkingHoursDto,
} from "@vetralink/shared-types";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  ValidateNested,
} from "class-validator";

export class VetWorkingHoursDto implements IVetWorkingHoursDto {
  @ApiPropertyOptional({
    description: "Day of week (1 = Monday, 7 = Sunday)",
    minimum: 1,
    maximum: 7,
    example: 1,
  })
  @IsInt()
  @Min(1)
  @Max(7)
  dayOfWeek!: number;

  @ApiPropertyOptional({
    description: "Shift start time (HH:mm in 24h format)",
    example: "08:00",
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: "startTime must be in HH:mm format (e.g. 08:00)",
  })
  startTime!: string;

  @ApiPropertyOptional({
    description: "Shift end time (HH:mm in 24h format)",
    example: "17:00",
  })
  @IsString()
  @Matches(/^([01]\d|2[0-3]):([0-5]\d)$/, {
    message: "endTime must be in HH:mm format (e.g. 17:00)",
  })
  endTime!: string;
}

export class UpdateVetProfileDto implements IUpdateVetProfileDto {
  @ApiPropertyOptional({
    description: "List of animal species or clinical specialties (e.g., ['COW', 'GOAT', 'SURGERY', 'GENERAL'])",
    example: ["COW", "BUFFALO", "GENERAL"],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  specialties?: string[];

  @ApiPropertyOptional({
    description: "Availability toggle (true = on-duty / accepting cases, false = off-duty)",
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isAvailable?: boolean;

  @ApiPropertyOptional({
    description: "Maximum concurrent active cases (ASSIGNED or IN_PROGRESS) permitted for this veterinarian",
    minimum: 1,
    maximum: 50,
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  maxActiveCases?: number;

  @ApiPropertyOptional({
    description: "Weekly recurring working hours schedule",
    type: [VetWorkingHoursDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VetWorkingHoursDto)
  workingHours?: VetWorkingHoursDto[];

  @ApiPropertyOptional({
    description: "IANA timezone string for the veterinarian",
    example: "America/New_York",
  })
  @IsOptional()
  @IsString()
  timezone?: string;
}
