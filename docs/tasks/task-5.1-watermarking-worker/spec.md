# SPEC-501: BullMQ Dynamic Watermarking Worker Engine (pdf-lib)
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 5: Dynamic Anti-Piracy Watermarking & Fulfillment
# Task 5.1: BullMQ dynamic watermarking worker using pdf-lib / Gotenberg engine
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Feature Overview & Objective

### The Problem
Veterinary eBooks, clinical guides, Excel spreadsheets, and digital prescriptions distributed through the VETRALINK PRO platform represent high-value intellectual property. 
1. **Piracy & Unauthorized Redistribution**: Unprotected PDF downloads can be shared indiscriminately across public forums, competitor farms, and messaging channels without traceability.
2. **Synchronous Fulfillment Bottlenecks**: Heavy PDF rasterization and vector manipulation (parsing hundreds of pages, embedding fonts, computing layout, rendering cryptographic verification stamps) cannot be performed synchronously in the HTTP request/response cycle or payment webhook receiver without introducing latency, gateway timeouts (e.g. 30-second Stripe webhook timeout), or thread pool exhaustion.
3. **Storage & Delivery Disconnect**: The platform requires a decoupled background processing architecture that automatically picks up completed digital orders, downloads the authoritative master PDF from the private S3 storage vault, applies tamper-evident dynamic buyer watermarking, and stores the personalized artifact into the secure deliveries bucket for download token consumption.

### The Objective
Implement a distributed, asynchronous **Dynamic PDF Watermarking Worker Engine** leveraging **BullMQ** and **`pdf-lib`**:
1. **Dedicated Watermark Queue (`WATERMARK_QUEUE`)**: Register a dedicated BullMQ queue (`watermark`) with exponential backoff, retry management (3 attempts), and concurrency governance.
2. **Dynamic Watermarking Engine Service (`PdfWatermarkService`)**: Build a high-performance in-process PDF manipulation service using `pdf-lib` that can load arbitrary PDF documents, inspect page dimensions, inject customizable anti-piracy overlays, and export the secured PDF buffer.
3. **BullMQ Worker Host (`WatermarkProcessor`)**: Construct a robust NestJS BullMQ processor that consumes watermark jobs, fetches buyer and product metadata, pulls the source master PDF from S3 via `IS3StorageService`, coordinates watermark application, uploads the secured artifact to `s3://vetralink-deliveries/watermarked/<order-id>/<order-item-id>.pdf`, and publishes job progress updates.
4. **Queue Dispatcher Service (`WatermarkQueueService`)**: Expose a clean port (`IWatermarkQueueService`) enabling `OrderFulfillmentService` (or any downstream service) to dispatch watermarking jobs safely and idempotently.
5. **Decoupled Architecture & Shared Types**: Define strict TypeScript contracts (`WatermarkJobData`, `WatermarkJobResult`, `WatermarkStatus`) in `@vetralink/shared-types`.

---

## 2. Current State vs. Proposed State

| Capability | Current Codebase State | Proposed State (Post Task 5.1) |
| :--- | :--- | :--- |
| **PDF Watermarking Engine** | None. No PDF manipulation libraries installed. | In-process `pdf-lib` engine encapsulated behind `IPdfWatermarkService`, supporting page inspection, text overlay, and stream export. |
| **Watermark Job Queue** | Only `VIDEO_TRANSCODE_QUEUE` exists in `MediaModule`. | Dedicated `WATERMARK_QUEUE` configured with Redis backoff, retries, and failure event tracking. |
| **Worker Host** | Only `VideoTranscodeProcessor` exists in `MediaModule`. | `WatermarkProcessor` extending `@nestjs/bullmq` `WorkerHost` processing jobs asynchronously with S3 download/upload cycle. |
| **Queue Dispatch Port** | None for watermarking. | `IWatermarkQueueService` with `dispatchWatermarkJob(data: WatermarkJobData): Promise<string>` for seamless integration. |
| **Temporary Scratch Management** | Ad-hoc in video transcoder. | Formalized temporary scratch lifecycle with guaranteed `finally` cleanup in `os.tmpdir()` to prevent storage exhaustion. |
| **Contract Types** | Only checkout & download token DTOs in `@vetralink/shared-types`. | Universal `WatermarkJobData`, `WatermarkJobResult`, and status types added to `@vetralink/shared-types`. |

---

## 3. Architectural & Design Trade-offs

### Trade-off 1: In-Process `pdf-lib` vs. External Gotenberg Microservice Container
- **Option A: Gotenberg HTTP Container (Docker + Chromium / LibreOffice)**
  - *Pros*: Capable of rendering arbitrary HTML/CSS to PDF; handles complex office document conversions.
  - *Cons*: High memory footprint (1–2 GB RAM per instance), external network hop over HTTP, complex orchestration dependency, and slower start/stop times. Overkill for modifying existing PDF pages.
