import { Injectable, Logger } from "@nestjs/common";
import {
  OrderStatus,
  SubscriptionStatus,
  SubscriptionTier,
  UserRole,
} from "@vetralink/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { EntityNotFoundException } from "../../../common/exceptions/domain.exception";
import { IEntitlementService } from "./entitlement.service.interface";

const TIER_WEIGHTS: Record<SubscriptionTier, number> = {
  [SubscriptionTier.STARTER]: 1,
  [SubscriptionTier.PRO]: 2,
  [SubscriptionTier.ENTERPRISE]: 3,
};

@Injectable()
export class EntitlementService implements IEntitlementService {
  private readonly logger = new Logger(EntitlementService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Evaluates if a user is entitled to view or stream a product.
   *
   * @param userId UUID of the user
   * @param userRole Role of the user
   * @param productId UUID of the product
   * @returns boolean True if access is permitted
   */
  public async checkEntitlement(
    userId: string,
    userRole: string,
    productId: string
  ): Promise<boolean> {
    // 1. Admin bypass: SUPER_ADMIN and ADMIN have universal preview access
    if (userRole === UserRole.SUPER_ADMIN || userRole === UserRole.ADMIN) {
      return true;
    }

    // 2. Fetch product from database
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product || product.deletedAt) {
      throw new EntityNotFoundException(
        `Product with ID [${productId}] was not found.`
      );
    }

    // If product is unpublished and user is not admin, deny access
    if (!product.isPublished) {
      return false;
    }

    // 3. Direct purchase verification: Check if user has an order item in a COMPLETED order
    const completedPurchase = await this.prisma.orderItem.findFirst({
      where: {
        productId,
        order: {
          userId,
          status: OrderStatus.COMPLETED,
        },
      },
      select: { id: true },
    });

    if (completedPurchase) {
      this.logger.debug(
        `User [${userId}] entitled to product [${productId}] via completed purchase.`
      );
      return true;
    }

    // 4. Subscription verification: Check if user has an active/trialing subscription
    // whose plan tier satisfies product.minSubscriptionTier
    const now = new Date();
    const activeSubscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        status: {
          in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING],
        },
        currentPeriodEnd: {
          gt: now,
        },
      },
      include: {
        plan: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    if (activeSubscription && activeSubscription.plan) {
      const userTier = activeSubscription.plan.tier as SubscriptionTier;
      const requiredTier = product.minSubscriptionTier as SubscriptionTier;

      const userWeight = TIER_WEIGHTS[userTier] ?? 0;
      const requiredWeight = TIER_WEIGHTS[requiredTier] ?? 0;

      if (userWeight >= requiredWeight) {
        this.logger.debug(
          `User [${userId}] entitled to product [${productId}] via active subscription tier [${userTier}] >= required [${requiredTier}].`
        );
        return true;
      }
    }

    this.logger.debug(
      `User [${userId}] denied entitlement to product [${productId}]: No purchase or qualifying subscription.`
    );
    return false;
  }
}
