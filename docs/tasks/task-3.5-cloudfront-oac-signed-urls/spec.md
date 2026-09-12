# SPEC-305: CloudFront Origin Access Control (OAC) Signed URL & Cookie Delivery Pipeline
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 3: Digital Product Catalog & Media Asset Pipeline
# Task 3.5: CloudFront Origin Access Control (OAC) signed URL delivery pipeline
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Feature Overview & Objective

In VETRALINK PRO, high-value veterinary video courses and encrypted HLS master assets (`ProductType.VIDEO_COURSE`) as well as digital assets (eBooks, spreadsheets) are stored in private AWS S3 / Cloudflare R2 object storage vaults. Direct public bucket access is prohibited (`BlockPublicAccess: true`), and origin access is restricted exclusively to Amazon CloudFront distributions using **Origin Access Control (OAC)**.

While Task 3.3 established automated multi-bitrate HLS segmentation and Task 3.4 established the DRM key server with time-bound JWT verification, client video players need an authorized, low-latency mechanism to access the HLS stream playlist (`master.m3u8`), sub-variant playlists (`1080p/index.m3u8`, `720p/index.m3u8`, etc.), and encrypted media segments (`segment_000.ts`) through CloudFront edge caches.

**Task 3.5** delivers the **CloudFront OAC Signed URL & Signed Cookie Delivery Pipeline**:
1. **OAC-Protected CloudFront Distribution**: All streaming requests target CloudFront edge locations with AWS SigV4 OAC authorizing reads from the private S3 bucket.
2. **Dual Delivery Modes (Signed URLs vs. Signed Cookies)**:
   - **Signed Cookies**: Emits `CloudFront-Policy`, `CloudFront-Signature`, and `CloudFront-Key-Pair-Id` HTTP cookies scoped to the product's streaming prefix (`https://<cdn-domain>/hls/<productId>/*`). This allows native HTML5 video players, HLS.js, Video.js, and mobile AVPlayer/ExoPlayer to fetch all child playlists and `.ts` media segments without requiring dynamic URL rewriting of playlist files.
   - **Signed URLs**: Generates custom-policy signed URLs with wildcard resource paths or canned-policy signed URLs for direct manifest playback and standalone asset access.
3. **Entitlement-Gated Session Issuance**: Stream session requests are strictly gated by the `EntitlementService` (Admin bypass, completed order purchase, or active subscription meeting `minSubscriptionTier`).
4. **Local & Testing Fallback Engine**: Seamless development experience when AWS CloudFront key pairs are not provisioned locally; provides graceful fallback to direct presigned S3 / mock CDN URLs without breaking developer workflow or test suites.

---

## 2. Current State vs. Proposed State

### Current State
- `FfmpegTranscoderService` writes multi-bitrate HLS segments into S3 under `hls/<productId>/master.m3u8` and variant folders.
- `DrmKeyController` delivers 16-byte AES-128 keys via `/api/v1/media/drm/key/:playbackToken` upon entitlement verification.
- **Missing**: No delivery pipeline to emit CloudFront signed URLs or signed cookies for playback. Clients have no way to access the private S3 media assets through CloudFront edge caches.
- **Missing**: No environment configuration for CloudFront key pair, distribution domain, or signing policies.

### Proposed State
- **Config**: Add `CLOUDFRONT_DISTRIBUTION_DOMAIN`, `CLOUDFRONT_KEY_PAIR_ID`, `CLOUDFRONT_PRIVATE_KEY`, and `CLOUDFRONT_URL_EXPIRATION_SECONDS` to `env.schema.ts` with strict production validation and local defaults.
- **Shared Types**: Add stream session DTOs (`StreamPlaybackSessionRequestDto`, `StreamPlaybackSessionResponseDto`, `CloudFrontSignedCookiesDto`) to `@vetralink/shared-types`.
- **Signer Service (`CloudFrontSignerService`)**: Pure cryptographic signer implementing `ICloudFrontSignerService`, supporting RSA-SHA1 signing for canned policies, custom wildcard policies, signed URLs, and signed cookies, with local mock fallback.
- **Stream Delivery Service (`StreamDeliveryService`)**: Business orchestrator implementing `IStreamDeliveryService`, enforcing entitlement checks, verifying product published status, and issuing streaming sessions with signed URLs and cookies.
- **Stream Delivery Controller (`StreamDeliveryController`)**:
  - `POST /api/v1/media/stream/session`: Authenticated endpoint validating entitlement and returning signed playback stream URLs + signed cookies.
  - `GET /api/v1/media/stream/:productId/manifest`: Direct stream entrypoint setting signed cookies on the HTTP response headers and redirecting or returning the signed master playlist URL.

