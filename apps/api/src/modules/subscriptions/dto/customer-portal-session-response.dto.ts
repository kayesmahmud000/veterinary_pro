import { ApiProperty } from "@nestjs/swagger";
import { CustomerPortalSessionResponseDto as ICustomerPortalSessionResponseDto } from "@vetralink/shared-types";

export class CustomerPortalSessionResponseDto
  implements ICustomerPortalSessionResponseDto
{
  @ApiProperty({
    description: "Short-lived Stripe Customer Portal session URL",
    example:
      "https://billing.stripe.com/p/session/live_YWNjdF8xMjM0NnxiYnBfc2Vzc2lvbl8xMjM0NTY3OA",
  })
  url: string;

  @ApiProperty({
    description: "Stripe Customer ID associated with this session",
    example: "cus_N1234567890",
  })
  customerId: string;
}
