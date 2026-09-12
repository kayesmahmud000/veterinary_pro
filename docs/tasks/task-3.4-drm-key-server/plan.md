# PLAN-304: AES-128 / DRM Key Server Endpoint with Time-Bound JWT Verification
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 3: Digital Product Catalog & Media Asset Pipeline
# Task 3.4: AES-128 / DRM key server endpoint with time-bound JWT verification
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Prerequisites
- [x] Task 3.1: Product master CRUD operational.
- [x] Task 3.2: Presigned S3 direct multipart upload operational.
- [x] Task 3.3: BullMQ video processing worker with multi-bitrate HLS segmentation operational.
- [x] Environment variable `HLS_DRM_KEY_SECRET` configured in `env.schema.ts`.

---

## 2. Granular Implementation Steps

### Step 1: Environment Configuration Updates
- [x] Update `apps/api/src/config/env.schema.ts`:
  - Add `HLS_DRM_KEY_SECRET` with default development secret (min 32 chars).
  - Add `DRM_TOKEN_EXPIRATION_SECONDS` defaulting to 600 (10 minutes).
- [x] Update `EnvService` with getters for `hlsDrmKeySecret` and `drmTokenExpirationSeconds`.
- [x] Update `env.schema.spec.ts` to verify new configuration keys.

### Step 2: Shared Contracts in `@vetralink/shared-types`
- [x] Create `packages/shared-types/src/dto/media/drm.dto.ts`:
  - `DrmPlaybackTokenRequestDto`
  - `DrmPlaybackTokenResponseDto`
  - `DrmTokenPayload`
- [x] Export from `packages/shared-types/src/dto/media/index.ts` and `src/index.ts`.
- [x] Build `@vetralink/shared-types` (`pnpm --filter @vetralink/shared-types build`).

### Step 3: DRM Key Derivation & Token Management Services
- [x] Create `apps/api/src/modules/media/services/drm-key.service.interface.ts`:
  - `IDrmKeyService` interface and `DRM_KEY_SERVICE` injection token.
- [x] Create `apps/api/src/modules/media/services/drm-key.service.ts`:
  - Implement HKDF-SHA256 deterministic 16-byte key derivation from `HLS_DRM_KEY_SECRET` + `productId`.
  - Implement `generateKeyInfoFile(productId, keyUrl, outputDir)` writing key info for FFmpeg.
- [x] Create `apps/api/src/modules/media/services/drm-token.service.interface.ts`:
  - `IDrmTokenService` interface and `DRM_TOKEN_SERVICE` injection token.
- [x] Create `apps/api/src/modules/media/services/drm-token.service.ts`:
  - Sign and verify HMAC-SHA256 time-bound ephemeral JWT tokens.
- [x] Author unit tests:
  - `drm-key.service.spec.ts`
  - `drm-token.service.spec.ts`

### Step 4: Entitlement Verification Service
- [x] Create `apps/api/src/modules/media/services/entitlement.service.interface.ts`:
  - `IEntitlementService` interface and `ENTITLEMENT_SERVICE` injection token.
- [x] Create `apps/api/src/modules/media/services/entitlement.service.ts`:
  - Verify access rights via `SUPER_ADMIN` / `ADMIN` bypass.
  - Verify purchase via `PrismaService.orderItem` + `Order` (`status === COMPLETED`).
  - Verify subscription via `PrismaService.subscription` (`status === ACTIVE | TRIALING`) and tier hierarchy comparison.
- [x] Author unit tests in `entitlement.service.spec.ts`.

### Step 5: DRM Key Controller & Module Registration
- [x] Create `apps/api/src/modules/media/dto/drm-playback-token.dto.ts` with `class-validator` rules.
- [x] Create `apps/api/src/modules/media/drm-key.controller.ts`:
  - `POST /api/v1/media/drm/playback-token`: Entitlement check and token issuance.
  - `GET /api/v1/media/drm/key/:playbackToken`: Emits 16-byte binary buffer with `Content-Type: application/octet-stream` and `Cache-Control: private, no-cache, no-store, must-revalidate`.
  - `GET /api/v1/media/drm/key?token=...`: Query parameter variant.
  - `GET /api/v1/media/key/:playbackToken`: Direct route alias per `ARCHITECTURE.md`.
- [x] Register new providers and controller in `MediaModule`.
- [x] Export services and tokens in `apps/api/src/modules/media/index.ts`.

### Step 6: Transcoder Integration (Encryption Hook)
- [x] Update `FfmpegTranscoderService` to support an optional `keyInfoFilePath` parameter in `HlsTranscodeParams` enabling `-hls_key_info_file` in FFmpeg args.
- [x] Verify existing transcoder unit tests pass without regression.

### Step 7: Controller Unit & Supertest Integration Tests
- [x] Author `drm-key.controller.spec.ts` (unit tests).
- [x] Author `drm-key.controller.int.spec.ts` (Supertest integration suite testing token issuance, unauthenticated rejections, forbidden access, and successful binary key delivery).

### Step 8: Full Verification & Roadmap Update
- [x] Run full test suite: `pnpm --filter @vetralink/api test`.
- [x] Run build: `pnpm --filter @vetralink/api build`.
- [x] Update `ROADMAP.md` checking off Task 3.4.

---

## 3. Acceptance Criteria
1. **Cryptographic Key Derivation**: 16-byte AES key derived deterministically via HKDF-SHA256 from master secret and product ID.
2. **Time-Bound Token Verification**: Playback tokens signed via HMAC-SHA256 with 10-minute TTL; expired or tampered tokens rejected with 401 Unauthorized.
3. **Entitlement Rule Enforcement**: Non-admin users denied access (403 Forbidden) unless they have a completed order or active subscription meeting the product tier.
4. **Binary Key Delivery**: Successful key request emits exactly 16 bytes as `application/octet-stream` with strict no-cache headers (`Cache-Control: private, no-cache, no-store, must-revalidate`).
5. **HLS Player Compatibility**: Key endpoint accessible via route parameter (`/api/v1/media/drm/key/:playbackToken`) and query string (`/api/v1/media/drm/key?token=...`).
6. **100% Test Pass Rate**: All unit and integration test suites pass with zero regressions.
