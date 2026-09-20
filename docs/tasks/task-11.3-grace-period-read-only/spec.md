# Task 11.3: Grace Period Mechanism & Read-Only Access Restriction Specification

## 1. Feature Overview & Objective

VETRALINK PRO is a multi-tenant cloud-native AgTech SaaS platform. When a recurring subscription renewal fails, the subscription enters `PAST_DUE` status (Task 11.1), and automated dunning notifications are dispatched across Days 1, 3, and 7 (Task 11.2).

In livestock farming, an abrupt and complete shutdown of farm systems can jeopardize animal health and biosecurity (e.g. inability to view vaccination schedules, medical histories, or quarantine alerts). Conversely, allowing indefinite write access to non-paying users leads to SaaS revenue leakage.

**Task 11.3** establishes a structured, multi-tier **Grace Period & Read-Only Access Restriction Mechanism**:

1. **Stage 1: Active Grace Period (Days 1–3 post-failure)**:
   - **Access Mode**: `GRACE_PERIOD`.
   - **Permissions**: Full Read and Write access.
   - Farm staff can continue logging milk yields, animal registrations, and treatments without disruption while the farm owner resolves the billing issue.
   - Visual and API indicators: `isGracePeriodActive: true`, warning headers, and expiration dates returned in access status responses.

2. **Stage 2: Post-Grace Read-Only Mode (Days 4–7 post-failure)**:
   - **Access Mode**: `READ_ONLY`.
   - **Permissions**: **Read allowed, Mutations BLOCKED**.
   - Farm staff can view livestock profiles, historical milk production, EHR clinical histories, and reports.
   - **All write operations are strictly intercepted and blocked**: creating/updating animals, recording milk yields, adding clinical treatments, logging transactions, or inviting new farm members.
   - Blocked requests receive `SubscriptionReadOnlyException` (HTTP 403 Forbidden with `code: "SUBSCRIPTION_READ_ONLY"`), accompanied by direct links to the Stripe Customer Portal to settle the invoice.

3. **Stage 3: Terminal Suspension (Day 7+ post-failure)**:
   - **Access Mode**: `SUSPENDED`.
   - **Permissions**: Hard block on both Read and Write operations for farm ERP modules.
   - Subscription transitions to `EXPIRED`.
   - Requests receive `SubscriptionSuspendedException` (HTTP 403 Forbidden with `code: "SUBSCRIPTION_SUSPENDED"`).
   - Only billing and customer portal endpoints remain accessible to reactivate the account.

4. **Automated Suspension Sweeper**:
   - Integrates into the daily BullMQ dunning schedule to scan subscriptions with `daysPastDue > 7` and transition them to `EXPIRED` with immutable audit logging (`SUBSCRIPTION_SUSPENDED_DUE_TO_DUNNING`).

---

## 2. Current State vs. Proposed State

### Current State
- `SubscriptionEntity` has basic helper methods `isPastGracePeriod()` and `canAccessService()`, but there is no mechanism enforcing read-only restrictions on HTTP mutations.
- `SubscriptionQuotaGuard` checks animal counts and plan features, but does not evaluate `PAST_DUE` grace period expiration or block mutating requests during days 4–7.
- No dedicated exception exists to inform clients why their write request was rejected due to grace period expiration.
- No endpoint exists for client apps (Web/Mobile) to inspect their current access mode (`FULL_ACCESS`, `GRACE_PERIOD`, `READ_ONLY`, `SUSPENDED`).

### Proposed State
- **Shared Types (`@vetralink/shared-types`)**:
  - `SubscriptionAccessMode` enum (`FULL_ACCESS`, `GRACE_PERIOD`, `READ_ONLY`, `SUSPENDED`).
  - `SubscriptionAccessStatusDto`: Real-time status payload with `accessMode`, `canRead`, `canWrite`, `daysPastDue`, `gracePeriodDaysRemaining`, and `portalUrl`.
  - `SubscriptionSuspensionResultDto`: Report of accounts transitioned to suspended state.
- **Domain Layer (`apps/api/src/modules/subscriptions`)**:
  - Enhanced `SubscriptionEntity`:
    - `getAccessMode(now: Date): SubscriptionAccessMode`
    - `canWrite(now: Date): boolean`
    - `canRead(now: Date): boolean`
    - `isReadOnly(now: Date): boolean`
    - `isSuspended(now: Date): boolean`
  - Domain exceptions: `SubscriptionReadOnlyException` and `SubscriptionSuspendedException`.
