import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  AnimalSpecies,
  ConsultationStatus,
  ConsultationType,
  QueryTriageQueueDto as IQueryTriageQueueDto,
} from "@vetralink/shared-types";
import { Type } from "class-transformer";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from "class-validator";

export class QueryTriageQueueDto implements IQueryTriageQueueDto {
  @ApiPropertyOptional({
    description: "Page number for pagination",
    default: 1,
    minimum: 1,
    example: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: "Number of records per page",
    default: 20,
    minimum: 1,
    maximum: 100,
    example: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: "Filter by consultation status, or 'ALL'",
    enum: [...Object.values(ConsultationStatus), "ALL"],
    default: ConsultationStatus.SUBMITTED,
    example: ConsultationStatus.SUBMITTED,
  })
  @IsOptional()
  @IsIn([...Object.values(ConsultationStatus), "ALL"])
  status?: ConsultationStatus | "ALL" = ConsultationStatus.SUBMITTED;

  @ApiPropertyOptional({
    description: "Filter by consultation modality/type",
    enum: ConsultationType,
    example: ConsultationType.ASYNC_TICKET,
  })
  @IsOptional()
  @IsEnum(ConsultationType)
  type?: ConsultationType;

  @ApiPropertyOptional({
    description: "Filter by affected animal species",
    enum: AnimalSpecies,
    example: AnimalSpecies.COW,
  })
  @IsOptional()
  @IsEnum(AnimalSpecies)
  species?: AnimalSpecies;

  @ApiPropertyOptional({
    description: "Filter by specific farm ID",
    example: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
  })
  @IsOptional()
  @IsUUID()
  farmId?: string;

  @ApiPropertyOptional({
    description: "Search keyword matching complaint, farmer, or animal tag",
    example: "fever",
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({
    description: "Filter by earliest submission date (ISO 8601)",
    example: "2026-09-01T00:00:00.000Z",
  })
  @IsOptional()
  @IsISO8601()
  startDate?: string;

  @ApiPropertyOptional({
    description: "Filter by latest submission date (ISO 8601)",
    example: "2026-09-30T23:59:59.999Z",
  })
  @IsOptional()
  @IsISO8601()
  endDate?: string;

  @ApiPropertyOptional({
    description: "Sort column",
    enum: ["createdAt", "status"],
    default: "createdAt",
    example: "createdAt",
  })
  @IsOptional()
  @IsIn(["createdAt", "status"])
  sortBy?: "createdAt" | "status" = "createdAt";

  @ApiPropertyOptional({
    description: "Sort direction ('asc' for FIFO queue, 'desc' for LIFO)",
    enum: ["asc", "desc"],
    default: "asc",
    example: "asc",
  })
  @IsOptional()
  @IsIn(["asc", "desc"])
  sortOrder?: "asc" | "desc" = "asc";
}
