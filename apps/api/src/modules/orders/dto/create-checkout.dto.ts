import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  ArrayMinSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";
import {
  CheckoutItemRequestDto,
  CreateCheckoutRequestDto,
} from "@vetralink/shared-types";

export class CheckoutItemDto implements CheckoutItemRequestDto {
  @ApiProperty({
    description: "Target product UUID",
    example: "a0000000-0000-0000-0000-000000000001",
  })
  @IsUUID("4")
  productId!: string;
}

export class CreateCheckoutDto implements CreateCheckoutRequestDto {
  @ApiProperty({
    type: [CheckoutItemDto],
    description: "List of items to purchase",
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CheckoutItemDto)
  items!: CheckoutItemDto[];

  @ApiPropertyOptional({
    default: "stripe",
    description: "Payment gateway to use (e.g. stripe or mock)",
    example: "stripe",
  })
  @IsOptional()
  @IsString()
  paymentGateway?: string = "stripe";
}
