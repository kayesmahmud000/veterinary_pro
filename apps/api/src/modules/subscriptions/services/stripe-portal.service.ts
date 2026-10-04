import { Inject, Injectable, Logger } from "@nestjs/common";
import {
  CreateCustomerPortalSessionDto,
  CustomerPortalSessionResponseDto,
} from "@vetralink/shared-types";
import Stripe from "stripe";
import {
  EntityNotFoundException,
  ForbiddenOperationException,
  ValidationDomainException,
} from "../../../common/exceptions/domain.exception";
import { EnvService } from "../../../config/env.service";
import {
  AUDIT_LOG_REPOSITORY,
  IAuditLogRepository,
} from "../../audit/repositories/audit-log.repository.interface";
import {
  IUserRepository,
  USER_REPOSITORY,
} from "../../users/repositories/user.repository.interface";
import { SubscriptionEntity } from "../entities/subscription.entity";
import {
  ISubscriptionRepository,
  SUBSCRIPTION_REPOSITORY,
} from "../repositories/subscription.repository.interface";
import { IStripePortalService } from "./stripe-portal.service.interface";

@Injectable()
export class StripePortalService implements IStripePortalService {
  private readonly logger = new Logger(StripePortalService.name);
  private readonly stripeClient: Stripe | null = null;

  constructor(
    private readonly envService: EnvService,
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    @Inject(SUBSCRIPTION_REPOSITORY)
    private readonly subRepo: ISubscriptionRepository,
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepo: IAuditLogRepository,
  ) {
    const apiKey = this.envService.stripeSecretKey;
    if (apiKey) {
      this.stripeClient = new Stripe(apiKey, {
        typescript: true,
      });
      this.logger.log("Stripe Customer Portal gateway client initialized.");
    } else {
      this.logger.warn(
        "STRIPE_SECRET_KEY is not configured. Customer Portal will operate in simulated mock mode.",
      );
    }
  }

  public async createCustomerPortalSession(
    userId: string,
    dto?: CreateCustomerPortalSessionDto,
  ): Promise<CustomerPortalSessionResponseDto> {
    // 1. Resolve User
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new EntityNotFoundException("User", userId);
    }

    // 2. Resolve Subscription if specified, or pick primary active subscription
    let subscription: SubscriptionEntity | null = null;
    if (dto?.subscriptionId) {
      subscription = await this.subRepo.findById(dto.subscriptionId);
      if (!subscription) {
        throw new EntityNotFoundException("Subscription", dto.subscriptionId);
      }
      if (subscription.userId !== userId) {
        throw new ForbiddenOperationException(
          "You do not have permission to access billing for this subscription.",
        );
      }
    } else {
      const userSubs = await this.subRepo.findByUserId(userId);
      subscription = userSubs.find((s) => s.isActive()) ?? userSubs[0] ?? null;
    }

    // 3. Resolve Return URL safely
    const defaultReturnUrl = "https://app.vetralink.pro/settings/billing";
    let returnUrl = dto?.returnUrl ?? defaultReturnUrl;
    try {
      const parsed = new URL(returnUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) {
        returnUrl = defaultReturnUrl;
      }
    } catch {
      returnUrl = defaultReturnUrl;
    }

    // 4. Handle Mock Environment if Stripe client is not configured
    if (!this.stripeClient) {
      const mockCustomerId = `cus_mock_${user.id.replace(/-/g, "").slice(0, 14)}`;
      const mockUrl = `https://billing.stripe.com/p/session/test_mock_${mockCustomerId}`;

      this.logger.warn(
        `Returning simulated Stripe Customer Portal URL for user '${userId}' (Customer: ${mockCustomerId}).`,
      );

      await this.recordAudit(userId, subscription?.id ?? user.id, mockCustomerId, mockUrl, returnUrl);

      return {
        url: mockUrl,
        customerId: mockCustomerId,
      };
    }

    // 5. Resolve or Create Stripe Customer ID
    const customerId = await this.resolveStripeCustomerId(user, subscription);

    // 6. Create Stripe Billing Portal Session
    try {
      const session = await this.stripeClient.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl,
      });

      this.logger.log(
        `Generated Stripe Billing Portal session for user '${userId}' [Customer: ${customerId}].`,
      );

      await this.recordAudit(userId, subscription?.id ?? user.id, customerId, session.url, returnUrl);

      return {
        url: session.url,
        customerId,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      this.logger.error(
        `Failed to create Stripe Billing Portal session for customer '${customerId}': ${msg}`,
      );
      throw new ValidationDomainException(
        `Stripe Customer Portal generation failed: ${msg}`,
      );
    }
  }

  private async resolveStripeCustomerId(
    user: { id: string; email: string; name: string },
    subscription: SubscriptionEntity | null,
  ): Promise<string> {
    if (!this.stripeClient) {
      return `cus_mock_${user.id.slice(0, 8)}`;
    }

    // Attempt 1: If subscription has a gatewaySubId, retrieve customer from Stripe subscription
    if (subscription?.gatewaySubId) {
      try {
        const stripeSub = await this.stripeClient.subscriptions.retrieve(
          subscription.gatewaySubId,
        );
        if (typeof stripeSub.customer === "string") {
          return stripeSub.customer;
        }
        if (stripeSub.customer && typeof stripeSub.customer === "object") {
          return stripeSub.customer.id;
        }
      } catch (err: unknown) {
        this.logger.warn(
          `Could not resolve Stripe customer from subscription '${subscription.gatewaySubId}': ${err instanceof Error ? err.message : err}`,
        );
      }
    }

    // Attempt 2: Search existing Stripe customers by email
    try {
      const customerList = await this.stripeClient.customers.list({
        email: user.email,
        limit: 1,
      });
      if (customerList.data.length > 0 && customerList.data[0]) {
        return customerList.data[0].id;
      }
    } catch (err: unknown) {
      this.logger.warn(
        `Could not search Stripe customers by email '${user.email}': ${err instanceof Error ? err.message : err}`,
      );
    }

    // Attempt 3: Create new Stripe customer for user
    const newCustomer = await this.stripeClient.customers.create({
      email: user.email,
      name: user.name,
      metadata: {
        userId: user.id,
        platform: "VETRALINK_PRO",
      },
    });

    this.logger.log(
      `Created new Stripe Customer '${newCustomer.id}' for user '${user.id}' (${user.email}).`,
    );

    return newCustomer.id;
  }

  private async recordAudit(
    userId: string,
    entityId: string,
    customerId: string,
    sessionUrl: string,
    returnUrl: string,
  ): Promise<void> {
    try {
      await this.auditLogRepo.record({
        userId,
        action: "CREATE_CUSTOMER_PORTAL_SESSION",
        entityType: "Subscription",
        entityId,
        newValues: {
          customerId,
          sessionUrl,
          returnUrl,
        },
        traceId: crypto.randomUUID(),
      });
    } catch (err: unknown) {
      this.logger.warn(
        `Failed to record audit log for portal session: ${err instanceof Error ? err.message : err}`,
      );
    }
  }
}
