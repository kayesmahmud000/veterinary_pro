# Step-by-Step Implementation Plan: Task 8.5 Image Attachment Upload via Presigned S3 URLs

## Prerequisites
- Working knowledge of `@vetralink/shared-types` monorepo package.
- AWS S3 / `IS3StorageService` configured via `EnvService.s3BucketMedia`.
- Existing `HealthRecord` and `ClinicalHealthModule` infrastructure.

---

## Granular Implementation Checklist

### Step 1: Shared Enums & DTOs (`packages/shared-types`)
- [x] Create `packages/shared-types/src/enums/health-attachment-status.enum.ts` (`PENDING_UPLOAD`, `CONFIRMED`).
- [x] Export enum in `packages/shared-types/src/enums/index.ts`.
- [x] Create `packages/shared-types/src/dto/clinical-health/request-attachment-presigned-url.dto.ts`.
- [x] Create `packages/shared-types/src/dto/clinical-health/presigned-attachment-upload-response.dto.ts`.
- [x] Create `packages/shared-types/src/dto/clinical-health/confirm-attachment-upload.dto.ts`.
- [x] Create `packages/shared-types/src/dto/clinical-health/health-record-attachment-response.dto.ts`.
- [x] Export in `packages/shared-types/src/dto/clinical-health/index.ts` and `packages/shared-types/src/index.ts`.
- [x] Rebuild `@vetralink/shared-types` (`pnpm --filter @vetralink/shared-types build`).

### Step 2: Database Schema & Migration (`apps/api`)
- [x] Update `apps/api/prisma/schema.prisma` with `HealthAttachmentStatus` enum and `HealthRecordAttachment` model.
- [x] Add relations on `HealthRecord`, `Farm`, and `User`.
- [x] Create migration SQL: `apps/api/prisma/migrations/20260913110000_add_health_record_attachments/migration.sql`.
- [x] Run `pnpm --filter @vetralink/api db:generate`.

### Step 3: Domain Entity & Data Access Repository
- [x] Create `apps/api/src/modules/clinical-health/entities/health-record-attachment.entity.ts`.
- [x] Create unit tests in `health-record-attachment.entity.spec.ts`.
- [x] Create repository interface `apps/api/src/modules/clinical-health/repositories/health-record-attachment.repository.interface.ts`.
- [x] Implement repository `apps/api/src/modules/clinical-health/repositories/health-record-attachment.repository.ts`.
- [x] Create repository unit tests in `health-record-attachment.repository.spec.ts`.
- [x] Export repository and interface in `apps/api/src/modules/clinical-health/repositories/index.ts`.

### Step 4: Storage Service Enhancement & Attachment Domain Service
- [x] Ensure `deleteObject` is available in `IS3StorageService` and `S3StorageService`.
- [x] Create service interface `apps/api/src/modules/clinical-health/services/health-attachment.service.interface.ts`.
- [x] Implement domain service `apps/api/src/modules/clinical-health/services/health-attachment.service.ts`:
  - `generateUploadPresignedUrl(farmId, incidentId, userId, dto)`
  - `confirmUpload(farmId, incidentId, attachmentId, dto)`
  - `listAttachments(farmId, incidentId)`
  - `getAttachmentViewUrl(farmId, incidentId, attachmentId)`
  - `deleteAttachment(farmId, incidentId, attachmentId, userId)`
- [x] Create service unit tests in `apps/api/src/modules/clinical-health/services/health-attachment.service.spec.ts`.
- [x] Export in `apps/api/src/modules/clinical-health/services/index.ts`.

### Step 5: DTO Validation & Controller Wiring
- [x] Create class-validator DTOs:
  - `apps/api/src/modules/clinical-health/dto/request-attachment-presigned-url.dto.ts`
  - `apps/api/src/modules/clinical-health/dto/confirm-attachment-upload.dto.ts`
- [x] Update `apps/api/src/modules/clinical-health/clinical-health.controller.ts` with attachment routes:
  - `POST /clinical-health/incidents/:id/attachments/presigned-url`
  - `POST /clinical-health/incidents/:id/attachments/:attachmentId/confirm`
  - `GET /clinical-health/incidents/:id/attachments`
  - `GET /clinical-health/incidents/:id/attachments/:attachmentId/view-url`
  - `DELETE /clinical-health/incidents/:id/attachments/:attachmentId`
- [x] Register providers and import `MediaModule` in `ClinicalHealthModule`.
- [x] Add controller unit tests in `clinical-health.controller.spec.ts`.

### Step 6: Verification & Acceptance Criteria
- [x] Run test suite for `clinical-health` module (`pnpm --filter @vetralink/api test src/modules/clinical-health`).
- [x] Run full test suite for `api` package (`pnpm --filter @vetralink/api test`).
- [x] Run Turborepo monorepo build (`pnpm build`).
- [x] Update `plan.md` checklist items.
- [x] Update `ROADMAP.md` (mark Task 8.5 complete, completing Sprint 8).
