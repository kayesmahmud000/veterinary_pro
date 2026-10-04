export interface CreateCustomerPortalSessionDto {
  subscriptionId?: string;
  returnUrl?: string;
}

export interface CustomerPortalSessionResponseDto {
  url: string;
  customerId: string;
}
