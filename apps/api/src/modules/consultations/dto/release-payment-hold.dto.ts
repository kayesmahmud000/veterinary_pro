import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

export class ReleasePaymentHoldDto {
  @ApiPropertyOptional({
    description: "Reason for releasing or voiding the payment authorization hold",
    maxLength: 500,
    example: "Consultation cancelled prior to session confirmation.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: "Reason must not exceed 500 characters" })
  reason?: string;
}
