import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  Min,
  MinLength,
} from "class-validator";
import {
  CreateProductRequestDto,
  ProductType,
  SubscriptionTier,
} from "@vetralink/shared-types";

export class CreateProductDto implements CreateProductRequestDto {
  @ApiProperty({
    example: "Comprehensive Bovine Mastitis Protocol",
    description: "Product display title",
    minLength: 3,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: "Title must be at least 3 characters long" })
  public readonly title!: string;

  @ApiPropertyOptional({
    example: "comprehensive-bovine-mastitis-protocol",
    description: "URL-safe slug. Auto-generated from title if omitted.",
  })
  @IsOptional()
  @IsString()
  public readonly slug?: string;

  @ApiProperty({
    enum: ProductType,
    example: ProductType.VIDEO_COURSE,
    description: "Product asset category",
  })
  @IsEnum(ProductType, {
    message: "Type must be one of: VIDEO_COURSE, EBOOK, EXCEL_TOOL",
  })
  public readonly type!: ProductType;

  @ApiProperty({
    example:
      "Complete diagnostic and antibiotic stewardship training course for dairy operations.",
    description: "Detailed product description",
    minLength: 10,
  })
  @IsString()
  @MinLength(10, { message: "Description must be at least 10 characters long" })
  public readonly description!: string;

  @ApiProperty({
    example: 4999,
    description: "Regular price in integer cents (e.g. 4999 = $49.99)",
    minimum: 0,
  })
  @IsInt({ message: "Price must be an integer in cents" })
  @Min(0, { message: "Price cannot be negative" })
  public readonly priceCents!: number;

  @ApiPropertyOptional({
    example: 3999,
    description:
      "Promotional discount price in integer cents (must be strictly < priceCents)",
    minimum: 0,
  })
  @IsOptional()
  @IsInt({ message: "Discount price must be an integer in cents" })
  @Min(0, { message: "Discount price cannot be negative" })
  public readonly discountPriceCents?: number | null;

  @ApiPropertyOptional({
    example: "USD",
    default: "USD",
    description: "3-letter ISO 4217 currency code",
  })
  @IsOptional()
  @IsString()
  public readonly currency?: string;

  @ApiProperty({
    example: "courses/mastitis-v1/master.mp4",
    description: "Encrypted S3 object storage path for the master asset",
  })
  @IsString()
  @IsNotEmpty({ message: "Content S3 key cannot be empty" })
  public readonly contentS3Key!: string;

  @ApiPropertyOptional({
    enum: SubscriptionTier,
    default: SubscriptionTier.STARTER,
    description: "Minimum subscription tier required for complimentary access",
  })
  @IsOptional()
  @IsEnum(SubscriptionTier)
  public readonly minSubscriptionTier?: SubscriptionTier;

  @ApiPropertyOptional({
    example: false,
    default: false,
    description: "Whether the product is published to the marketplace catalog",
  })
  @IsOptional()
  @IsBoolean()
  public readonly isPublished?: boolean;

  @ApiPropertyOptional({
    example: { durationMinutes: 180, instructor: "Dr. Sarah Jenkins, DVM" },
    description: "Custom metadata payload",
  })
  @IsOptional()
  @IsObject()
  public readonly metadata?: Record<string, unknown>;
}
