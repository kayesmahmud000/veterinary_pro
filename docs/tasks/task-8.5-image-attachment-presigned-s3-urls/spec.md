# SPEC-805: Image Attachment Upload for Visible Lesions/Symptoms via Presigned S3 URLs

## 1. Feature Overview & Objective
In veterinary and livestock herd management, visual evidence of clinical symptoms (e.g., skin lesions, foot rot, mastitic swelling, mucosal discharge, wounds, surgical sites) is critical for:
1. Accurate diagnostic evaluation and peer tele-consultation with external veterinary specialists.
2. Tracking lesion progression or recovery over consecutive days following medical intervention.
3. Maintaining defensible diagnostic evidence and compliance records for herd health audits.

Directly streaming multipart image uploads through the NestJS application server introduces significant memory overhead, socket saturation, and potential Denial of Service (DoS) vectors under poor farm network conditions.

The objective of Task 8.5 is to implement a secure, scalable **Direct-to-S3 Presigned URL Architecture**:
1. **Presigned PUT URL Generation**: The client requests an upload authorization for a health incident. The server validates MIME types, size constraints, and tenant permissions, creates a pending attachment record, and returns a time-limited (15-minute) presigned S3 PUT URL.
2. **Direct Browser/Mobile to S3 Upload**: Clients upload high-resolution diagnostic images directly to the S3 bucket, bypassing backend memory and compute bottlenecks.
3. **Upload Confirmation & Validation**: Upon completion, the client triggers a confirmation endpoint that marks the attachment as confirmed and records timestamps.
4. **Presigned GET Delivery**: Viewing endpoints supply ephemeral presigned GET URLs (valid for 60 minutes) to render secure, private images in web and mobile clients without making the S3 bucket public.
5. **Attachment Management & Cleanup**: Support querying all attachments for an incident and deleting attachments with both DB record removal and S3 object purge.

---

## 2. Current State vs. Proposed State

### Current State
- `HealthRecord` exists in the database and API with `symptoms`, `diagnosis`, `treatment`, `cost`, `severity`, and `escalationLevel`.
- There is no mechanism to attach visual imagery, photographic evidence of lesions, or diagnostic lab photos.
- `IS3StorageService` and `S3StorageService` exist in `apps/api/src/modules/media/services/` with support for presigned PUT/GET URLs and multipart uploads, used by video and order delivery services.

### Proposed State
- A dedicated `HealthRecordAttachment` database entity and table `health_record_attachments` with tenant isolation (`farmId`), relation to `HealthRecord` (cascade on incident delete), uploader tracking (`uploadedById`), file metadata (`fileName`, `mimeType`, `fileSizeBytes`, `s3Key`), status lifecycle (`PENDING_UPLOAD`, `CONFIRMED`), and optional clinical notes (`caption`).
- Shared DTOs and contracts in `@vetralink/shared-types` defining upload requests, presigned responses, attachment confirmations, and attachment summaries.
- Data access repository `IHealthRecordAttachmentRepository` with tenant scoping and status filtering.
- Domain service `IHealthAttachmentService` orchestrating URL signing, file sanitization, status transitions, and S3 cleanup.
- REST API endpoints on `ClinicalHealthController` under `/clinical-health/incidents/:id/attachments` protected by `JwtAuthGuard`, `TenantGuard`, and `FarmRoles`.

---

## 3. Architectural & Design Trade-offs

### Trade-off 1: Direct Server Multipart Upload vs. Direct S3 Presigned URL
- **Option A (Proxy upload through NestJS server with Multer/Busboy)**:
  - *Cons*: Server CPU and memory consumption spikes; upload timeouts on slow rural 3G/4G connections; risk of server socket exhaustion.
- **Option B (Direct S3 Presigned PUT URL - SELECTED)**:
  - *Pros*: Zero server bandwidth/RAM cost for media payloads; AWS S3 handles connection persistence, byte transfers, and SSL offloading; highly scalable.
  - *Justification*: Standard cloud architecture for production SaaS handling visual media; aligned with ARCHITECTURE.md and existing media module.

### Trade-off 2: Two-Step Upload Lifecycle (`PENDING_UPLOAD` -> `CONFIRMED`) vs. Single Optimistic Record
- **Option A (Create DB record only after client claims upload succeeded)**:
  - *Cons*: Backend cannot pre-reserve key or enforce strict attachment IDs; unvalidated client metadata.
