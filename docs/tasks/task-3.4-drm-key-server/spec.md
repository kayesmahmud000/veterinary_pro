# SPEC-304: AES-128 / DRM Key Server Endpoint with Time-Bound JWT Verification
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 3: Digital Product Catalog & Media Asset Pipeline
# Task 3.4: AES-128 / DRM key server endpoint with time-bound JWT verification
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Feature Overview & Objective

In digital veterinary education and LMS asset distribution (`ProductType.VIDEO_COURSE`), intellectual property protection is paramount. Standard plain-text HLS video streaming distributes cleartext `.ts` media segments that can be downloaded, captured, and redistributed by automated scrapers or network sniffers without restriction.

**Task 3.4** introduces a secure **AES-128 HLS DRM Key Server & Ephemeral Verification Pipeline**:
1. **AES-128 HLS Encryption**: Video segments are encrypted using AES-128 in Cipher Block Chaining (CBC) mode with PKCS#7 padding. The `.m3u8` playlists instruct compliant video players (Video.js, HLS.js, Apple AVPlayer, Android ExoPlayer / BetterPlayer) to fetch decryption keys via `#EXT-X-KEY:METHOD=AES-128,URI="<KEY_URL>",IV=0x...`.
2. **Ephemeral DRM Playback Token**: An authenticated user requesting to stream video must first obtain a cryptographically signed, short-lived (10-minute TTL) playback token.
3. **Entitlement Rule Engine**: Access is granted strictly if:
   - The user has an administrative role (`SUPER_ADMIN` or `ADMIN`), OR
   - The user has completed purchase of the product (`Order.status === COMPLETED` with matching `OrderItem.productId`), OR
   - The user holds an `ACTIVE` or `TRIALING` subscription with a tier satisfying or exceeding the product's `minSubscriptionTier`.
4. **Hardened Key Server Endpoint**: Emits the raw 16-byte binary key (`application/octet-stream`) with strict `Cache-Control: private, no-cache, no-store, must-revalidate` headers, rejecting expired, forged, or unauthorized requests with standard RFC-7807 problem details.

---

## 2. Current State vs. Proposed State

### Current State
- `FfmpegTranscoderService` (Task 3.3) generates multi-bitrate HLS playlists (`master.m3u8`, variant playlists `1080p/index.m3u8`, etc., and `.ts` segments) uploaded to S3 under `hls/<productId>/`.
- The segments are currently unencrypted.
- There are no endpoints to generate playback tokens or serve AES-128 decryption keys.
- Client players have no secure mechanism to stream protected content.

### Proposed State
- **Deterministic Key Derivation**: `DrmKeyService` generates 16-byte AES-128 keys deterministically from a master secret (`HLS_DRM_KEY_SECRET`) and `productId` using HKDF-SHA256 (RFC 5869).
- **Time-Bound Playback Token Service**: `DrmTokenService` signs and validates ephemeral JWT tokens (`sub: userId`, `pid: productId`, `jti`, `exp`).
- **Decoupled Entitlement Engine**: `EntitlementService` verifies user purchases and subscription tiers against Prisma models.
- **REST Endpoints**:
  - `POST /api/v1/media/drm/playback-token`: Validates user entitlement and issues a signed playback token with key URL.
  - `GET /api/v1/media/drm/key/:playbackToken` (and `GET /api/v1/media/key/:playbackToken`): Authenticates token and returns 16-byte raw decryption key.
  - `GET /api/v1/media/drm/key?token=...`: Query parameter variant for flexible HLS player compatibility.
- **Transcoder Integration**: `FfmpegTranscoderService` supports an optional encryption pass accepting an HLS key info file during segment packaging.

---

## 3. Architectural & Design Trade-Offs

### Trade-Off 1: Key Storage vs. Deterministic Derivation (HKDF-SHA256)
- **Option A (Database Storage / Key Vault)**: Generate random 16-byte keys and persist them in a `video_keys` table encrypted with AES-256-GCM.
  - *Cons*: Database read latency on every key retrieval, additional migration and schema complexity, potential for data loss or desync during backup/restore.
- **Option B (HKDF-SHA256 Deterministic Key Derivation — Selected)**:
  - `key = HKDF-SHA256(masterKey, salt=productId, info="vetralink-hls-aes128", length=16)`.
  - *Pros*: O(1) CPU derivation (< 0.05ms), stateless, zero database storage overhead, eliminates key-loss scenarios, cryptographically proven (RFC 5869), supports key rotation via versioned info parameters (`info="vetralink-hls-aes128:v1"`).
  - *Verdict*: **Option B is selected** for exceptional throughput, resilience, and zero operational overhead.

### Trade-Off 2: Token Transport Format
- **Option A (Header-Only Authentication)**: Require `Authorization: Bearer <token>` on key requests.
  - *Cons*: Incompatible with native Apple AVPlayer (iOS / Safari / macOS) and native ExoPlayer without custom native HTTP interceptors, breaking playback on mobile Safari.
- **Option B (Path / Query Parameter Token — Selected)**:
  - Support `/api/v1/media/drm/key/:playbackToken` and `/api/v1/media/drm/key?token=<token>`.
  - *Pros*: 100% compatible with standard HLS specification, native iOS AVPlayer, Video.js, and HLS.js.
  - *Verdict*: **Option B is selected**.

