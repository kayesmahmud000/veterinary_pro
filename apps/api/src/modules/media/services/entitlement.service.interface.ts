export const ENTITLEMENT_SERVICE = Symbol("ENTITLEMENT_SERVICE");

export interface IEntitlementService {
  /**
   * Evaluates if a user is entitled to view or stream a product.
   *
   * Entitlement rules:
   * 1. SUPER_ADMIN and ADMIN bypass all checks (preview/diagnostic privilege).
   * 2. Direct purchase: User has an OrderItem for productId in a COMPLETED Order.
   * 3. Subscription: User has an ACTIVE or TRIALING subscription whose plan tier
   *    meets or exceeds the product's minSubscriptionTier.
   *
   * @param userId UUID of the user
   * @param userRole Role of the user (e.g. UserRole enum)
   * @param productId UUID of the product
   * @returns Promise<boolean> True if entitled, false otherwise
   */
  checkEntitlement(
    userId: string,
    userRole: string,
    productId: string
  ): Promise<boolean>;
}
