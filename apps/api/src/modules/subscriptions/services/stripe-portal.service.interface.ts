import {
  CreateCustomerPortalSessionDto,
  CustomerPortalSessionResponseDto,
} from "@vetralink/shared-types";

export const STRIPE_PORTAL_SERVICE = Symbol("STRIPE_PORTAL_SERVICE");

export interface IStripePortalService {
  createCustomerPortalSession(
    userId: string,
    dto?: CreateCustomerPortalSessionDto,
  ): Promise<CustomerPortalSessionResponseDto>;
}
