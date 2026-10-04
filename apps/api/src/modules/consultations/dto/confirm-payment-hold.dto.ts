import { ApiProperty } from "@nestjs/swagger";
import { ConfirmPaymentHoldDto as IConfirmPaymentHoldDto } from "@vetralink/shared-types";
import { IsNotEmpty, IsString } from "class-validator";

export class ConfirmPaymentHoldDto implements IConfirmPaymentHoldDto {
  @ApiProperty({
    description: "Stripe or gateway PaymentIntent ID that has authorized the hold",
    example: "pi_3MtwBwLkdIwHu7ix28a3tqPa",
  })
  @IsNotEmpty({ message: "paymentIntentId is required" })
  @IsString({ message: "paymentIntentId must be a string" })
  paymentIntentId!: string;
}
