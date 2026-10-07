# Implemented files and module impact

Status: **Source inventory, 2026-10-07.** Human-managed Git policy is preserved. Existing uncommitted auth-modal work was retained and extended. The active API Prisma tree owns migrations; the divergent root tree is untouched.

## Shared contracts

- packages/shared-types/src/enums/index.ts: six roles, public allowlist and professional/request enums.
- packages/shared-types/src/dto/auth/register.dto.ts and auth-tokens.dto.ts: narrowed public role type and additive identity/session metadata.
- packages/shared-types/src/validation/index.ts: shared strict Zod form/request/response schemas.
- Shared package/index, web package and pnpm-lock.yaml: Zod dependency/exports.

## Backend implementation

| Files/modules | Responsibility |
| --- | --- |
| apps/api/prisma/schema.prisma and migrations/20261007090000_add_learner_role, 20261007090100_role_workflows_and_farm_onboarding, 20261007090200_strengthen_role_request_constraints | Additive role/workflow persistence and constraints |
| modules/auth/services/auth.service.ts, token.service.ts, current-identity.service.ts; auth controller/module; DTO and refresh repository/interface | Default roles, safe summaries, current identity, narrow login, atomic refresh and replay invalidation |
| modules/users/entities/user.entity.ts; repositories/user.repository.ts/interface; auth-user-summary.ts | Controlled role/version/fallback transitions, ordered locks and explicit safe projection |
| common/guards/jwt-auth.guard.ts, roles.guard.ts, tenant.guard.ts | Current-primary authentication, exact role allowlists, incomplete farmer gate |
| common/pipes/schema-validation.pipe.ts; common/utils/workflow.ts, validate-workflow.ts; common/security/workflow-rate-limiter.ts | Runtime validation, canonical idempotency hash, Redis application/privilege abuse limits |
| modules/farms/farm-onboarding.controller.ts; repositories/farm-onboarding.repository.ts; services/farm-onboarding.service.ts | Idempotent create/confirm onboarding and authorized discovery |
| modules/farms/farm-members.controller.ts, dto/add-farm-member.dto.ts, services/farm-members.service.ts/interface, farms.module.ts | Existing-account email/UUID members, OWNER/MANAGER checks, audit and farm-lock quota |
| modules/subscriptions/repositories/subscription-usage.repository.ts | Primary owner excluded from staff usage |
| modules/role-requests/questionnaires.ts, role-requests.controller.ts/module, services/role-request.service.ts, repositories/role-request.repository.ts | Versioned catalogue, self history/submission, atomic review/profile/audit/outbox |
| modules/administration/administration.module.ts, privileged-roles.controller.ts, privileged-role.service.ts | SUPER-only list/email lookup/grant/removal/reauth/fallback/session revocation |
| modules/role-notifications/role-events.module.ts, role-notifications-worker.module.ts, role-notification.repository.ts, role-notification-dispatcher.service.ts, role-notification.processor.ts, role-notification.template.ts | Durable outbox/recipient/lease/queue worker and escaped bilingual mail |
| modules/mail/mail-provider.module.ts, mail.module.ts | Lightweight shared provider bindings, existing order mail preserved |
| modules/consultations/gateways/consultation-chat.gateway.ts; controllers/consultation-chat.controller.ts | Current identity and membership on events/receiving sockets; bounded passive expiry |
| modules/orders/orders.controller.ts and services/order-fulfillment.service.ts | Explicit SUPER support with owned-entitlement checks |
| modules/sync/services/sync.service.ts | LEARNER/incomplete FARMER operational gate |
| app.module.ts, config/env.schema.ts/service, package.json, tsconfig.build.json, .env.example, .env.vercel.example, role-notifications.worker.ts, scripts/bootstrap-super-admin.ts | Composition, typed trusted origin/grace config, stable build output and offline recovery |

Backend source paths in the table are relative to apps/api/src unless explicitly rooted. There is no runtime change to mobile, root Prisma, cryptography/provider adapters, original migration history or unrelated financial/clinical services.

## Frontend implementation

- src/components/auth and src/lib/auth: existing native modals, six-role/default signup, shared Zod, HttpOnly BFF and coordinated sessions.
- src/app/api/workspace/[...path]/route.ts and src/lib/workspace/{contracts,server,client}.ts: fixed protected endpoints, strict Zod inputs/safe responses, origin/tenant/error envelope handling.
- src/lib/i18n/{auth,workspace,bn,en}.ts: bilingual role/form/status/error/account navigation.
- src/components/workspace/{workspace,workspace-ui,farm-workspace,role-workspace,administrative-access}.tsx and workspace.module.css: guarded forms/views/confirmation/responsive styling.
- src/app/(workspace)/layout.tsx and eight pages under account/farm-onboarding, account/role-requests, farm, admin/role-requests and admin/administrative-access: protected work destinations, dynamic metadata.
- Existing root layout/header/mobile navigation, package.json and .env.example: modal/session composition and scripts/config.

Frontend source paths are relative to apps/web. No separate authentication pages were created.

## Verification and documentation

New real-DB tests: apps/api/src/common/security/role-workflow.database.spec.ts. Worker recovery/privacy tests: modules/role-notifications/role-notifications.spec.ts. Farm/auth/token/guard/gateway tests were extended. Existing controller/integration harnesses now supply a current-identity test provider; this does not replace real current-primary authorization tests.

Web scripts/check-auth.mjs, check-auth-browser.mjs, check-workspace.mjs and check-workspace-browser.mjs test actual boundaries/rendering with explicit synthetic environments. Local scripts/build reports under temporary directories are not application source.

Shared specification/plan/investigation/runbook, API/web roadmap, modal/public specs and linked .context were reconciled. See [verification and operating limits](operations.md).