### Trade-Off 3: Entitlement Check Latency
- Entitlement checks verify: (1) Role is Admin, (2) User purchased product via completed order, OR (3) User has active subscription >= required tier.
- This verification occurs during **Playback Token Issuance** (`POST /api/v1/media/drm/playback-token`).
- Because the token is short-lived (10-minute TTL), the Key Server endpoint verifies the cryptographic signature of the token in O(1) time without querying the database for every single key request, preventing denial-of-service under high player concurrency.

---

## 4. Data Models, Contracts & DTOs

### 1. Shared Contracts (`packages/shared-types/src/dto/media/drm.dto.ts`)
```typescript
export interface DrmPlaybackTokenRequestDto {
  productId: string;
}

export interface DrmPlaybackTokenResponseDto {
  playbackToken: string;
  keyUrl: string;
  expiresAt: string;
  expiresInSeconds: number;
}

export interface DrmTokenPayload {
  sub: string;       // User ID
  pid: string;       // Product ID
  role: string;      // User Role
  jti: string;       // Unique token ID
  iat: number;
  exp: number;
}
```

### 2. NestJS DTOs (`apps/api/src/modules/media/dto/drm-playback-token.dto.ts`)
```typescript
export class DrmPlaybackTokenDto implements DrmPlaybackTokenRequestDto {
  @ApiProperty({ description: "Target product UUID for playback", example: "11111111-1111-4111-8111-111111111111" })
  @IsUUID("4")
  productId!: string;
}
```

### 3. Service Interfaces

#### `IDrmKeyService` (`apps/api/src/modules/media/services/drm-key.service.interface.ts`)
```typescript
export const DRM_KEY_SERVICE = Symbol("DRM_KEY_SERVICE");

export interface IDrmKeyService {
  deriveKey(productId: string): Buffer; // 16 bytes
  generateKeyInfoFile(productId: string, keyUrl: string, outputDir: string): Promise<string>;
}
```

#### `IDrmTokenService` (`apps/api/src/modules/media/services/drm-token.service.interface.ts`)
```typescript
export const DRM_TOKEN_SERVICE = Symbol("DRM_TOKEN_SERVICE");

export interface IDrmTokenService {
  generatePlaybackToken(userId: string, productId: string, role: string): Promise<{ token: string; expiresAt: Date; expiresInSeconds: number }>;
  verifyPlaybackToken(token: string): Promise<DrmTokenPayload>;
}
```

#### `IEntitlementService` (`apps/api/src/modules/media/services/entitlement.service.interface.ts`)
```typescript
export const ENTITLEMENT_SERVICE = Symbol("ENTITLEMENT_SERVICE");

export interface IEntitlementService {
  checkEntitlement(userId: string, userRole: string, productId: string): Promise<boolean>;
}
```

---

## 5. API Endpoints

### 1. `POST /api/v1/media/drm/playback-token`
- **Auth**: `Bearer <AccessToken>` (via `JwtAuthGuard`).
- **Body**: `{ productId: string }`.
- **Response**: `200 OK`
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "DRM playback token generated successfully.",
    "data": {
      "playbackToken": "eyJhbGciOi...",
      "keyUrl": "http://localhost:3001/api/v1/media/drm/key/eyJhbGciOi...",
      "expiresAt": "2026-09-05T17:30:00.000Z",
      "expiresInSeconds": 600
    },
    "timestamp": "2026-09-05T17:20:00.000Z"
  }
  ```
- **Error Codes**:
  - `401 Unauthorized`: Invalid/missing access token.
  - `403 Forbidden`: User has not purchased product and lacks sufficient subscription tier.
  - `404 Not Found`: Product does not exist or is unpublished.

### 2. `GET /api/v1/media/drm/key/:playbackToken`
- **Auth**: Ephemeral playback token in route parameter (also supports query `?token=...` and alias `/api/v1/media/key/:playbackToken`).
- **Response**: `200 OK`
  - **Headers**:
    - `Content-Type: application/octet-stream`
    - `Content-Length: 16`
    - `Cache-Control: private, no-cache, no-store, must-revalidate`
    - `Pragma: no-cache`
    - `Expires: 0`
  - **Body**: Raw 16-byte binary buffer.
- **Error Codes**:
  - `401 Unauthorized`: Expired, malformed, or invalid token signature.

---

## 6. Security & Edge Cases
1. **Token Forgery**: Tokens signed with `JWT_ACCESS_SECRET` / `HLS_DRM_KEY_SECRET` using HMAC-SHA256. Forgery attempts immediately fail with 401.
2. **Replay & Expiration**: 10-minute token TTL (`exp`). Expired tokens rejected.
3. **No-Cache Guarantee**: Decryption keys are strictly marked `no-store` to prevent caching by intermediate CDNs or shared player proxies.
4. **Subscription Tier Hierarchy**: STARTER < PRO < ENTERPRISE. A PRO user can access STARTER and PRO content; ENTERPRISE accesses all tiers.
5. **Admin Bypass**: `SUPER_ADMIN` and `ADMIN` retain universal preview and diagnostic rights across all media catalog assets.
