# ADM-2 directory and audit specification

Status: Implemented locally; final verification recorded in [plan.md](plan.md). Real database/deployment acceptance pending. Started 2026-10-14; resumed 2026-10-15.

## Outcome and scope

Deliver ADMIN/SUPER_ADMIN user, veterinarian and farm directories/details, ordinary-account suspend/reactivate and revoke-all-sessions actions, and a read-only audit list/detail. Bangla and English, responsive shared workspace, keyboard access, explicit Asia/Dhaka dates, loading/empty/error/retry and stale-version feedback are required. Professional approval and administrative privileges retain their existing flows. CMS publication, exports, order support and clinical editing belong to later batches.

## Current implementation and approach

Baseline before ADM-2, confirmed from code on 2026-10-14: AdministrationModule exposed privilege management only; AuditModule has persistence only. User authorizationVersion and row/advisory locks already support immediate invalidation. Existing BFF admin/users paths serve Super-only privilege screens. Use separate fixed BFF admin/directory/{users,veterinarians,farms,audit} paths; new API admin/directory paths match. Reuse current identity, transaction manager, refresh repository, audit persistence and workspace primitives. Alternatives: repurpose privilege routes (breaks existing contracts), or web-only fixtures (cannot deliver account actions). Separate additive endpoints are selected.

## Contracts

All routes require current active ADMIN or SUPER_ADMIN, no membership impersonation. Normal API envelope contains these projections. GET lists use strict limit=20 (1–100), cursor UUID, search<=100; users allow role/status, vets status, farms farmType; audit actorId/action/entityType/entityId/from/to. Audit dates are ISO instants with timezone and valid ordering. Keyset id ascending with id>cursor, limit+1, items and nextCursor; missing/deleted cursor cannot reset pagination.

GET admin/directory/users/:id returns minimal identity/status/authorizationVersion/createdAt, owned/membership farm summaries, application summaries and order count. GET veterinarians/:id requires current VET role and adds license, string specialties, availability, max cases and consultation count. GET farms/:id returns owner summary (null for a deleted owner), bounded member summary (100 with count), active animal count, latest subscription status/plan/period; excludes clinical/ledger/settings/GPS and secrets. All detail relations are bounded (20 farms/applications); counts explicitly describe larger sets. Deleted records are excluded.

POST users/:id/actions accepts strict action SUSPEND|REACTIVATE|REVOKE_SESSIONS, expectedAuthorizationVersion>=0, actorPassword<=128 and trimmed reason 10–500. Actor/target rechecked under sorted row locks and shared admin-policy lock; reject self, ADMIN/SUPER_ADMIN targets, deleted targets, pending-verification status changes and no-op transitions. This stronger restriction protects every Super account including the last one; privilege removal remains the existing Super-only workflow. Password confirmation, rate limit and actor version/password recheck required. Each action increments authorizationVersion, revokes refresh tokens and writes USER_SUSPENDED|USER_REACTIVATED|USER_SESSIONS_REVOKED atomically. Stale versions return 409 ACCOUNT_VERSION_CONFLICT; invalid transition 409 INVALID_ACCOUNT_TRANSITION; restriction 403 ACCOUNT_ACTION_FORBIDDEN; missing 404. Retries with old version cannot silently repeat the action.

Audit list/detail projects id, actorId, action, entityType, entityId, traceId, createdAt and only safe scalar snapshots (role/status/versions/reason). No raw JSON, IPs, emails, phones, clinical or private-review payloads. ADMIN visibility uses an explicit operational action allowlist; unknown/security/privileged/bootstrap events require SUPER_ADMIN. Filtering happens before pagination; disallowed detail returns 404. Append-only persistence remains unchanged; no exports in ADM-2.

## Persistence, review and rollout

No schema migration or dependencies. Repository owns all Prisma queries and guarded projections; service owns policy. API/web/shared builds, unit and BFF boundary regressions and bilingual browser journeys must pass. Real isolated PostgreSQL acceptance covers atomic audit, pagination, concurrent versions and revoked access/refresh if infrastructure is available; unavailable infrastructure must be reported and prevents live acceptance completion. Existing tenant API access remains membership-scoped; admin support reads do not grant membership or clinical data. Rollback: remove new navigation/endpoints; retained audit/session invalidations remain valid. Human-managed Git, no staging/commits/deployment.