- **Service Layer**:
  - `ISubscriptionGracePeriodService` and `SubscriptionGracePeriodService`:
    - `getAccessStatus(farmId: string, now?: Date): Promise<SubscriptionAccessStatusDto>`
    - `assertWriteAccess(farmId: string, now?: Date): Promise<void>`
    - `assertReadAccess(farmId: string, now?: Date): Promise<void>`
    - `processSuspensions(asOfDate?: Date, traceId?: string): Promise<SubscriptionSuspensionResultDto>`
- **Guard & Decorators Layer**:
  - `SubscriptionReadOnlyGuard`: CanActivate guard that inspects HTTP methods (`POST`, `PUT`, `PATCH`, `DELETE`) and blocks mutations when a farm's subscription is in `READ_ONLY` or `SUSPENDED` mode.
  - Decorators: `@RequireWriteAccess()` and `@AllowReadOnly()` to override defaults where necessary.
- **Controller & Endpoints**:
  - `GET /api/v1/subscriptions/access-status`: Returns tenant access mode and grace period countdown for client UI display.
  - `POST /api/v1/subscriptions/dunning/suspensions/process`: Admin endpoint to execute suspension sweep.

---

## 3. Architectural & Design Trade-offs

### Trade-off 1: Global Interceptor/Guard vs. Per-Route Method Checks
- **Option A (Manual service calls inside every controller method)**:
  - *Cons*: High error rate, easily forgotten by developers when adding new endpoints, mixes authorization/billing concerns with domain use cases.
- **Option B (Dedicated `SubscriptionReadOnlyGuard` using HTTP Method Inspection - SELECTED)**:
  - *Pros*: Automatically applies to mutating verbs (`POST`, `PUT`, `PATCH`, `DELETE`) while permitting `GET` read requests.
  - *Refinements*: Can be attached at controller or route level, or combined with `@AllowReadOnly()` for billing portal actions.

### Trade-off 2: Hard Cutoff at Day 3 vs. Phased Read-Only Mode
- **Option A (Hard cutoff at Day 3)**:
  - *Cons*: Prevents herdsmen from checking vaccination records or medication dosages for sick animals during billing delays, posing animal welfare risks.
- **Option B (Phased Read-Only between Days 4–7 - SELECTED)**:
  - *Pros*: Preserves operational safety for farm livestock while firmly preventing new resource creation until invoices are paid.

---

## 4. Data Models & Contracts

### 4.1 Shared Types (`packages/shared-types`)

```typescript
export enum SubscriptionAccessMode {
  FULL_ACCESS = "FULL_ACCESS",
  GRACE_PERIOD = "GRACE_PERIOD",
  READ_ONLY = "READ_ONLY",
  SUSPENDED = "SUSPENDED",
}

export interface SubscriptionAccessStatusDto {
  subscriptionId: string;
  farmId: string | null;
  status: SubscriptionStatus;
  accessMode: SubscriptionAccessMode;
  canRead: boolean;
  canWrite: boolean;
  daysPastDue: number;
  gracePeriodDaysRemaining: number;
  gracePeriodEnd: string | null;
  suspensionDate: string | null;
  portalUrl?: string;
  message: string;
}

export interface SubscriptionSuspensionResultDto {
  scannedCount: number;
  suspendedCount: number;
  details: {
    subscriptionId: string;
    userId: string;
    farmId: string | null;
    status: SubscriptionStatus;
    message: string;
  }[];
}
```

---

## 5. Security & Error Handling

1. **RFC-7807 Compliance**: Both `SubscriptionReadOnlyException` and `SubscriptionSuspendedException` output structured errors with machine-readable error codes (`SUBSCRIPTION_READ_ONLY`, `SUBSCRIPTION_SUSPENDED`) and human-friendly remediation instructions.
2. **Exemption for Billing & Customer Portal**: Routes handling subscription reactivation, payment method updates, and plan upgrades are decorated with `@AllowReadOnly()` to ensure subscribers can easily pay and restore write access.
3. **Audit Logging (Guardrail-07)**: Automated suspension transitions emit `SUBSCRIPTION_SUSPENDED_DUE_TO_DUNNING` audit logs inside database transactions.
