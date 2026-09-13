# Task 10.2: Subscription Lifecycle Management Specification

## 1. Feature Overview & Objective

In a multi-tenant SaaS ERP platform like VETRALINK PRO, the subscription lifecycle governs tenant onboarding, service access, billing intervals, payment delinquency, and account retention.

Task 10.2 delivers **Subscription Lifecycle Management**:
- Robust state machine handling `TRIALING`, `ACTIVE`, `PAST_DUE`, `CANCELED`, and `EXPIRED` states.
- Domain-driven transitions with validation rules:
  - Trial initiation (14-day standard onboarding trial or default Starter tier).
  - Activation upon checkout/payment gateway confirmation (`ACTIVE`).
  - Delinquency handling when renewal fails (`PAST_DUE`).
  - Cancellation handling with dual modes: `immediate` vs `cancelAtPeriodEnd` (graceful sunset).
  - Cancellation revocation (re-enabling auto-renew before term expiry).
  - Automatic term expiration detection and cleanup.
- Tenant and User isolation enforcing strict multi-tenancy safeguards.
- Clean Architecture repository and service layers with 100% test coverage.

---

## 2. Current State vs. Proposed State

### Current State
- `SubscriptionStatus` enum exists in Prisma schema and `packages/shared-types`: `TRIALING`, `ACTIVE`, `PAST_DUE`, `CANCELED`, `EXPIRED`.
- `subscriptions` table exists in PostgreSQL schema (`0_init/migration.sql`), with columns: `id`, `user_id`, `farm_id`, `plan_id`, `status`, `current_period_start`, `current_period_end`, `gateway_sub_id`, `cancel_at_period_end`, `created_at`, `updated_at`.
- Task 10.1 established the `SubscriptionPlan` domain model, repository, service, and controller.
- No repository, domain entity, or service exists for `Subscription` lifecycle operations.

### Proposed State
- Domain Entity `SubscriptionEntity` encapsulating the subscription lifecycle state machine and status transition logic.
- Repository interface `ISubscriptionRepository` and Prisma implementation `SubscriptionRepository`.
- Domain service `ISubscriptionLifecycleService` orchestrating subscription creation, status changes, cancellations, renewals, and expiration checks.
- Shared DTOs in `packages/shared-types` (`SubscriptionResponseDto`, `CreateSubscriptionDto`, `CancelSubscriptionDto`, etc.).
- REST Controller `SubscriptionController` exposing tenant subscription discovery and lifecycle mutations.
- Integration with NestJS `AppModule` and 100% test verification.

---

## 3. Architectural & Design Trade-offs

### Trade-off 1: State Machine in Domain Entity vs. External Workflow Engine
- **Option A: External Workflow Engine (Temporal / Camunda)**:
  - *Pros*: Sophisticated distributed saga orchestration.
  - *Cons*: Heavy operational overhead, external cluster requirement, excessive complexity for standard SaaS recurring billing.
- **Option B (Selected): Rich Domain Entity State Machine**:
  - Encapsulates valid transitions directly in `SubscriptionEntity` methods (`activate()`, `markPastDue()`, `requestCancellation()`, `revokeCancellation()`, `expire()`).
  - Ensures impossible or illegal state transitions (e.g., expiring an already canceled subscription, or activating a nonexistent plan) throw descriptive domain exceptions (`ValidationDomainException`).

### Trade-off 2: Immediate Cancellation vs. Cancel at Period End
- **Option A: Immediate Access Termination Only**:
  - *Cons*: Poor user experience. If a customer paid for a month, terminating their access immediately upon clicking "Cancel" leads to chargebacks and complaints.
- **Option B (Selected): Dual-Mode Cancellation**:
  - By default, user-initiated cancellations set `cancelAtPeriodEnd = true`. The subscription remains in `ACTIVE` or `TRIALING` status until `currentPeriodEnd`, allowing uninterrupted usage of already-purchased time.
  - An administrative / chargeback override allows `immediate = true`, instantly switching status to `CANCELED`.
  - Customers can revoke their pending cancellation anytime before `currentPeriodEnd`.

