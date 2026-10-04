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
import { MilkLogQueryRequestDto, MilkSession } from "@vetralink/shared-types";

export class MilkLogQueryDto implements MilkLogQueryRequestDto {
  @ApiPropertyOptional({
    example: "a81bc81b-dead-4e5d-abff-90865d1e13b1",
    description: "Filter milk logs by specific animal UUID",
  })
  @IsOptional()
  @IsUUID()
  public readonly animalId?: string;

  @ApiPropertyOptional({
    enum: MilkSession,
    description: "Filter milk logs by session (MORNING, AFTERNOON, EVENING)",
  })
  @IsOptional()
  @IsEnum(MilkSession)
  public readonly session?: MilkSession;

  @ApiPropertyOptional({
    example: "2026-09-01",
    description: "Filter milk logs on or after this date (YYYY-MM-DD)",
  })
  @IsOptional()
  @IsDateString()
  public readonly startDate?: string;

  @ApiPropertyOptional({
    example: "2026-09-13",
    description: "Filter milk logs on or before this date (YYYY-MM-DD)",
  })
  @IsOptional()
  @IsDateString()
  public readonly endDate?: string;

  @ApiPropertyOptional({
    example: 1,
    default: 1,
    description: "Page number (1-based)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public readonly page?: number = 1;

  @ApiPropertyOptional({
    example: 20,
    default: 20,
    description: "Maximum records to return per page (1-100)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public readonly limit?: number = 20;

  @ApiPropertyOptional({
    enum: ["loggedDate", "yieldLiters", "createdAt"],
    default: "loggedDate",
    description: "Field to sort records by",
  })
  @IsOptional()
  @IsIn(["loggedDate", "yieldLiters", "createdAt"])
  public readonly sortBy?: "loggedDate" | "yieldLiters" | "createdAt" = "loggedDate";

  @ApiPropertyOptional({
    enum: ["asc", "desc"],
    default: "desc",
    description: "Sort direction",
  })
  @IsOptional()
  @IsIn(["asc", "desc"])
  public readonly sortOrder?: "asc" | "desc" = "desc";

  @ApiPropertyOptional({
    enum: ["INDIVIDUAL", "BULK", "ALL"],
    default: "ALL",
    description:
      "Filter records by entry type: INDIVIDUAL animal logs, BULK herd tank collections, or ALL",
  })
  @IsOptional()
  @IsIn(["INDIVIDUAL", "BULK", "ALL"])
  public readonly entryType?: "INDIVIDUAL" | "BULK" | "ALL";
}
