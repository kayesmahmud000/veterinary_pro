# Task 10.4: Upgrade & Downgrade Subscription Flow with Prorated Billing Calculation Specification

## 1. Feature Overview & Objective

VETRALINK PRO is a multi-tenant cloud-native AgTech platform combining Multi-Species Livestock ERP, an LMS/Digital Assets Store, and Tele-Veterinary Telehealth. To provide commercial SaaS flexibility to farmers and enterprises, the subscription engine must support seamless tier upgrades and downgrades with deterministic, auditable prorated billing calculations.

Task 10.4 implements:
1. **Prorated Billing Calculation Engine**:
   - Computes unused balance/credit on the current active cycle based on elapsed time ratio.
   - Calculates net amount due for immediate tier upgrades (`targetPrice - unusedCredit`).
   - Handles credit balances and rollovers when downgrading or switching billing intervals.
   - Supports both `MONTHLY` and `ANNUAL` billing cadences with annual discount preservation.
2. **Quota Verification on Downgrade**:
   - Prevents tenant farms from downgrading to a lower tier if their current active resource usage (livestock head count or registered farm staff seats) exceeds the lower tier's ceiling.
   - Throws clear, actionable domain exceptions (`QuotaExceededDomainException` / `PlanChangeQuotaViolationException`) specifying the blocking resource metrics.
3. **Transactional Plan Transition**:
   - Executes plan changes inside an ACID database transaction.
   - Emits structured tamper-evident `AuditLog` records for all subscription mutations.
   - Resets and computes new `currentPeriodStart` and `currentPeriodEnd` timestamps.
4. **Preview & Execution API Endpoints**:
   - `POST /api/v1/subscriptions/:id/preview-change` for frontend checkout quotes and breakdown.
   - `POST /api/v1/subscriptions/:id/change-plan` for executing the validated transition.

---

## 2. Current State vs. Proposed State

### Current State
- `SubscriptionPlanEntity` and `SubscriptionEntity` manage plan definitions (`STARTER`, `PRO`, `ENTERPRISE`) and basic lifecycle states (`TRIALING`, `ACTIVE`, `PAST_DUE`, `CANCELED`).
- `SubscriptionQuotaGuard` and `SubscriptionQuotaService` enforce limits on animal registration and staff invites.
- There is NO proration math calculator or billing interval concept (`MONTHLY` vs `ANNUAL`) exposed for transitions.
- There is NO endpoint or service method to upgrade or downgrade an existing subscription.
- Users wishing to move from `STARTER` to `PRO`, or `PRO` to `ENTERPRISE`, must manually cancel or have admin intervention.

### Proposed State
- **Shared Types (`@vetralink/shared-types`)**:
  - Enums: `SubscriptionBillingInterval` (`MONTHLY`, `ANNUAL`), `SubscriptionPlanChangeType` (`UPGRADE`, `DOWNGRADE`, `INTERVAL_CHANGE`, `NO_CHANGE`).
  - DTOs: `PreviewSubscriptionPlanChangeDto`, `ChangeSubscriptionPlanDto`, `SubscriptionProrationPreviewDto`, `SubscriptionChangeResultDto`, `QuotaViolationDetailDto`.
- **Domain Proration Calculator (`SubscriptionProrationCalculator`)**:
  - Pure, deterministic calculation of used days, remaining days, unused credit, new plan cost, and net amount due.
  - Zero framework dependencies, 100% unit tested.
- **Service Layer (`SubscriptionPlanChangeService` / `SubscriptionLifecycleService`)**:
  - `previewPlanChange`: Non-mutating preview calculating proration and checking quota compliance.
  - `changePlan`: Atomic execution with quota assertion, proration calculation, entity update, and audit log generation inside a Prisma transaction.
- **Controller Layer (`SubscriptionController`)**:
  - Secure endpoints decorated with `@UseGuards(JwtAuthGuard)`:
    - `POST /api/v1/subscriptions/:id/preview-change`
    - `POST /api/v1/subscriptions/:id/change-plan`
- **Unit & Integration Test Suites**:
  - Full Jest coverage for proration math, upgrade edge cases, downgrade quota blocks, immediate vs scheduled changes, and API contracts.

---

## 3. Architectural & Design Trade-offs

