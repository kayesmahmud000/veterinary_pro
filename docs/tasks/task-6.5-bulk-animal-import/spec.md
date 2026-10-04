# SPEC-605: Bulk CSV/Excel Animal Import via BullMQ Background Parser with Validation Error Reports

## 1. Feature Overview & Objective
Livestock SaaS farm onboarding involves migrating historical herd records containing tens, hundreds, or thousands of animals. Manually creating animals one-by-one via the interactive UI / individual REST endpoints is tedious, error-prone, and prohibitive for commercial farms.

**Objective**:
Provide a high-throughput, multi-tenant bulk import system allowing farm owners and managers to upload herd data in `.csv`, `.xlsx`, or `.xls` format. The system asynchronously validates, parses, and creates animal entities in the background using BullMQ, providing real-time job progress tracking, fault-tolerant row processing ("best-effort" import), and a downloadable or queryable error report detailing specific row failures, invalid columns, and reasons for rejection.

---

## 2. Current State vs. Proposed State

### Current State
- `POST /api/v1/animals` registers a single animal synchronously with tag uniqueness and pedigree checks.
- Animals have pedigree relations (`sireId`, `damId`), RFID uniqueness, and time-series weight logs.
- No bulk import endpoint, file upload parser, or background job runner for livestock ingestion exists.
- BullMQ is configured in `AppModule` connecting to Redis 7, with queue workers established in `media` (video transcode) and `watermark` (PDF watermarking).

### Proposed State
- **Upload Endpoint (`POST /api/v1/animals/import`)**: Accepts multipart file upload (`.csv`, `.xlsx`, `.xls`), validates file size and format, saves to a temporary staging path, creates an `AnimalImportJob` in the database, and enqueues an asynchronous processing job on BullMQ queue `ANIMAL_IMPORT_QUEUE` (`animal-import`).
- **Asynchronous Worker (`AnimalImportProcessor`)**: Consumes the job, parses rows in streaming/chunked fashion, validates each row against domain invariants and tenant herd constraints, inserts valid animals, records initial weigh-ins if provided, tracks real-time progress, and accumulates row-level validation errors into an `errorReport` JSON document.
- **Job Status Endpoint (`GET /api/v1/animals/import/jobs/:jobId`)**: Provides live progress (`totalRows`, `processedRows`, `successfulRows`, `failedRows`, `status`, `progressPercentage`) and the detailed error report.
- **Job History Endpoint (`GET /api/v1/animals/import/jobs`)**: Lists previous import jobs for the authenticated tenant farm.
- **Template Download Endpoint (`GET /api/v1/animals/import/template`)**: Returns a downloadable CSV template with pre-configured headers, descriptive comments, and example rows demonstrating expected formats for all animal attributes.

---

## 3. Architectural & Design Trade-offs

### Trade-off 1: Synchronous In-Request Import vs. Asynchronous BullMQ Background Worker
- **Option A (Synchronous)**: Parse and insert all rows inside the HTTP request cycle.
  - *Cons*: Fails on large datasets (500+ animals) due to HTTP gateway timeouts (Nginx/Cloudflare 30s-60s timeouts). Causes high memory spikes and blocks Node.js event loop during intense parsing and DB validation.
- **Option B (Asynchronous BullMQ Worker - SELECTED)**:
  - *Pros*: Immediate `202 Accepted` response. Background processing scales independently across worker instances. Supports graceful retries, progress tracking, and does not block HTTP requests.
  - *Justification*: In production AgTech ERPs, herd migrations can exceed 5,000 head. Asynchronous BullMQ processing is essential for reliability, resilience, and user experience.

### Trade-off 2: "Fail-Fast All-or-Nothing" (Atomic Transaction) vs. "Best-Effort Fault-Tolerant" with Detailed Error Reporting
- **Option A (All-or-Nothing)**: If row 499 of 500 has an invalid date of birth, rollback the entire transaction and reject all 500 rows.
  - *Cons*: Frustrating user experience. A user uploading a 1,000-cow herd has to fix minor typos one by one through multiple failed uploads.
- **Option B (Best-Effort Import with Detailed Error Report - SELECTED)**:
  - *Pros*: Valid rows are ingested immediately into the database; invalid rows are logged in an `errorReport` with row number, rejected tag, invalid column, and plain-English error message.
  - *Justification*: Farm managers can immediately start working with the 98% of animals that were valid, while downloading or viewing the error list to correct and re-upload only the rejected rows.

### Trade-off 3: Parsing Library: `xlsx` (SheetJS) vs. Separate `csv-parse` and `exceljs`
- **Option A (Separate parsers)**: Combine `csv-parse` for CSV and `exceljs` for Excel.
  - *Cons*: Multiple dependencies, differing AST output models, dual maintenance overhead.
- **Option B (`xlsx` unified parser - SELECTED)**:
  - *Pros*: Single battle-tested library that parses `.xlsx`, `.xls`, and `.csv` transparently into standard JavaScript objects (`sheet_to_json`). Unified row normalization pipeline.
  - *Justification*: Clean architecture, minimal dependency footprint, robust across legacy `.xls` and modern `.xlsx` formats.