---

## 4. State Machine Matrix

```
[Start] ---> (TRIALING) --------[Payment Succeeds]-------> (ACTIVE)
               |                                              |
               | [Trial Expires]                              | [Renewal Fails]
               v                                              v
           (EXPIRED) <-----[Term Ends]----- (PAST_DUE) <------+
               ^                                |
               |                                | [Chargeback / Admin]
               |                                v
               +---[Period End]-------------- (CANCELED)
```

| Current Status | Target Status | Transition Method | Trigger Event |
| :--- | :--- | :--- | :--- |
| `TRIALING` | `ACTIVE` | `activate()` | Payment gateway confirms first billing cycle |
| `TRIALING` | `EXPIRED` | `expire()` | 14-day trial window elapses without card on file |
| `ACTIVE` | `PAST_DUE` | `markPastDue()` | Recurring billing renewal webhook fails |
| `PAST_DUE` | `ACTIVE` | `activate()` | Dunning or retry payment succeeds |
| `ACTIVE` / `TRIALING` | `ACTIVE` (flagged) | `requestCancellation(immediate: false)` | User requests cancel at end of billing cycle |
| `ACTIVE` (flagged) | `ACTIVE` (unflagged) | `revokeCancellation()` | User cancels cancellation request |
| Any active | `CANCELED` | `requestCancellation(immediate: true)` | Immediate customer support or chargeback termination |
| `PAST_DUE` / Flagged | `EXPIRED` | `expire()` | Billing cycle end reached without renewal |

---

## 5. Data Models & API Contracts

### 5.1 Shared Types (`packages/shared-types`)
```typescript
export interface SubscriptionResponseDto {
  id: string;
  userId: string;
  farmId: string | null;
  planId: string;
  plan?: SubscriptionPlanDto;
  status: SubscriptionStatus;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  gatewaySubId: string | null;
  cancelAtPeriodEnd: boolean;
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
  isTrial: boolean;
  isPastDue: boolean;
  daysRemaining: number;
}
```

### 5.2 API Request & Response Contracts
- **GET `/api/v1/subscriptions/current`**
  - Scope: Tenant-scoped (`farmId` from JWT/header or user)
  - Returns: `ApiResponse<SubscriptionResponseDto>`
  - Auth: `JwtAuthGuard`, `TenantGuard`
- **POST `/api/v1/subscriptions/trial`**
  - Body: `{ farmId?: string; planTier?: SubscriptionTier; trialDays?: number }`
  - Returns: `ApiResponse<SubscriptionResponseDto>`
  - Auth: `JwtAuthGuard`
- **POST `/api/v1/subscriptions/:id/cancel`**
  - Body: `{ immediate?: boolean; reason?: string }`
  - Returns: `ApiResponse<SubscriptionResponseDto>`
  - Auth: `JwtAuthGuard`, `@FarmRoles(FarmRole.OWNER)`
- **POST `/api/v1/subscriptions/:id/reactivate`**
  - Reverses pending cancellation
  - Returns: `ApiResponse<SubscriptionResponseDto>`
  - Auth: `JwtAuthGuard`, `@FarmRoles(FarmRole.OWNER)`
- **PATCH `/api/v1/subscriptions/:id/status`**
  - Body: `{ status: SubscriptionStatus; gatewaySubId?: string; currentPeriodEnd?: string }`
  - Returns: `ApiResponse<SubscriptionResponseDto>`
  - Auth: `JwtAuthGuard`, `@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)`

---

## 6. Security & Edge Cases
1. **Tenant Isolation**: Non-admin requests for farm subscriptions MUST verify tenant membership or ownership.
2. **Reactivation Guards**: Subscriptions already in terminal `CANCELED` or `EXPIRED` state cannot be reactivated; they require a fresh subscription checkout.
3. **Idempotent Transitions**: Activating an already active subscription with the same period end acts idempotently without corrupting ledger histories.
