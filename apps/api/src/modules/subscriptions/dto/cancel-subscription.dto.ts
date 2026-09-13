import { ApiPropertyOptional } from "@nestjs/swagger";
import { CancelSubscriptionRequestDto as ICancelSubscriptionRequestDto } from "@vetralink/shared-types";
import { IsBoolean, IsOptional, IsString, MaxLength } from "class-validator";

export class CancelSubscriptionDto implements ICancelSubscriptionRequestDto {
  @ApiPropertyOptional({
    description:
      "Whether to cancel immediately or at period end (default: false, cancel at period end)",
    default: false,
    example: false,
  })
  @IsBoolean()
  @IsOptional()
  immediate?: boolean = false;

  @ApiPropertyOptional({
    description: "Optional cancellation feedback or reason",
    example: "Switching to alternative billing account",
    maxLength: 500,
  })
  @IsString()
  @MaxLength(500)
  @IsOptional()
  reason?: string;
}
