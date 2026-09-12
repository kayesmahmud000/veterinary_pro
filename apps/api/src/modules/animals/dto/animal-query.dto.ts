import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { Type } from "class-transformer";
import {
  AnimalGender,
  AnimalQueryFilterDto,
  AnimalSortBy,
  AnimalSpecies,
  AnimalStatus,
  SortOrder,
} from "@vetralink/shared-types";

export class AnimalQueryDto implements AnimalQueryFilterDto {
  @ApiPropertyOptional({
    enum: AnimalSpecies,
    description: "Filter animals by species",
  })
  @IsOptional()
  @IsEnum(AnimalSpecies)
  public readonly species?: AnimalSpecies;

  @ApiPropertyOptional({
    enum: AnimalGender,
    description: "Filter animals by biological sex",
  })
  @IsOptional()
  @IsEnum(AnimalGender)
  public readonly gender?: AnimalGender;

  @ApiPropertyOptional({
    enum: AnimalStatus,
    description: "Filter animals by operational status",
  })
  @IsOptional()
  @IsEnum(AnimalStatus)
  public readonly status?: AnimalStatus;

  @ApiPropertyOptional({
    example: "COW-00",
    description: "Case-insensitive search query matching tag number or animal name",
  })
  @IsOptional()
  @IsString()
  public readonly search?: string;

  @ApiPropertyOptional({
    example: 1,
    default: 1,
    description: "Page number (1-based)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public readonly page: number = 1;

  @ApiPropertyOptional({
    example: 20,
    default: 20,
    description: "Page limit (max 100)",
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public readonly limit: number = 20;

  @ApiPropertyOptional({
    example: "createdAt",
    enum: ["tagNumber", "name", "createdAt", "dateOfBirth", "weightKg"],
    description: "Sort column",
  })
  @IsOptional()
  @IsIn(["tagNumber", "name", "createdAt", "dateOfBirth", "weightKg"])
  public readonly sortBy: AnimalSortBy = "createdAt";

  @ApiPropertyOptional({
    example: "desc",
    enum: ["asc", "desc"],
    description: "Sort direction",
  })
  @IsOptional()
  @IsIn(["asc", "desc"])
  public readonly sortOrder: SortOrder = "desc";
}