- **Option B (Two-step reservation with `PENDING_UPLOAD` status - SELECTED)**:
  - *Pros*: Provides pre-allocated UUID and strictly controlled namespaced S3 key; prevents orphaned key collision; queries can easily filter out abandoned/unconfirmed uploads.
  - *Justification*: Enterprise consistency and data integrity.

### Trade-off 3: S3 Bucket Selection
- **Option A (Separate new bucket `S3_BUCKET_HEALTH_ATTACHMENTS`)**:
  - *Cons*: Additional infrastructure provisioning overhead in development/staging.
- **Option B (Use existing `S3_BUCKET_MEDIA` configured in `EnvService` with dedicated folder prefix - SELECTED)**:
  - *Pros*: Utilizes existing validated environment variables and S3 credentials; clean path isolation (`farms/{farmId}/health-records/{healthRecordId}/attachments/...`).
  - *Justification*: Simplifies configuration while strictly isolating tenant objects via prefix namespaces.

---

## 4. Data Models & Contracts

### 4.1 Prisma Schema

```prisma
enum HealthAttachmentStatus {
  PENDING_UPLOAD
  CONFIRMED
}

model HealthRecordAttachment {
  id             String                 @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  farmId         String                 @map("farm_id") @db.Uuid
  healthRecordId String                 @map("health_record_id") @db.Uuid
  uploadedById   String                 @map("uploaded_by_id") @db.Uuid
  fileName       String                 @map("file_name") @db.VarChar(255)
  fileSizeBytes  Int                    @map("file_size_bytes")
  mimeType       String                 @map("mime_type") @db.VarChar(100)
  s3Key          String                 @map("s3_key") @db.Text
  status         HealthAttachmentStatus @default(PENDING_UPLOAD)
  caption        String?                @db.Text
  confirmedAt    DateTime?              @map("confirmed_at") @db.Timestamptz(6)
  createdAt      DateTime               @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime               @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  farm         Farm         @relation(fields: [farmId], references: [id], onDelete: Restrict)
  healthRecord HealthRecord @relation(fields: [healthRecordId], references: [id], onDelete: Cascade)
  uploadedBy   User         @relation(fields: [uploadedById], references: [id], onDelete: Restrict)

  @@index([farmId, healthRecordId])
  @@index([farmId, status])
  @@index([healthRecordId, createdAt])
  @@map("health_record_attachments")
}
```

### 4.2 Shared DTOs (`packages/shared-types`)
- `RequestAttachmentPresignedUrlDto`: `{ fileName: string, mimeType: string, fileSizeBytes: number, caption?: string }`
- `PresignedAttachmentUploadResponseDto`: `{ attachmentId: string, uploadUrl: string, s3Key: string, expiresInSeconds: number }`
- `ConfirmAttachmentUploadDto`: `{ caption?: string }`
- `HealthRecordAttachmentResponseDto`: `{ id: string, farmId: string, healthRecordId: string, uploadedById: string, fileName: string, fileSizeBytes: number, mimeType: string, s3Key: string, status: HealthAttachmentStatus, caption: string | null, viewUrl?: string, confirmedAt: string | null, createdAt: string, updatedAt: string }`

---

## 5. Security, Validation & Edge Cases

1. **Allowed MIME Types**: Strict whitelist: `image/jpeg`, `image/png`, `image/webp`. Rejects executable formats, SVGs, or arbitrary binaries.
2. **File Size Limit**: Maximum 15 MB (`15,728,640` bytes). Rejects zero-byte or oversized payload declarations.
3. **Key Sanitization**: Strips dangerous characters (`../`, `\`, null bytes, control characters), lowercases extension, prefixes with UUID to prevent overwriting:
   `farms/${farmId}/health-records/${healthRecordId}/attachments/${attachmentId}-${sanitizedBaseName}.${ext}`
4. **Tenant Isolation**: All operations (`GET`, `POST`, `DELETE`) scope by `farmId` and verify that the target `healthRecordId` belongs to the tenant before signing URLs or mutating database records.
5. **Non-Existent or Resolved Incidents**: Allows uploading attachments to open and resolved incidents (for post-treatment documentation), but rejects uploads if the incident does not exist or belongs to another farm.
6. **Graceful S3 Deletion**: When an attachment is deleted, database deletion succeeds even if S3 file deletion fails or S3 is in local mock mode (with logged warnings).
