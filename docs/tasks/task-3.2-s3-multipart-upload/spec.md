# SPEC-302: Presigned S3 Direct Multipart Upload for Heavy Video Masters and Digital Assets

## 1. Feature Overview & Objective
Task 3.2 establishes the scalable media ingestion pipeline for **Phase 2: LMS & Digital Store**.
Video courses in VETRALINK PRO consist of multi-gigabyte 1080p/4K master footage, while clinical manuals and spreadsheets consist of heavy PDF and XLSX files.

Streaming multi-gigabyte uploads through the NestJS API gateway is an anti-pattern:
- Causes high CPU and RAM consumption buffering binary streams.
- Exhausts server sockets and leads to HTTP gateway timeouts.
- Prevents parallel chunk transmission and client-side resume on rural network drops.

**Objective**:
Implement a high-throughput, secure **Direct-to-S3 Presigned Multipart Upload Pipeline**:
1. **Direct Ingestion**: Client requests upload permission from API -> API returns presigned S3 URLs -> Client uploads chunks directly to Amazon S3 (or local MinIO) without passing binary payload through NestJS.
2. **Multipart Chunking**: Large video files (> 100MB up to 10GB) are split into 5MB–50MB chunks, uploaded in parallel, and assembled on S3.
3. **Resilience & Abort Safety**: Support chunk retry and explicit abort (`AbortMultipartUpload`) to prevent abandoned orphan chunks from incurring storage costs.
4. **Direct Single-Part Presigned URLs**: Lightweight assets (PDF ebooks, spreadsheets, video thumbnails < 100MB) use single-request presigned PUT URLs.
5. **Security & Authorization**: Restricted to verified content creators (`SUPER_ADMIN`, `ADMIN`, `VET`). S3 object keys are deterministically partitioned by asset category and entity UUID.

---

## 2. Current State vs. Proposed State

### Current State
- `env.schema.ts` includes `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_MEDIA`, and `S3_BUCKET_DELIVERIES`.
- `infrastructure/docker-compose.yml` has MinIO running on port 9000 with API keys.
- `@vetralink/api` has no S3 client or media ingestion module.
- Product creation in Task 3.1 accepts `contentS3Key`, but expects the asset to already be uploaded or referenced in S3.

### Proposed State
- Enhance `env.schema.ts` & `env.service.ts` with `S3_ENDPOINT` and `S3_FORCE_PATH_STYLE` to seamlessly toggle between local MinIO and production AWS S3.
- Install `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` in `apps/api`.
- Create shared contracts in `@vetralink/shared-types`:
  - `InitiateMultipartUploadRequestDto`, `InitiateMultipartUploadResponseDto`.
  - `GetPresignedPartUrlRequestDto`, `GetPresignedPartUrlResponseDto`.
  - `CompleteMultipartUploadRequestDto`, `CompleteMultipartUploadResponseDto`.
  - `AbortMultipartUploadRequestDto`.
  - `DirectUploadRequestDto`, `DirectUploadResponseDto`.
- Create `apps/api/src/modules/media/`:
  - `services/s3-storage.service.interface.ts` (`IS3StorageService`, `S3_STORAGE_SERVICE`).
  - `services/s3-storage.service.ts`: Low-level wrapper executing AWS S3 SDK commands (`CreateMultipartUploadCommand`, `UploadPartCommand`, `CompleteMultipartUploadCommand`, `AbortMultipartUploadCommand`, `PutObjectCommand`, `getSignedUrl`).
  - `services/media-upload.service.interface.ts` (`IMediaUploadService`, `MEDIA_UPLOAD_SERVICE`).
  - `services/media-upload.service.ts`: Business logic verifying MIME types, max sizes, generating structured S3 keys (`raw-videos/...`, `ebooks/...`, `tools/...`, `thumbnails/...`).
  - `dto/`: Input validation DTOs with `class-validator` and `@ApiProperty`.
  - `media-upload.controller.ts`: Endpoints mounted at `/api/v1/media/uploads` guarded by `JwtAuthGuard` and `RolesGuard` (`SUPER_ADMIN`, `ADMIN`, `VET`).
  - `media.module.ts`: NestJS module wiring.
  - Comprehensive unit and integration test suite.

---

## 3. Architectural & Design Trade-offs

| Decision | Option A | Option B (Selected) | Technical Justification |
| :--- | :--- | :--- | :--- |
| **Upload Topology** | Proxied Upload through NestJS (`multipart/form-data` with Multer) | Presigned Direct-to-S3 Upload | Eliminates Node.js event-loop blocking, memory spikes, and proxy timeout limits when uploading 5GB+ video files. S3 handles raw bandwidth. |
| **Part URL Generation** | Generate all presigned part URLs upfront in initiation response | On-demand part URL generation (`POST /multipart/part-url`) | Pre-generating 500 URLs upfront bloats response payload and risks early URL expiration on slow rural connections (e.g. Part 400 expiring before upload starts). On-demand generation lets client request valid URLs just-in-time. |
| **Storage Abstraction** | Hardcode AWS S3 SDK calls inside controllers | Dual-layer abstraction (`S3StorageService` interface + `MediaUploadService`) | Decouples AWS SDK specifics from application business rules, enabling effortless mocking in unit tests and local MinIO development via configuration. |
| **Object Key Partitioning** | Random flat UUID keys (`uploads/${uuid}`) | Structured hierarchical keys (`raw-videos/${productId}/${timestamp}-${uuid}.${ext}`) | Allows lifecycle rules (e.g. S3 expiration on incomplete raw files, transition to Glacier), facilitates S3 event routing to BullMQ, and simplifies bucket inspection. |

