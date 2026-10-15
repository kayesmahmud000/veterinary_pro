# Project overview

VETRALINK PRO serves farm owners and staff, veterinarians, platform administrators and digital-content buyers. Product intent combines livestock ERP, educational video/eBook/tool sales, and tele-veterinary consultations. Rural connectivity, farm isolation, financial accuracy and durable clinical history are central constraints. Product sources: [product blueprint](../vetralink_pro_blueprint.md), [platform specification](../vetralink_platform_specification.pdf), [ARCHITECTURE.md](../ARCHITECTURE.md); task-level requirements live in [docs](../docs/). See the [existing-document index](README.md#existing-project-documents) for the roadmap, agent rules and supporting guides.

## Actual stack

Versions below are manifest major versions/ranges, not a claim about the newest upstream release. Resolve exact installed versions from lockfiles.

| Area | Present implementation |
| ---------------- | ------------------------------------------------------------------------------------------------------------- |
| Workspace | pnpm `10.18.3`, Turborepo 2, Node engine `>=20`; CI uses Node 20 |
| API | NestJS 10 on Express 4, TypeScript 5, Prisma 5; class-validator DTOs and Zod environment parsing |
| Database | PostgreSQL 16 in local Compose; Redis 7 for BullMQ and Redis-backed mechanisms |
| Web | Next.js 14 App Router, React 18; configured Tailwind 3 utilities, Lucide, clsx, tailwind-merge |
| Mobile | Flutter/Dart (`>=3.0.0 <4.0.0`), Dio, sqflite, uuid; flutter_bloc dependency |
| Shared contracts | `@vetralink/shared-types`, tsup emits CJS, ESM and declarations |
| Integrations | S3-compatible storage/MinIO, Stripe, regional MFS handler, CloudFront signing, Daily provider, mail providers |
| Tests | API Jest/ts-jest and Supertest; Flutter sync-model tests; k6 load scripts |

## Repository map

- `apps/api/src/app.module.ts`: modular monolith composition and Redis queue connection.
- `apps/api/src/main.ts`, `src/serverless.ts`, `api/index.js`: separate persistent and serverless entry paths.
- `apps/api/src/modules/`: domain modules; `common/`: guards, envelopes, crypto, idempotency; `config/`: environment schema/service.
- `apps/api/prisma/`: active Prisma schema and migration lineage selected by API package configuration.
- `prisma/`: a second, differing schema/migration tree; do not target implicitly.
- `apps/web/src/app/`: root layout, four public marketing pages and 404 recovery; shared navigation/marketing components live in `src/components/marketing/`. `src/lib/i18n/` supplies Bangla-default/English content, request locale resolution, a persistent selection action and localized metadata/numbers (updated 2026-10-06).
- `apps/mobile/lib/`: placeholder app and standalone `core/sync/` implementation.
- `packages/shared-types/`: shared interfaces, response contracts, DTOs and enums; no shared UI package exists.
- `infrastructure/`: local backing services and load scripts, not a full production application deployment.
- `.github/workflows/`: API/web build workflows and Flutter test/APK workflow.
- `docs/features/`, `docs/tasks/`, `docs/guides/`: existing design, implementation and operational history.

## Product status

Backend features have substantial source and test coverage in the repository, but this context does not certify every path. Web modal authentication and a scoped session provider/boundary were added on 2026-10-07; [the auth plan](../docs/tasks/web-auth-modals/plan.md) distinguishes local verification from live backend acceptance. Farmer setup/member workspace and professional application/review/access navigation exist; operational livestock/clinical/commerce dashboards remain pending. Mobile BLoC screens, login and sync wiring are not present in `main.dart`. “Doctor portal,” “triage dashboard” and “prescription editor” task names frequently refer to backend capabilities, not completed client screens. Read [known gaps](known-gaps.md) before estimating or shipping work.

Updated 2026-10-07: the six platform roles include default LEARNER; public signup also accepts FARMER/VET/BUYER. New FARMER accounts must complete atomic create/confirm onboarding before operational farm access. Shared Zod and protected modal/workspace boundaries are implemented; reviewed professional upgrades and SUPER-only administrative changes use audited transactions/versioned current-primary authorization. [Feature evidence and deployment limits](../docs/features/role-request-approval/operations.md) cover isolated PostgreSQL/Redis tests and mock mail without production migration.

Updated 2026-10-15: ADM-2 adds bilingual administrative user/veterinarian/farm directories and redacted read-only audit list/detail, plus password-confirmed/versioned ordinary-account status/session actions under `admin/directory`. Existing Super-only privilege routes remain separate. [Shared spec and verification](../docs/features/admin-directory-audit/plan.md) record local checks and pending real database/deployment acceptance; this does not grant farm membership or clinical/publication rights.

Updated 2026-10-15 (ADM-3): guarded product master/draft editing and managed media inventory/upload/processing/attachment routes are implemented locally in API/web. Product versions, persisted upload ownership and isolated worker output protect edits; legacy routes cannot replace managed assets. An additive API-schema migration was rehearsed against a populated disposable PostgreSQL database. [Spec/evidence and rollout](../docs/features/admin-product-media/plan.md) retain real storage/queue/FFmpeg/deployment limits; this does not complete the buyer catalog/library or course curriculum/progress.

Updated 2026-10-15 (YouTube admin): provider-aware free YouTube product creation/publication and guarded versioned lesson editor/preview are implemented locally. CourseLesson persistence and atomic audit retain order/IDs and prevent stale saves; internal storage/DRM/checkout paths reject these course assets. [Evidence and remaining scope](../docs/features/youtube-courses/plan.md) distinguish disposable PostgreSQL/controlled browser checks from real YouTube/live migration acceptance. Enrollment/public demo APIs and learner library/player remain pending; no CourseEnrollment model is created by the admin-first slice.

Updated 2026-10-15 (YouTube learner): public course discovery/demos, free enrollment, own course library and protected in-site lesson player are implemented locally. CourseEnrollment and atomic idempotent registration supplement the earlier admin curriculum; public outlines omit source IDs, membership is current-user scoped, and player switching/errors/readiness have bounded recovery. [Verification and rollout](../docs/features/youtube-courses/plan.md) distinguish disposable PostgreSQL and controlled player/browser evidence from real authenticated writes/YouTube configured-origin acceptance. The subsequently authorized [live schema repair](../docs/tasks/web-live-api-routing/plan.md) applied all three course/media migrations with backup restoration and original-data preservation verified; public live/local-BFF course reads now return HTTP 200. Progress/certificates/paid enrollment remain deferred.
