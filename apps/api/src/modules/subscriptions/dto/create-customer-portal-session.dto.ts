import { ApiPropertyOptional } from "@nestjs/swagger";
import { CreateCustomerPortalSessionDto as ICreateCustomerPortalSessionDto } from "@vetralink/shared-types";
import { IsOptional, IsString, IsUrl, IsUUID } from "class-validator";

export class CreateCustomerPortalSessionDto
  implements ICreateCustomerPortalSessionDto
{
  @ApiPropertyOptional({
    description: "Subscription UUID to link in the customer portal",
    example: "a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d",
  })
  @IsUUID()
  @IsOptional()
  subscriptionId?: string;

  @ApiPropertyOptional({
    description: "URL to redirect the customer to after exiting the billing portal",
    example: "https://app.vetralink.pro/settings/billing",
  })
  @IsString()
  @IsUrl({ require_tld: false })
  @IsOptional()
  returnUrl?: string;
}
