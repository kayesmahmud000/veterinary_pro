# Task 10.3: Subscription Quota Guard & Tier Limits Interceptor Plan

## 1. Prerequisites & Environment
- [x] TypeScript strict mode, clean architecture, and monorepo packages up to date.
- [x] Ensure existing test suites pass.

---

## 2. Implementation Steps

### Phase 1: Shared Types & DTO Contracts (`packages/shared-types`)
- [x] Define `SubscriptionQuotaType` enum (`ANIMALS`, `STAFF`) in `packages/shared-types/src/enums/subscription.enum.ts` (or `packages/shared-types/src/dto/subscription/`).
- [x] Define `SubscriptionQuotaUsageDto`, `FarmQuotaSummaryDto`, `AddFarmMemberDto`, `FarmMemberResponseDto` in `packages/shared-types/src/dto/subscription/` and `packages/shared-types/src/dto/farm/`.
- [x] Export all types through index files.
- [x] Rebuild `@vetralink/shared-types` via `pnpm --filter @vetralink/shared-types build`.

### Phase 2: Domain Exception & Repository Layer (`apps/api`)
- [x] Implement `QuotaExceededDomainException` in `apps/api/src/common/exceptions/domain.exception.ts`.
- [x] Define `ISubscriptionUsageRepository` in `apps/api/src/modules/subscriptions/repositories/subscription-usage.repository.interface.ts`.
- [x] Implement `SubscriptionUsageRepository` in `apps/api/src/modules/subscriptions/repositories/subscription-usage.repository.ts` querying active animals (`deletedAt: null`) and farm members by `farmId`.
- [x] Unit test `SubscriptionUsageRepository` in `subscription-usage.repository.spec.ts`.

### Phase 3: Quota Service & Guard Implementation (`apps/api`)
- [x] Define `ISubscriptionQuotaService` in `apps/api/src/modules/subscriptions/services/subscription-quota.service.interface.ts`.
- [x] Implement `SubscriptionQuotaService` in `apps/api/src/modules/subscriptions/services/subscription-quota.service.ts`:
  - `checkQuota(farmId, quotaType, increment)`
  - `assertQuotaAvailable(farmId, quotaType, increment)`
  - `getFarmQuotaUsage(farmId)`
  - Fallback logic to `STARTER` plan if no subscription record exists.
- [x] Unit test `SubscriptionQuotaService` in `subscription-quota.service.spec.ts`.
- [x] Define `@CheckQuota(type, increment?)` decorator in `apps/api/src/common/decorators/quota.decorator.ts`.
- [x] Implement `SubscriptionQuotaGuard` in `apps/api/src/modules/subscriptions/guards/subscription-quota.guard.ts` (extracting `farmId` from request context, reading metadata via `Reflector`, asserting quota via `ISubscriptionQuotaService`).
- [x] Unit test `SubscriptionQuotaGuard` in `subscription-quota.guard.spec.ts`.
- [x] Register and export service, repository, and guard in `SubscriptionsModule`.

### Phase 4: Quota Endpoint & Controller Wiring
- [x] Expose `GET /api/v1/subscriptions/farm/:farmId/quota` in `SubscriptionController`.
- [x] Update `subscription.controller.spec.ts`.

### Phase 5: Animal Registration & Bulk Import Quota Interception
- [x] Wire `SubscriptionQuotaGuard` into `AnimalsController`:
  - Decorate `POST /animals` with `@UseGuards(SubscriptionQuotaGuard)` and `@CheckQuota(SubscriptionQuotaType.ANIMALS)`.
  - Decorate `POST /animals/import` with `@UseGuards(SubscriptionQuotaGuard)` and `@CheckQuota(SubscriptionQuotaType.ANIMALS)`.
  - Add feature check for `bulkImportExport` in `createImportJob` / guard.
  - Enforce quota verification in `AnimalImportProcessor` to prevent batch rows from exceeding limits.
- [x] Update animal controller and processor tests.

### Phase 6: Farm Staff Member Invitation & Addition Flow (`FarmsModule`)
- [x] Create `AddFarmMemberRequestDto` and `FarmMemberResponseDto` in `apps/api/src/modules/farms/dto/`.
- [x] Create `IFarmMembersService` and `FarmMembersService` in `apps/api/src/modules/farms/services/`.
- [x] Create `FarmMembersController` in `apps/api/src/modules/farms/farm-members.controller.ts`:
  - `POST /farms/:farmId/members`: `@UseGuards(JwtAuthGuard, TenantGuard, SubscriptionQuotaGuard)`, `@FarmRoles(FarmRole.OWNER, FarmRole.MANAGER)`, `@CheckQuota(SubscriptionQuotaType.STAFF)`.
  - `GET /farms/:farmId/members`: list members.
- [x] Unit test `FarmMembersService` and `FarmMembersController`.
- [x] Register in `FarmsModule`.

### Phase 7: Verification & Acceptance
- [x] Run full subscriptions test suites: `pnpm --filter @vetralink/api test -- src/modules/subscriptions`.
- [x] Run animals test suites: `pnpm --filter @vetralink/api test -- src/modules/animals`.
- [x] Run farms test suites: `pnpm --filter @vetralink/api test -- src/modules/farms`.
- [x] Run entire API test suite: `pnpm --filter @vetralink/api test`.
- [x] Run monorepo build: `pnpm build`.
- [x] Update `ROADMAP.md` (check off Task 10.3) and `plan.md`.
- [x] Provide completion summary with suggested conventional commit message and stop at human-in-the-loop gate.
