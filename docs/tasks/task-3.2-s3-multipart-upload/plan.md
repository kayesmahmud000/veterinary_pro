# PLAN-302: Presigned S3 Direct Multipart Upload Implementation Plan
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 3: Digital Product Catalog & Media Asset Pipeline
# Task 3.2: Presigned S3 direct multipart upload for heavy video masters and PDF assets
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Prerequisites
- [x] Task 3.1: Product master CRUD operational.
- [x] AWS credentials and S3 bucket names defined in `env.schema.ts`.
- [x] Dependencies: Add `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` to `apps/api`.

---

## 2. Granular Implementation Steps

### Step 1: Environment Schema Update & SDK Installation
- [x] Update `apps/api/src/config/env.schema.ts` & `apps/api/src/config/env.service.ts`:
  - Add optional `S3_ENDPOINT` (e.g. `http://localhost:9000` for MinIO) and `S3_FORCE_PATH_STYLE` boolean.
  - Update `env.schema.spec.ts` to verify default behavior and new options.
- [x] Install AWS SDK packages: `pnpm --filter @vetralink/api add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner`.

### Step 2: Media Upload Contracts in `@vetralink/shared-types`
- [x] Create `packages/shared-types/src/dto/media/media-upload.dto.ts`:
  - `MediaCategory` enum (`VIDEO_COURSE`, `EBOOK`, `EXCEL_TOOL`, `THUMBNAIL`, `ATTACHMENT`).
  - Request and Response interfaces for:
    - `InitiateMultipartUploadRequestDto`, `InitiateMultipartUploadResponseDto`.
    - `GetPresignedPartUrlRequestDto`, `GetPresignedPartUrlResponseDto`.
    - `CompleteMultipartUploadRequestDto`, `CompleteMultipartUploadResponseDto`.
    - `AbortMultipartUploadRequestDto`.
    - `DirectUploadRequestDto`, `DirectUploadResponseDto`.
- [x] Export from `packages/shared-types/src/dto/media/index.ts`, `src/dto/index.ts`, and `src/index.ts`.
- [x] Build `@vetralink/shared-types` (`pnpm --filter @vetralink/shared-types build`).

### Step 3: S3 Storage Adapter (`S3StorageService`) & Unit Tests
- [x] Create `apps/api/src/modules/media/services/s3-storage.service.interface.ts`:
  - `IS3StorageService` interface.
  - Injection token `S3_STORAGE_SERVICE = "S3_STORAGE_SERVICE"`.
- [x] Create `apps/api/src/modules/media/services/s3-storage.service.ts`:
  - Instantiates `S3Client` with region, credentials, endpoint, and forcePathStyle.
  - Implements:
    - `createMultipartUpload(bucket, key, contentType)`.
    - `getPresignedPartUploadUrl(bucket, key, uploadId, partNumber, expiresInSeconds)`.
    - `completeMultipartUpload(bucket, key, uploadId, parts)`.
    - `abortMultipartUpload(bucket, key, uploadId)`.
    - `getPresignedPutUrl(bucket, key, contentType, expiresInSeconds)`.
    - `getPresignedGetUrl(bucket, key, expiresInSeconds)`.
- [x] Create `apps/api/src/modules/media/services/s3-storage.service.spec.ts`:
  - Unit tests with mocked S3 client commands and `getSignedUrl`.

### Step 4: Media Upload Domain Service (`MediaUploadService`) & Unit Tests
- [x] Create `apps/api/src/modules/media/services/media-upload.service.interface.ts`:
  - `IMediaUploadService` interface.
  - Injection token `MEDIA_UPLOAD_SERVICE = "MEDIA_UPLOAD_SERVICE"`.
- [x] Create `apps/api/src/modules/media/services/media-upload.service.ts`:
  - Injects `IS3StorageService` and `EnvService`.
  - Enforces MIME validation, file size bounds, and extension checks.
  - Calculates chunk sizes (e.g. 10MB per part) and total estimated parts.
  - Generates deterministic S3 keys (`raw-videos/...`, `ebooks/...`, `tools/...`, `thumbnails/...`).
- [x] Create `apps/api/src/modules/media/services/media-upload.service.spec.ts`:
  - Tests validation errors for unsupported extensions/sizes, key generation, and upload lifecycles.

### Step 5: Input DTOs, Controller & Swagger Documentation
- [x] Create `apps/api/src/modules/media/dto/`:
  - Concrete class DTOs with `class-validator` and `@ApiProperty`.
- [x] Create `apps/api/src/modules/media/media-upload.controller.ts`:
  - Mounted at `/api/v1/media/uploads`.
  - Guarded by `@UseGuards(JwtAuthGuard, RolesGuard)` with `@Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.VET)`.
  - Endpoints:
    - `POST /multipart/initiate`
    - `POST /multipart/part-url`
    - `POST /multipart/complete`
    - `POST /multipart/abort`
    - `POST /presigned-url`
- [x] Create `apps/api/src/modules/media/media-upload.controller.spec.ts` unit tests.
- [x] Create `apps/api/src/modules/media/media-upload.controller.int.spec.ts` integration tests.

### Step 6: Module Wiring & Verification
- [x] Create `apps/api/src/modules/media/media.module.ts`.
- [x] Wire `MediaModule` into `apps/api/src/app.module.ts`.
- [x] Run full test suite: `pnpm --filter @vetralink/api test`.
- [x] Run build: `pnpm --filter @vetralink/api build`.
- [x] Update `ROADMAP.md` checking off Task 3.2.

---

## 3. Acceptance Criteria
1. **Direct-to-S3 Multipart Ingestion**: Heavy video files can be initialized, chunked into presigned part URLs, and completed without binary data touching the NestJS process.
2. **Direct Single-Part Presigned URLs**: Lightweight PDFs, tools, and images generate secure 15-minute PUT URLs.
3. **MIME & Size Enforcement**: Disallowed extensions and oversized uploads rejected with `ValidationDomainException`.
4. **RBAC Protection**: Upload generation endpoints strictly restricted to `SUPER_ADMIN`, `ADMIN`, and `VET`.
5. **Abort Capability**: Failed or cancelled multipart uploads can be purged from S3 via abort endpoint.
6. **100% Test Pass Rate**: Full unit and integration tests passing with zero regressions.
