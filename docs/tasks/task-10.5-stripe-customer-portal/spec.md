# Task 10.5: Stripe Customer Portal Integration for Self-Service Billing Specification

## 1. Feature Overview & Objective

VETRALINK PRO is a multi-tenant cloud-native AgTech platform combining Livestock ERP, LMS/Digital Assets Store, and Tele-Veterinary Telehealth. To provide seamless commercial SaaS subscription management, tenants and subscribers must have self-service access to manage payment methods (e.g., updating expired credit cards, changing primary billing methods), view historical invoices, download tax receipts, and view subscription details through a secure, hosted Stripe Billing Customer Portal.

Task 10.5 introduces **Stripe Customer Portal Integration**:
1. **Dynamic Stripe Customer Resolution**:
   - Resolves existing Stripe Customer IDs from the active subscription's `gatewaySubId` or via user email query in Stripe.
   - Automatically provisions a Stripe Customer record if one does not already exist for the authenticated user.
2. **Ephemeral Billing Portal Session Creation**:
   - Creates short-lived, authenticated Stripe Customer Portal session URLs (`stripe.billingPortal.sessions.create`).
   - Validates and configures secure return URLs (defaulting to the application's billing settings page).
3. **Auditability & Security**:
   - Requires JWT authentication (`JwtAuthGuard`).
   - Restricts portal access to the subscription owner, authorized farm manager/owner, or platform administrators.
   - Emits structured `AuditLog` events upon portal session generation.
4. **Environment Fallback & Graceful Degradation**:
   - When running in local development or test environments without a live `STRIPE_SECRET_KEY`, the service provides deterministic mock portal URLs without throwing unhandled exceptions.

---

## 2. Current State vs. Proposed State

### Current State
- `StripePaymentService` and `StripeWebhookService` in `OrdersModule` handle one-off order checkouts and webhook processing.
- `SubscriptionEntity` tracks `gatewaySubId` (e.g. `sub_123` in Stripe) and lifecycle statuses (`ACTIVE`, `TRIALING`, `PAST_DUE`, `CANCELED`).
- There is no self-service portal endpoint. Subscribers cannot update their credit card details or view Stripe billing receipts directly without contacting support.

### Proposed State
- **Shared Types (`@vetralink/shared-types`)**:
  - `CreateCustomerPortalSessionDto`: Optional `returnUrl` and optional `subscriptionId`.
  - `CustomerPortalSessionResponseDto`: `url` and `customerId`.
- **API DTOs (`apps/api/src/modules/subscriptions/dto`)**:
  - Class-validator and Swagger decorated DTOs for portal session creation and responses.
- **Service Layer (`apps/api/src/modules/subscriptions/services`)**:
  - `IStripePortalService` and `StripePortalService`:
    - Handles Stripe Customer lookup, creation, and billing portal session generation.
    - Records audit logs.
- **Controller Layer (`SubscriptionController`)**:
  - `POST /api/v1/subscriptions/customer-portal` (creates portal session for user's primary/active subscription).
  - `POST /api/v1/subscriptions/:id/customer-portal` (creates portal session for a specific subscription).
- **Unit & Integration Test Suites**:
  - Comprehensive Jest tests with mocked Stripe client, user repository, and audit log repository.

---

## 3. Architectural & Design Trade-offs

### Trade-off 1: Ephemeral Backend-Generated Portal Session vs Static Customer Links
- **Option A: Static Customer Links**:
  - Stripe Customer Portal does not support static unauthenticated URLs; access requires an ephemeral token created server-side via Stripe's secret API key.
- **Option B (Selected): Authenticated Server-Side Session Generation**:
  - The client calls `POST /api/v1/subscriptions/customer-portal`.
  - The server authenticates the user via JWT, resolves their Stripe Customer ID, invokes `stripe.billingPortal.sessions.create`, and returns the short-lived session URL (`https://billing.stripe.com/p/session/...`).

### Trade-off 2: Schema Migration for `stripeCustomerId` vs Dynamic Lookup
- **Option A: Add `stripeCustomerId` column to `users` table via Prisma migration**:
  - *Pros*: Explicit database column.
  - *Cons*: Modifies database schema during a sprint focused on application logic; historical users without Stripe customers would still require dynamic provisioning.
- **Option B (Selected): Dynamic Resolution with Gateway Subscription Fallback**:
  - If the subscription has a `gatewaySubId`, query Stripe for the subscription to obtain its `customer`.
  - Alternatively, query Stripe for `customers.list({ email: user.email, limit: 1 })`.
  - If none found, create the Stripe customer with user metadata (`userId`, `email`, `name`).
  - This ensures zero schema disruption while functioning seamlessly across all user lifecycles.

### Trade-off 3: Open Redirect Prevention
- **Option A: Accept any arbitrary return URL**:
  - *Cons*: Vulnerable to open redirect attacks if user is tricked into navigating to a phishing site.
- **Option B (Selected): Safe URL Sanitization**:
  - Validate that `returnUrl` (if provided) is a valid URL and either starts with allowed origin domains or falls back to a safe default path (`/dashboard/billing` or `https://app.vetralink.pro/settings/billing`).

---

## 4. Data Models & Contracts

### 4.1 Shared Types (`packages/shared-types`)

```typescript
export interface CreateCustomerPortalSessionDto {
  subscriptionId?: string;
  returnUrl?: string;
}

export interface CustomerPortalSessionResponseDto {
  url: string;
  customerId: string;
}
```

---

## 5. Security & Edge Cases

1. **Authentication & Authorization**: Route handlers enforce `@UseGuards(JwtAuthGuard)`. Users can only access billing portals associated with their own accounts or farms they manage.
2. **Missing Customer Handling**: If a user is on a free trial or has never made a Stripe card transaction, the service automatically creates a corresponding Stripe customer record so they can register their payment method ahead of billing renewal.
3. **Environment Isolation**: In development/testing when `STRIPE_SECRET_KEY` is not present, a mock URL is returned with a warning log, enabling automated testing and local front-end development without requiring active Stripe credentials.
4. **Audit Logging**: Every portal session request is captured in the audit log for compliance.
