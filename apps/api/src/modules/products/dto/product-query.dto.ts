import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
} from "class-validator";
import { Transform, Type } from "class-transformer";
import {
  ProductQueryFilterDto,
  ProductSortBy,
  ProductType,
  SubscriptionTier,
} from "@vetralink/shared-types";

export class ProductQueryDto implements ProductQueryFilterDto {
  @ApiPropertyOptional({
    enum: ProductType,
    description: "Filter products by product type",
  })
  @IsOptional()
  @IsEnum(ProductType)
  public readonly type?: ProductType;

  @ApiPropertyOptional({
    enum: SubscriptionTier,
    description: "Filter by required subscription tier",
  })
  @IsOptional()
  @IsEnum(SubscriptionTier)
  public readonly minSubscriptionTier?: SubscriptionTier;

  @ApiPropertyOptional({
    description: "Filter by publication state (admins only)",
  })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === "true" || value === true) return true;
    if (value === "false" || value === false) return false;
    return undefined;
  })
  @IsBoolean()
  public readonly isPublished?: boolean;

  @ApiPropertyOptional({
    description: "Search keyword matching title or description",
  })
  @IsOptional()
  @IsString()
  public readonly search?: string;

  @ApiPropertyOptional({
    description: "Minimum price in cents",
    example: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  public readonly minPriceCents?: number;

  @ApiPropertyOptional({
    description: "Maximum price in cents",
    example: 10000,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  public readonly maxPriceCents?: number;

  @ApiPropertyOptional({
    enum: ProductSortBy,
    description: "Sort mode",
    default: ProductSortBy.NEWEST,
  })
  @IsOptional()
  @IsEnum(ProductSortBy)
  public readonly sortBy?: ProductSortBy;

  @ApiPropertyOptional({
    description: "Page number for pagination",
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  public readonly page?: number = 1;

  @ApiPropertyOptional({
    description: "Items per page",
    default: 20,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  public readonly limit?: number = 20;
}