---

## 3. Architectural & Design Trade-Offs

### Trade-Off 1: Signed URLs vs. Signed Cookies for HLS Playback
- **Option A (Signed URLs with M3U8 Playlist Rewriting)**:
  - Backend must dynamically rewrite every line inside `.m3u8` playlists to append `?Expires=...&Signature=...&Key-Pair-Id=...` to every variant playlist and `.ts` segment URL.
  - *Cons*: Enormous CPU overhead, requires custom reverse-proxying of every playlist request, defeats CloudFront edge caching of playlist files, high latency.
- **Option B (Signed Cookies with Wildcard Resource Policy — Selected)**:
  - Generate signed cookies (`CloudFront-Policy`, `CloudFront-Signature`, `CloudFront-Key-Pair-Id`) authorized for `https://<domain>/hls/<productId>/*`.
  - Client player sets cookies once. All subsequent requests (`master.m3u8`, variant playlists, `.ts` segments) automatically pass the cookies to CloudFront.
  - *Pros*: Zero playlist rewriting, 100% CloudFront edge caching efficiency, minimal backend load, standard compliance across browsers and mobile SDKs.
  - *Verdict*: **Option B is selected**. We also provide signed URLs with custom wildcard policies for platforms (e.g. certain smart TVs or lightweight CLI tools) that prefer URL query parameters.

### Trade-Off 2: Cryptographic Implementation — Node `crypto` vs External SDK
- **Option A (Full AWS SDK `@aws-sdk/cloudfront-signer`)**:
  - Requires adding another external package dependency and dealing with specific format quirks.
- **Option B (Native Node.js `crypto` with Standard CloudFront RSA-SHA1 Formatting — Selected)**:
  - CloudFront URL/cookie signatures require RSA-SHA1 with base64 character translation (`+` -> `-`, `=` -> `_`, `/` -> `~`).
  - Node's built-in `crypto.createSign("RSA-SHA1")` is lightweight, zero-dependency, ultra-fast (<0.1ms), and natively handles RSA private keys (both PKCS#1 and PKCS#8).
  - *Verdict*: **Option B is selected** using native Node `crypto` with full support for CloudFront custom and canned policy specs, ensuring zero extraneous dependencies and maximum execution speed.

### Trade-Off 3: Local Development & CI Testing Strategy
- Requiring a real CloudFront distribution and valid RSA key pair in local development and automated CI tests would break developers' offline capability and create flaky test dependencies.
- The `CloudFrontSignerService` will detect whether CloudFront credentials are configured:
  - If configured: Performs cryptographic RSA-SHA1 signing per CloudFront specs.
  - If unconfigured (local dev / test): Emits a deterministic simulated signed URL / cookie set or falls back to direct S3/MinIO presigned URLs, emitting descriptive debug logs without failing application startup.

---

## 4. Data Models, Contracts & DTOs

### 1. Shared Types (`packages/shared-types/src/dto/media/stream.dto.ts`)
```typescript
export interface StreamPlaybackSessionRequestDto {
  productId: string;
}

export interface CloudFrontSignedCookiesDto {
  "CloudFront-Policy": string;
  "CloudFront-Signature": string;
  "CloudFront-Key-Pair-Id": string;
}

export interface StreamPlaybackSessionResponseDto {
  productId: string;
  streamUrl: string;
  drmKeyUrl: string;
  cookies?: CloudFrontSignedCookiesDto;
  expiresAt: string;
  expiresInSeconds: number;
}
```

### 2. NestJS DTOs (`apps/api/src/modules/media/dto/stream-session.dto.ts`)
```typescript
export class StreamPlaybackSessionDto implements StreamPlaybackSessionRequestDto {
  @ApiProperty({
    description: "Target product UUID for streaming playback",
    example: "11111111-1111-4111-8111-111111111111",
  })
  @IsUUID("4")
  productId!: string;
}
```

### 3. Service Interfaces

