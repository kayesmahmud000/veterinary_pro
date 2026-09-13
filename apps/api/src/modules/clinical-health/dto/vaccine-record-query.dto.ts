import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import {
  PreventativeScheduleStatus,
  VaccineRecordQueryDto as IVaccineRecordQueryDto,
  VaccineRecordType,
} from "@vetralink/shared-types";

export class VaccineRecordQueryDto implements IVaccineRecordQueryDto {
  @ApiPropertyOptional({
    example: "a81bc81b-dead-4e5d-abff-90865d1e13b1",
    description: "Filter by specific animal UUID",
  })
  @IsOptional()
  @IsUUID()
  public readonly animalId?: string;

  @ApiPropertyOptional({
    enum: VaccineRecordType,
    description: "Filter by treatment type (VACCINATION or DEWORMING)",
  })
  @IsOptional()
  @IsEnum(VaccineRecordType)
  public readonly recordType?: VaccineRecordType;

  @ApiPropertyOptional({
    enum: PreventativeScheduleStatus,
    description: "Filter by schedule status (UPCOMING, DUE_SOON, OVERDUE, COMPLETED)",
  })
  @IsOptional()
  @IsEnum(PreventativeScheduleStatus)
  public readonly status?: PreventativeScheduleStatus;

  @ApiPropertyOptional({
    example: "2026-09-01",
    description: "Filter administered on or after this date",
  })
  @IsOptional()
  @IsDateString()
  public readonly startDate?: string;

  @ApiPropertyOptional({
    example: "2026-09-30",
    description: "Filter administered on or before this date",
  })
  @IsOptional()
  @IsDateString()
  public readonly endDate?: string;

  @ApiPropertyOptional({
    example: "2027-01-01",
    description: "Filter events with next due date on or after this date",
  })
  @IsOptional()
  @IsDateString()
  public readonly dueAfter?: string;

  @ApiPropertyOptional({
    example: "2027-03-31",
    description: "Filter events with next due date on or before this date",
  })
  @IsOptional()
  @IsDateString()
  public readonly dueBefore?: string;

  @ApiPropertyOptional({
    example: 1,
    default: 1,
    description: "Page number",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public readonly page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    default: 20,
    description: "Page size",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public readonly limit?: number = 20;

  @ApiPropertyOptional({
    enum: ["administeredAt", "nextDueDate", "createdAt", "cost"],
    default: "administeredAt",
  })
  @IsOptional()
  @IsIn(["administeredAt", "nextDueDate", "createdAt", "cost"])
  public readonly sortBy?: "administeredAt" | "nextDueDate" | "createdAt" | "cost" = "administeredAt";

  @ApiPropertyOptional({
    enum: ["asc", "desc"],
    default: "desc",
  })
  @IsOptional()
  @IsIn(["asc", "desc"])
  public readonly sortOrder?: "asc" | "desc" = "desc";
}
