import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsOptional,
  IsUUID,
} from "class-validator";
import { Type } from "class-transformer";
import {
  AnimalSpecies,
  AnimalStatus,
  BatchTagBadgeRequestDto,
  TagBadgeLayout,
  TagBadgePageSize,
} from "@vetralink/shared-types";

export class PrintBatchTagBadgesDto implements BatchTagBadgeRequestDto {
  @ApiPropertyOptional({
    type: [String],
    description: "Explicit list of animal UUIDs to generate tags for (maximum 100)",
  })
  @IsOptional()
  @IsArray()
  @IsUUID("4", { each: true })
  @ArrayMaxSize(100, {
    message: "Batch tag badge generation cannot exceed 100 animals per request.",
  })
  public readonly animalIds?: string[];

  @ApiPropertyOptional({
    enum: AnimalSpecies,
    description: "Filter animals by species",
  })
  @IsOptional()
  @IsEnum(AnimalSpecies)
  public readonly species?: AnimalSpecies;

  @ApiPropertyOptional({
    enum: AnimalStatus,
    description: "Filter animals by status",
  })
  @IsOptional()
  @IsEnum(AnimalStatus)
  public readonly status?: AnimalStatus;

  @ApiPropertyOptional({
    enum: TagBadgeLayout,
    default: TagBadgeLayout.GRID_2X3,
    description: "Print grid layout: GRID_2X3 (6 per page), GRID_2X4 (8 per page), or SINGLE_PER_PAGE",
  })
  @IsOptional()
  @IsEnum(TagBadgeLayout)
  public readonly layout?: TagBadgeLayout;

  @ApiPropertyOptional({
    enum: TagBadgePageSize,
    default: TagBadgePageSize.A4,
    description: "Target paper size: A4 or LETTER",
  })
  @IsOptional()
  @IsEnum(TagBadgePageSize)
  public readonly pageSize?: TagBadgePageSize;

  @ApiPropertyOptional({
    type: Boolean,
    default: true,
    description: "Whether to include sire/dam pedigree tag information on the badge",
  })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  public readonly includePedigree?: boolean;
}

export class AnimalQrCodeQueryDto {
  @ApiPropertyOptional({
    enum: ["json", "png"],
    default: "json",
    description: "Output format: json (data URL payload) or png (direct binary image)",
  })
  @IsOptional()
  @IsIn(["json", "png"])
  public readonly format?: "json" | "png";
}
