import { ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";
import {
  ExpenseQueryDto as IExpenseQueryDto,
  TransactionCategory,
} from "@vetralink/shared-types";

export class ExpenseQueryDto implements IExpenseQueryDto {
  @ApiPropertyOptional({
    description: "Filter expenses with transaction date >= startDate (YYYY-MM-DD)",
    example: "2026-09-01",
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: "Filter expenses with transaction date <= endDate (YYYY-MM-DD)",
    example: "2026-09-30",
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: "Filter by expense category",
    enum: TransactionCategory,
    example: TransactionCategory.FEED,
  })
  @IsOptional()
  @IsEnum(TransactionCategory)
  category?: TransactionCategory;

  @ApiPropertyOptional({
    description: "Filter by linked animal UUID",
    example: "c7b415b3-3a1b-4f93-b816-c73db2f60d3d",
  })
  @IsOptional()
  @IsUUID()
  animalId?: string;

  @ApiPropertyOptional({
    description: "Search keyword matching in reference notes",
    example: "dairy concentrate",
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: "Page number (1-based pagination)",
    default: 1,
    minimum: 1,
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
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: "Field to sort by",
    enum: ["txDate", "amount", "createdAt"],
    default: "txDate",
  })
  @IsOptional()
  @IsEnum(["txDate", "amount", "createdAt"])
  sortBy?: "txDate" | "amount" | "createdAt" = "txDate";

  @ApiPropertyOptional({
    description: "Sort direction",
    enum: ["asc", "desc"],
    default: "desc",
  })
  @IsOptional()
  @IsEnum(["asc", "desc"])
  sortOrder?: "asc" | "desc" = "desc";
}
