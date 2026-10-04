import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsDateString,
  IsEnum,
  IsInt,
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
  TransactionCategory,
  UpdateExpenseDto as IUpdateExpenseDto,
} from "@vetralink/shared-types";

export class UpdateExpenseDto implements IUpdateExpenseDto {
  @ApiPropertyOptional({
    description: "Updated expense amount",
    example: 1350.0,
    minimum: 0.01,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({
    description: "Updated operational expense category",
    enum: TransactionCategory,
    example: TransactionCategory.EQUIPMENT,
  })
  @IsOptional()
  @IsEnum(TransactionCategory)
  category?: TransactionCategory;

  @ApiPropertyOptional({
    description: "Updated transaction date in ISO 8601 format",
    example: "2026-09-13",
  })
  @IsOptional()
  @IsDateString()
  txDate?: string;

  @ApiPropertyOptional({
    description: "3-letter ISO 4217 currency code",
    example: "USD",
  })
  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @ApiPropertyOptional({
    description: "Updated reference note or invoice description",
    example: "Adjusted quantity from 50 to 55 bags",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  referenceNote?: string;

  @ApiPropertyOptional({
    description: "Associated animal UUID, or null to dissociate",
    example: null,
  })
  @IsOptional()
  @IsUUID()
  animalId?: string | null;

  @ApiPropertyOptional({
    description: "Updated receipt URL, or null to remove",
    example: "https://storage.vetralink.pro/receipts/inv-042-revised.pdf",
  })
  @IsOptional()
  @IsUrl()
  receiptUrl?: string | null;

  @ApiPropertyOptional({
    description: "Updated metadata object",
    example: { vendor: "Agritech Supplies Ltd", revised: true },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @ApiProperty({
    description:
      "Current syncVersion of the record for optimistic concurrency locking",
    example: 1,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  syncVersion!: number;
}
