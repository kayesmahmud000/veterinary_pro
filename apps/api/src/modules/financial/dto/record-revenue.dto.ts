import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Length,
  MaxLength,
  Min,
} from "class-validator";
import {
  RecordRevenueDto as IRecordRevenueDto,
  TransactionCategory,
} from "@vetralink/shared-types";

export class RecordRevenueDto implements IRecordRevenueDto {
  @ApiProperty({
    description: "Revenue amount received (must be greater than 0)",
    example: 4500.0,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiProperty({
    description:
      "Revenue category (MILK_SALES, LIVESTOCK_SALES, MANURE, BYPRODUCTS, OTHER)",
    enum: TransactionCategory,
    example: TransactionCategory.MILK_SALES,
  })
  @IsEnum(TransactionCategory)
  category!: TransactionCategory;

  @ApiProperty({
    description: "Transaction date in ISO 8601 format (YYYY-MM-DD)",
    example: "2026-09-13",
  })
  @IsDateString()
  txDate!: string;

  @ApiPropertyOptional({
    description: "3-letter ISO 4217 currency code (defaults to USD)",
    example: "USD",
    default: "USD",
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({
    description: "Description, buyer name, or invoice reference note",
    example: "Bulk milk sale invoice #MS-2026-88: 6,000L @ $0.75/L",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  referenceNote?: string;

  @ApiPropertyOptional({
    description: "Optional animal UUID if revenue is from selling a specific animal",
    example: "c7b415b3-3a1b-4f93-b816-c73db2f60d3d",
  })
  @IsOptional()
  @IsUUID()
  animalId?: string;

  @ApiPropertyOptional({
    description:
      "When category is LIVESTOCK_SALES and animalId is provided, automatically transition the animal status to SOLD (defaults to true)",
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  markAnimalAsSold?: boolean = true;

  @ApiPropertyOptional({
    description: "URL to payment voucher, receipt scan, or delivery note",
    example: "https://storage.vetralink.pro/revenues/receipt-88.pdf",
  })
  @IsOptional()
  @IsUrl()
  receiptUrl?: string;

  @ApiPropertyOptional({
    description:
      "Custom JSON metadata (buyer company, payment method, milk fat percentage, weight)",
    example: { buyer: "Apex Dairy Processors", liters: 6000, fatPercent: 4.2 },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