---

## 4. Data Models & API Contracts

### Endpoints
```http
POST /api/v1/media/uploads/multipart/initiate
Headers: Authorization: Bearer <VetOrAdminToken>
Body:
{
  "filename": "mastitis-master-lecture.mp4",
  "contentType": "video/mp4",
  "fileSizeBytes": 2147483648,
  "category": "VIDEO_COURSE",
  "productId": "11111111-1111-1111-1111-111111111111"
}
Response (201 Created):
{
  "success": true,
  "statusCode": 201,
  "message": "Multipart upload initiated successfully",
  "data": {
    "uploadId": "s3-upload-id-string",
    "key": "raw-videos/11111111-1111-1111-1111-111111111111/1725540000-uuid.mp4",
    "bucket": "vetralink-media-dev",
    "partSizeBytes": 10485760,
    "totalParts": 205
  }
}
```

```http
POST /api/v1/media/uploads/multipart/part-url
Headers: Authorization: Bearer <VetOrAdminToken>
Body:
{
  "uploadId": "s3-upload-id-string",
  "key": "raw-videos/.../master.mp4",
  "partNumber": 1
}
Response (200 OK):
{
  "success": true,
  "statusCode": 200,
  "message": "Presigned part URL generated",
  "data": {
    "url": "https://vetralink-media-dev.s3.amazonaws.com/raw-videos/...?partNumber=1&uploadId=...&X-Amz-Signature=...",
    "partNumber": 1,
    "expiresInSeconds": 3600
  }
}
```

```http
POST /api/v1/media/uploads/multipart/complete
Headers: Authorization: Bearer <VetOrAdminToken>
Body:
{
  "uploadId": "s3-upload-id-string",
  "key": "raw-videos/.../master.mp4",
  "parts": [
    { "partNumber": 1, "etag": "\"etag-hash-1\"" },
    { "partNumber": 2, "etag": "\"etag-hash-2\"" }
  ]
}
Response (200 OK):
{
  "success": true,
  "statusCode": 200,
  "message": "Multipart upload completed successfully",
  "data": {
    "location": "https://vetralink-media-dev.s3.amazonaws.com/raw-videos/.../master.mp4",
    "bucket": "vetralink-media-dev",
    "key": "raw-videos/.../master.mp4",
    "etag": "\"combined-etag\""
  }
}
```

```http
POST /api/v1/media/uploads/multipart/abort
Headers: Authorization: Bearer <VetOrAdminToken>
Body:
{
  "uploadId": "s3-upload-id-string",
  "key": "raw-videos/.../master.mp4"
}
Response (200 OK):
{
  "success": true,
  "statusCode": 200,
  "message": "Multipart upload aborted successfully",
  "data": null
}
```

```http
POST /api/v1/media/uploads/presigned-url
Headers: Authorization: Bearer <VetOrAdminToken>
Body:
{
  "filename": "dairy-husbandry-manual.pdf",
  "contentType": "application/pdf",
  "fileSizeBytes": 15728640,
  "category": "EBOOK"
}
Response (200 OK):
{
  "success": true,
  "statusCode": 200,
  "message": "Direct upload URL generated successfully",
  "data": {
    "uploadUrl": "https://vetralink-media-dev.s3.amazonaws.com/ebooks/...?X-Amz-Signature=...",
    "key": "ebooks/1725540000-uuid.pdf",
    "bucket": "vetralink-media-dev",
    "expiresInSeconds": 900
  }
}
```

---

## 5. Security & Edge Cases
1. **Content-Type Whitelisting**:
   - Strict verification against permitted MIME types (`video/mp4`, `video/quicktime`, `application/pdf`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `image/jpeg`, `image/png`, `image/webp`).
   - Mismatched or suspicious file extensions (e.g. `.exe`, `.sh`, `.php`) rejected with `ValidationDomainException`.
2. **File Size Bounds**:
   - Videos: Minimum 5MB, Maximum 10GB.
   - Documents/Spreadsheets: Maximum 100MB.
   - Thumbnails/Images: Maximum 10MB.
3. **Role Authorization**:
   - Only `SUPER_ADMIN`, `ADMIN`, and `VET` can generate upload signatures.
4. **Part Number Integrity**:
   - S3 requires part numbers between 1 and 10,000. Each part (except the last) must be at least 5MB.
5. **Abort & Cleanup**:
   - When upload fails on client side, client calls abort to avoid accumulating incomplete multipart upload billing on S3.