#### `ICloudFrontSignerService` (`apps/api/src/modules/media/services/cloudfront-signer.service.interface.ts`)
```typescript
export interface CloudFrontCannedPolicyOptions {
  url: string;
  expiresAt: number; // Unix timestamp in seconds
}

export interface CloudFrontCustomPolicyOptions {
  resourcePattern: string; // e.g., https://cdn.vetralink.pro/hls/123/*
  expiresAt: number;
  ipAddress?: string;
}

export interface CloudFrontSignedCookies {
  policy: string;
  signature: string;
  keyPairId: string;
}

export interface ICloudFrontSignerService {
  signUrl(url: string, expiresInSeconds?: number): string;
  signUrlCustomPolicy(resourcePattern: string, targetUrl: string, expiresInSeconds?: number): string;
  generateSignedCookies(resourcePattern: string, expiresInSeconds?: number): CloudFrontSignedCookies;
  getStreamBaseUrl(): string;
  isConfigured(): boolean;
}

export const CLOUDFRONT_SIGNER_SERVICE = Symbol("CLOUDFRONT_SIGNER_SERVICE");
```

#### `IStreamDeliveryService` (`apps/api/src/modules/media/services/stream-delivery.service.interface.ts`)
```typescript
export interface StreamSessionResult {
  productId: string;
  streamUrl: string;
  drmKeyUrl: string;
  cookies?: {
    policy: string;
    signature: string;
    keyPairId: string;
  };
  expiresAt: Date;
  expiresInSeconds: number;
}

export interface IStreamDeliveryService {
  createPlaybackSession(
    userId: string,
    userRole: string,
    productId: string
  ): Promise<StreamSessionResult>;
}

export const STREAM_DELIVERY_SERVICE = Symbol("STREAM_DELIVERY_SERVICE");
```

---

## 5. API Endpoints

### 1. `POST /api/v1/media/stream/session`
- **Authentication**: `Bearer <AccessToken>` (`JwtAuthGuard`).
- **Body**: `{ "productId": "UUID" }`.
- **Behavior**:
  - Checks if product exists, is published, and is a `VIDEO_COURSE`.
  - Enforces user entitlement via `IEntitlementService` (`SUPER_ADMIN`, `ADMIN`, completed order, or active subscription).
  - Obtains time-bound DRM playback token from `IDrmTokenService`.
  - Generates CloudFront signed cookies and custom policy signed stream URL for `https://<cdn>/hls/<productId>/master.m3u8`.
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Stream playback session provisioned successfully.",
    "data": {
      "productId": "11111111-1111-4111-8111-111111111111",
      "streamUrl": "https://cdn.vetralink.pro/hls/11111111-1111-4111-8111-111111111111/master.m3u8?Policy=...&Signature=...&Key-Pair-Id=...",
      "drmKeyUrl": "http://localhost:3001/api/v1/media/drm/key/eyJhbGciOi...",
      "cookies": {
        "CloudFront-Policy": "eyJTdGF0ZW1lbnQi...",
        "CloudFront-Signature": "w6rL4...",
        "CloudFront-Key-Pair-Id": "K2JC3XQRI3UW74"
      },
      "expiresAt": "2026-09-05T18:00:00.000Z",
      "expiresInSeconds": 3600
    },
    "timestamp": "2026-09-05T17:00:00.000Z"
  }
  ```

### 2. `GET /api/v1/media/stream/:productId/manifest`
- **Authentication**: `Bearer <AccessToken>` (`JwtAuthGuard`).
- **Behavior**:
  - Provision stream session and directly set `Set-Cookie` headers for `CloudFront-Policy`, `CloudFront-Signature`, `CloudFront-Key-Pair-Id` (HttpOnly, Secure, SameSite=None, Path=/hls/<productId>).
  - Returns `302 Found` redirecting directly to the CloudFront master playlist URL (or JSON with master URL).

---

## 6. Security & Edge Cases

1. **Private Origin Lockdown**: S3 bucket public access is blocked. Only CloudFront OAC can read S3 objects via SigV4 service principal `cloudfront.amazonaws.com`.
2. **Wildcard Scope Containment**: Signed cookies and URLs are strictly scoped to `/hls/<productId>/*` preventing cross-product streaming piracy.
3. **Time-Limited TTL**: Default expiration of 1 hour for streaming sessions (configurable via `CLOUDFRONT_URL_EXPIRATION_SECONDS`).
4. **Key Rotation Readiness**: CloudFront public key IDs are decoupled from backend logic, allowing seamless key rotation without code deployment.
5. **Cookie Security**: Emitted cookies include `Secure`, `HttpOnly`, and `SameSite=None` attributes to ensure secure transmission across origins while preventing client-side script tampering.
6. **Graceful Degradation in Dev/Test**: If no RSA key is configured, fallback URLs are issued and tests proceed without failure.