### Trade-off 4: Pedigree Resolution Strategy (Sire / Dam Linking)
- **Problem**: When importing an entire herd, an animal may reference a `sireTag` or `damTag` that is either already in the farm DB or appears elsewhere in the same import file.
- **Solution**:
  - Two-pass lookup or intelligent lookup:
    1. During validation and ingestion, check if `sireTag` exists in the farm's active herd. If found, verify gender is `MALE` and link `sireId`.
    2. Check if `damTag` exists in the farm's active herd. If found, verify gender is `FEMALE` and link `damId`.
    3. If a parent tag is specified but not found in the herd, record a non-blocking warning / informational entry in the job error report (or allow row ingestion with parent IDs set to null so the animal is preserved).

---

## 4. Data Models & Contracts

### 4.1 Database Schema (`apps/api/prisma/schema.prisma`)

```prisma
enum ImportJobStatus {
  PENDING
  PROCESSING
  COMPLETED
  PARTIALLY_COMPLETED
  FAILED
}

model AnimalImportJob {
  id              String           @id @default(uuid()) @db.Uuid
  farmId          String           @map("farm_id") @db.Uuid
  uploadedById    String           @map("uploaded_by_id") @db.Uuid
  fileName        String           @map("file_name") @db.VarChar(255)
  fileSize        Int              @map("file_size")
  fileType        String           @map("file_type") @db.VarChar(50) // 'csv' | 'xlsx' | 'xls'
  status          ImportJobStatus  @default(PENDING)
  totalRows       Int              @default(0) @map("total_rows")
  processedRows   Int              @default(0) @map("processed_rows")
  successfulRows  Int              @default(0) @map("successful_rows")
  failedRows      Int              @default(0) @map("failed_rows")
  errorReport     Json?            @map("error_report") @db.JsonB
  filePath        String?          @map("file_path") @db.VarChar(500)
  startedAt       DateTime?        @map("started_at") @db.Timestamptz(6)
  completedAt     DateTime?        @map("completed_at") @db.Timestamptz(6)
  createdAt       DateTime         @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime         @updatedAt @map("updated_at") @db.Timestamptz(6)

  farm            Farm             @relation(fields: [farmId], references: [id], onDelete: Cascade)
  uploadedBy      User             @relation(fields: [uploadedById], references: [id], onDelete: Restrict)

  @@index([farmId, createdAt(sort: Desc)])
  @@index([farmId, status])
  @@map("animal_import_jobs")
}
```

### 4.2 Shared Types & DTOs (`packages/shared-types`)

```typescript
export enum ImportJobStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  PARTIALLY_COMPLETED = 'PARTIALLY_COMPLETED',
  FAILED = 'FAILED',
}

export interface AnimalImportRowErrorDto {
  row: number;
  tagNumber?: string;
  field?: string;
  message: string;
  rawData?: Record<string, unknown>;
}

export interface AnimalImportJobDto {
  id: string;
  farmId: string;
  uploadedById: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  status: ImportJobStatus;
  totalRows: number;
  processedRows: number;
  successfulRows: number;
  failedRows: number;
  errorReport: AnimalImportRowErrorDto[] | null;
  progressPercentage: number;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedImportJobsDto {
  items: AnimalImportJobDto[];
  meta: PaginationMeta;
}
```

### 4.3 REST API Contracts

| Method | Endpoint | Auth / Roles | Description |
|---|---|---|---|
| `POST` | `/api/v1/animals/import` | `OWNER`, `MANAGER` | Upload CSV/Excel file, creates import job, returns `202 Accepted` |
| `GET` | `/api/v1/animals/import/jobs` | `OWNER`, `MANAGER`, `HERDSMAN` | Paginated list of recent import jobs for current farm |
| `GET` | `/api/v1/animals/import/jobs/:jobId` | `OWNER`, `MANAGER`, `HERDSMAN` | Get job status, counts, and error report |
| `GET` | `/api/v1/animals/import/template` | `OWNER`, `MANAGER`, `HERDSMAN` | Download standard CSV sample import template |

---

## 5. Security & Edge Cases

1. **Tenant Isolation**:
   - The job is strictly bound to `farmId`.
   - When resolving `sireTag` and `damTag`, queries MUST filter by `farmId` to prevent cross-tenant pedigree injection.
   - Tag uniqueness and RFID uniqueness checks are evaluated strictly within the tenant's farm.
2. **File Size & Content Sanitization**:
   - Maximum upload file size capped at 10 MB (supports ~50,000 rows).
   - Allowed MIME types / extensions: `text/csv`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `application/vnd.ms-excel`, `.csv`, `.xlsx`, `.xls`.
3. **CSV Formula Injection Mitigation**:
   - Sanitize string inputs starting with `=`, `+`, `-`, `@` if they could be interpreted by spreadsheet viewers upon subsequent export.
4. **Duplicate Tags within Single Upload**:
   - The parser maintains an in-memory `Set<string>` of seen tags and RFIDs during batch execution to catch duplicates occurring within the same import file before reaching DB constraint violations.
5. **Worker Crashes & Unhandled Exceptions**:
   - Wrapped in try/catch. If the parser crashes or encounters corrupt binary data, the job status transitions to `FAILED`, with the error stack/message recorded in `errorReport`.
6. **Audit Trail**:
   - When the worker finishes, records an audit log entry `ANIMAL_BULK_IMPORTED` containing total processed, succeeded, and failed counts.