- **Option B (Selected): In-Process `pdf-lib` Engine**
  - *Pros*: Pure TypeScript/JavaScript implementation running natively in Node.js. Zero C++ native dependencies, zero external container requirements, sub-50ms execution per page, small memory footprint (~20-50MB per job), and rock-solid cross-platform support (Windows, Linux, macOS, Alpine).
  - *Cons*: Does not convert raw HTML to PDF (not required here, as master assets are already uploaded as authoritative PDFs).
  - *Rationale*: For watermarking existing eBook and guide PDFs, `pdf-lib` is vastly superior in performance, resource efficiency, and deployment simplicity.

### Trade-off 2: Storage S3 Key Conventions & Re-generation Idempotency
- **Master Asset Key**: `private-vetralink-media/products/<product-id>/<source-filename>.pdf`
- **Secured Delivery Key**: `watermarked/<order-id>/<order-item-id>.pdf` in `S3_BUCKET_DELIVERIES`
- *Rationale*: Using `<order-id>/<order-item-id>.pdf` guarantees deterministic addressing. If a duplicate job is processed or if a customer requests multiple downloads, the system can check for the existence of the rendered file, ensuring idempotent execution without unnecessary re-watermarking.

### Trade-off 3: Processing Concurrency & Memory Budget
- PDF manipulation loads file buffers into memory. To prevent Node.js heap exhaustion on multi-page eBooks (e.g. 100+ pages):
  - Concurrency is bounded to `concurrency: 5` workers on Redis.
  - Files are streamed to temporary scratch paths on disk when exceeding buffer limits.
  - Unconditional `finally` block guarantees removal of all scratch files.

---

## 4. Data Models, Contracts & DTOs

### 1. Job Contracts (`packages/shared-types/src/dto/watermark/watermark-job.dto.ts`)
```typescript
export interface WatermarkJobData {
  readonly orderId: string;
  readonly orderItemId: string;
  readonly productId: string;
  readonly userId: string;
  readonly downloadToken: string;
  readonly sourceBucket?: string;
  readonly sourceS3Key: string;
  readonly destinationBucket?: string;
  readonly destinationS3Key: string;
  readonly buyerName: string;
  readonly buyerEmail: string;
  readonly purchaseDate: string;
}

export interface WatermarkJobResult {
  readonly orderId: string;
  readonly orderItemId: string;
  readonly destinationS3Key: string;
  readonly pageCount: number;
  readonly fileSizeBytes: number;
  readonly executionTimeMs: number;
  readonly completedAt: string;
}

export enum WatermarkJobStatus {
  QUEUED = "QUEUED",
  PROCESSING = "PROCESSING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}
```

### 2. Service Interfaces (`apps/api/src/modules/watermark/services/`)

#### `pdf-watermark.service.interface.ts`
```typescript
export interface WatermarkOptions {
  readonly buyerName: string;
  readonly buyerEmail: string;
  readonly orderId: string;
  readonly purchaseDate: string;
  readonly customNotice?: string;
}

export interface WatermarkResult {
  readonly pdfBuffer: Buffer;
  readonly pageCount: number;
  readonly executionTimeMs: number;
}

export interface IPdfWatermarkService {
  /**
   * Applies dynamic anti-piracy watermark overlays onto a PDF buffer.
   */
  applyWatermark(
    pdfBuffer: Buffer,
    options: WatermarkOptions
  ): Promise<WatermarkResult>;

  /**
   * Inspects a PDF buffer and returns total page count.
   */
  getPageCount(pdfBuffer: Buffer): Promise<number>;
}

export const PDF_WATERMARK_SERVICE = "PDF_WATERMARK_SERVICE";
```

#### `watermark-queue.service.interface.ts`
```typescript
export const WATERMARK_QUEUE = "watermark";

export interface IWatermarkQueueService {
  /**
   * Dispatches a watermarking job to BullMQ queue.
   */
  dispatchWatermarkJob(data: WatermarkJobData): Promise<string>;

  /**
   * Checks the status of an existing watermark job by ID.
   */
  getJobStatus(jobId: string): Promise<WatermarkJobStatus | null>;
}

export const WATERMARK_QUEUE_SERVICE = "WATERMARK_QUEUE_SERVICE";
```

---

## 5. Security & Edge Cases

1. **Tamper-Resistant Storage**: The generated PDF is written directly to the private `vetralink-deliveries` bucket. No direct public S3 URLs are ever exposed.
2. **Missing or Corrupted Master Asset**: If `sourceS3Key` does not exist or the master PDF is corrupted/unreadable, the worker logs the structured error, emits progress `failed`, and throws a domain exception to trigger BullMQ's exponential retry policy.
3. **Scratch Storage Leak Protection**: Scratch directories generated in `os.tmpdir()` are uniquely namespaced with UUIDv4 and wrapped in `try/finally` blocks with `rm(tempDir, { recursive: true, force: true })`.
4. **Buyer PII Protection**: Sensitive buyer email is masked (e.g. `j***e@domain.com`) in the watermark text to prevent exposing full email addresses if screenshots are shared.
5. **Special Characters & Standard Fonts**: `pdf-lib` standard fonts (e.g. `StandardFonts.Helvetica`) require ASCII-safe character encoding. Buyer names with unsupported unicode characters are normalized or sanitized to prevent PDF rendering crashes.
