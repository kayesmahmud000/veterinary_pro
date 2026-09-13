import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
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
  RecordExpenseDto as IRecordExpenseDto,
  TransactionCategory,
} from "@vetralink/shared-types";

export class RecordExpenseDto implements IRecordExpenseDto {
  @ApiProperty({
    description: "Expense amount in primary currency (must be greater than 0)",
    example: 1250.75,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @ApiProperty({
    description:
      "Operational expense category (FEED, MEDICINE, LABOR, EQUIPMENT, UTILITY, OTHER)",
    enum: TransactionCategory,
    example: TransactionCategory.FEED,
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
    description: "Description, invoice number, or vendor reference note",
    example: "Invoice #INV-2026-042: 50 bags premium dairy meal",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  referenceNote?: string;

  @ApiPropertyOptional({
    description:
      "Optional animal UUID if expense is attributed to an individual animal",
    example: "c7b415b3-3a1b-4f93-b816-c73db2f60d3d",
  })
  @IsOptional()
  @IsUUID()
  animalId?: string;

  @ApiPropertyOptional({
    description: "Optional URL to uploaded receipt or invoice scan in S3 storage",
    example: "https://storage.vetralink.pro/receipts/inv-042.pdf",
  })
  @IsOptional()
  @IsUrl()
  receiptUrl?: string;

  @ApiPropertyOptional({
    description:
      "Custom JSON metadata (vendor name, tax rate, payment method, unit quantity)",
    example: { vendor: "Agritech Supplies Ltd", paymentMethod: "MFS_BKASH" },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}
