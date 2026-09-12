# PLAN-305: CloudFront Origin Access Control (OAC) Signed URL & Cookie Delivery Pipeline
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 3: Digital Product Catalog & Media Asset Pipeline
# Task 3.5: CloudFront Origin Access Control (OAC) signed URL delivery pipeline
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Prerequisites
- [x] Task 3.1: Product master CRUD operational.
- [x] Task 3.2: Presigned S3 direct multipart upload operational.
- [x] Task 3.3: BullMQ video processing worker with multi-bitrate HLS segmentation operational.
- [x] Task 3.4: AES-128 / DRM key server endpoint with time-bound JWT verification operational.

---

## 2. Granular Implementation Steps

### Step 1: Environment Configuration
- [x] Update `apps/api/src/config/env.schema.ts`:
  - `CLOUDFRONT_DISTRIBUTION_DOMAIN`: string optional in dev/test, validated domain.
  - `CLOUDFRONT_KEY_PAIR_ID`: string optional in dev/test.
  - `CLOUDFRONT_PRIVATE_KEY`: string optional in dev/test (RSA private key).
  - `CLOUDFRONT_URL_EXPIRATION_SECONDS`: positive integer defaulting to 3600 (1 hour).
  - Add superRefine rules for production/staging to require these when CDN is enabled.
- [x] Update `EnvService` to expose getters for the new CloudFront variables.
- [x] Add unit test assertions in `env.schema.spec.ts`.

### Step 2: Shared Contracts in `@vetralink/shared-types`
- [x] Create `packages/shared-types/src/dto/media/stream.dto.ts`:
  - `StreamPlaybackSessionRequestDto`
  - `CloudFrontSignedCookiesDto`
  - `StreamPlaybackSessionResponseDto`
- [x] Export contracts in `packages/shared-types/src/dto/media/index.ts` and `src/index.ts`.
- [x] Build `@vetralink/shared-types` (`pnpm --filter @vetralink/shared-types build`).

### Step 3: CloudFront Signer Service
- [x] Create `apps/api/src/modules/media/services/cloudfront-signer.service.interface.ts`:
  - Define `ICloudFrontSignerService` and `CLOUDFRONT_SIGNER_SERVICE` token.
- [x] Create `apps/api/src/modules/media/services/cloudfront-signer.service.ts`:
  - Implement native Node `crypto` RSA-SHA1 signing for CloudFront canned and custom policies.
  - Support signed URL generation (`signUrl`, `signUrlCustomPolicy`).
  - Support signed cookie generation (`generateSignedCookies`).
  - Provide fallback behavior when CloudFront credentials are omitted in local development.
- [x] Create unit tests in `cloudfront-signer.service.spec.ts` testing:
  - Canned policy URL signing.
  - Custom policy URL signing with wildcards (`/hls/<id>/*`).
  - Signed cookies generation (`CloudFront-Policy`, `CloudFront-Signature`, `CloudFront-Key-Pair-Id`).
  - Dev/test fallback mode.

### Step 4: Stream Delivery Orchestration Service
- [x] Create `apps/api/src/modules/media/services/stream-delivery.service.interface.ts`:
  - Define `IStreamDeliveryService` and `STREAM_DELIVERY_SERVICE` token.
- [x] Create `apps/api/src/modules/media/services/stream-delivery.service.ts`:
  - Query `Product` via Prisma / Product repository to ensure it exists, is published, and is a video course.
  - Invoke `IEntitlementService` to enforce access control (admin bypass, purchased order item, or active subscription).
  - Generate DRM key playback URL via `IDrmTokenService`.
  - Invoke `ICloudFrontSignerService` to generate CloudFront signed URL and signed cookies.
- [x] Create unit tests in `stream-delivery.service.spec.ts`.

### Step 5: Stream Delivery Controller & Module Wiring
- [x] Create `apps/api/src/modules/media/dto/stream-session.dto.ts` with `class-validator` rules and Swagger annotations.
- [x] Create `apps/api/src/modules/media/stream-delivery.controller.ts`:
  - `POST /api/v1/media/stream/session`: Authenticated endpoint returning playback session with signed URL and cookies.
  - `GET /api/v1/media/stream/:productId/manifest`: Sets `Set-Cookie` headers and redirects (or returns) signed playlist.
- [x] Wire providers and controller into `MediaModule`.
- [x] Export interfaces, tokens, and services in `apps/api/src/modules/media/index.ts`.

### Step 6: Unit & Integration Tests
- [x] Author `stream-delivery.controller.spec.ts` (unit tests).
- [x] Author `stream-delivery.controller.int.spec.ts` (Supertest integration tests testing authentication, entitlement enforcement, 403 Forbidden on unentitled users, 200 OK on entitled users, and cookie headers).

### Step 7: Verification & Roadmap Check-Off
- [x] Run test suite: `pnpm --filter @vetralink/api test`.
- [x] Run build: `pnpm --filter @vetralink/api build`.
- [x] Update `ROADMAP.md` checking off Task 3.5.

---

## 3. Acceptance Criteria
1. **CloudFront OAC Policy Compliance**: Custom policies signed with RSA-SHA1 with wildcards (`/hls/<productId>/*`) conforming to AWS CloudFront signing standards.
2. **Dual Access Modalities**: Client can consume playback either via Signed URL query parameters or via Signed Cookies (`CloudFront-Policy`, `CloudFront-Signature`, `CloudFront-Key-Pair-Id`).
3. **Entitlement Protection**: Requests rejected with 403 Forbidden unless user is Admin, has completed purchase of the course, or holds an active subscription >= `minSubscriptionTier`.
4. **DRM Integration**: Response includes linked DRM key URL with short-lived playback token from Task 3.4.
5. **Zero-Breakage Local Experience**: Graceful mock/fallback mode when CloudFront keys are absent in development or automated CI environments.
6. **100% Test Passing**: All unit and integration tests pass without regression.
