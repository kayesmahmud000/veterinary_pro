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
  UpdateRevenueDto as IUpdateRevenueDto,
} from "@vetralink/shared-types";

export class UpdateRevenueDto implements IUpdateRevenueDto {
  @ApiPropertyOptional({
    description: "Updated revenue amount",
    example: 4800.0,
    minimum: 0.01,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount?: number;

  @ApiPropertyOptional({
    description: "Updated revenue category",
    enum: TransactionCategory,
    example: TransactionCategory.MILK_SALES,
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
    description: "Updated reference note or buyer details",
    example: "Adjusted payment with fat premium bonus",
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
    example: "https://storage.vetralink.pro/revenues/receipt-88-revised.pdf",
  })
  @IsOptional()
  @IsUrl()
  receiptUrl?: string | null;

  @ApiPropertyOptional({
    description: "Updated metadata object",
    example: { buyer: "Apex Dairy Processors", bonusPaid: true },
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