### Trade-off 1: Second-Level vs Day-Level Proration Precision
- **Option A: Day-level rounding**:
  - *Pros*: Simple to explain to users (e.g. 12 days remaining out of 30 days).
  - *Cons*: Prone to 1-day boundary discrepancies depending on leap years, exact hour of purchase, and timezone differences.
- **Option B (Selected): Second-level precision with integer cents rounding**:
  - Time elapsed is calculated as `usedSeconds / totalPeriodSeconds`.
  - Financial calculations round to the nearest whole cent (`Math.round(...)`), ensuring exact penny balance matching standard Stripe billing engines.
  - Days remaining is exposed as human-friendly integer in preview metadata.

### Trade-off 2: Downgrades with Excess Quota Usage
- **Option A: Allow downgrade and immediately soft-delete or freeze excess animals/staff**:
  - *Cons*: Risky, destructive data mutation without farmer consent.
- **Option B (Selected): Strict Quota Gating (Block Downgrade)**:
  - If a farm on `PRO` has 22 animals and attempts to downgrade to `STARTER` (limit 5), the request is rejected with HTTP 403 / 422.
  - The farmer must first cull, sell, or archive livestock before the system permits lowering the subscription tier.

### Trade-off 3: Proration for Free Trials & Starter Tier
- **Option A: Assign nominal monetary value to trial days**:
  - *Cons*: Creates artificial monetary liabilities for free services.
- **Option B (Selected): Zero-Credit Policy for Trials and Starter**:
  - Transitioning from `TRIALING` status or `STARTER` (0 cents) carries 0 unused credit.
  - The customer is billed the full target plan price with a fresh 30-day or 365-day billing cycle.

---

## 4. Data Models & Contracts

### 4.1 Shared Types (`packages/shared-types`)

```typescript
export enum SubscriptionBillingInterval {
  MONTHLY = "MONTHLY",
  ANNUAL = "ANNUAL",
}

export enum SubscriptionPlanChangeType {
  UPGRADE = "UPGRADE",
  DOWNGRADE = "DOWNGRADE",
  INTERVAL_CHANGE = "INTERVAL_CHANGE",
  NO_CHANGE = "NO_CHANGE",
}

export interface PreviewSubscriptionPlanChangeDto {
  targetPlanId?: string;
  targetTier?: SubscriptionTier;
  billingInterval: SubscriptionBillingInterval;
}

export interface ChangeSubscriptionPlanDto {
  targetPlanId?: string;
  targetTier?: SubscriptionTier;
  billingInterval: SubscriptionBillingInterval;
  immediate?: boolean;
}

export interface SubscriptionProrationBreakdownDto {
  currentPlanTier: SubscriptionTier;
  currentPlanName: string;
  currentInterval: SubscriptionBillingInterval;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  targetPlanTier: SubscriptionTier;
  targetPlanName: string;
  targetInterval: SubscriptionBillingInterval;
  changeType: SubscriptionPlanChangeType;
  effectiveDate: string;
  totalPeriodDays: number;
  usedDays: number;
  remainingDays: number;
  unusedRatio: number;
  currentPlanPriceCents: number;
  unusedCreditCents: number;
  targetPlanPriceCents: number;
  netAmountDueCents: number;
  creditBalanceCents: number;
}

export interface SubscriptionProrationPreviewDto {
  subscriptionId: string;
  farmId: string | null;
  proration: SubscriptionProrationBreakdownDto;
  canProceed: boolean;
  quotaViolations: {
    resource: "ANIMALS" | "STAFF";
    currentUsage: number;
    targetLimit: number;
    message: string;
  }[];
}

export interface SubscriptionChangeResultDto {
  subscription: SubscriptionResponseDto;
  proration: SubscriptionProrationBreakdownDto;
  transactionId?: string;
}
```

---

## 5. Security & Edge Cases

1. **Authorization**: Only the subscription owner (`userId`), farm `OWNER` or `MANAGER`, or `SUPER_ADMIN` can change a subscription plan.
2. **Double-Change Prevention / Idempotency**: Reject plan changes if the subscription is already in the target plan and billing interval.
3. **Grace Period Handling**: If subscription is `PAST_DUE`, changing plan requires settling the outstanding balance or reactivates with new cycle upon full payment.
4. **Canceled Subscriptions**: Subscriptions marked `CANCELED` or `EXPIRED` cannot be upgraded/downgraded; a new subscription must be created.
5. **ACID Transaction**: Updating subscription state, recalculating period dates, and writing audit log records run in a single atomic `prisma.$transaction`.
