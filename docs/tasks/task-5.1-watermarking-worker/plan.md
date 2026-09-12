# PLAN-501: Step-by-Step Execution Plan for BullMQ Watermarking Worker
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 5: Dynamic Anti-Piracy Watermarking & Fulfillment
# Task 5.1: BullMQ dynamic watermarking worker using pdf-lib / Gotenberg engine
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Prerequisites & Dependencies

- [x] Install `pdf-lib` in `apps/api`:
  ```bash
  pnpm --filter @vetralink/api add pdf-lib
  ```
- [x] Verify `apps/api/package.json` reflects `pdf-lib` dependency.

---

## 2. Implementation Checklist

### Step 1: Shared Types & DTO Contracts (`packages/shared-types`)
- [x] Create `packages/shared-types/src/dto/watermark/watermark-job.dto.ts`:
  - `WatermarkJobData` interface (orderId, orderItemId, productId, userId, downloadToken, sourceS3Key, destinationS3Key, buyerName, buyerEmail, purchaseDate).
  - `WatermarkJobResult` interface (orderId, orderItemId, destinationS3Key, pageCount, fileSizeBytes, executionTimeMs, completedAt).
  - `WatermarkJobStatus` enum (`QUEUED`, `PROCESSING`, `COMPLETED`, `FAILED`).
- [x] Export watermark DTOs from `packages/shared-types/src/dto/watermark/index.ts` and `packages/shared-types/src/index.ts`.
- [x] Build shared-types: `pnpm --filter @vetralink/shared-types build`.

### Step 2: Watermark Module Structure & Service Interfaces (`apps/api`)
- [x] Create directory structure `apps/api/src/modules/watermark/`:
  - `services/`
  - `processors/`
  - `dto/`
- [x] Create `apps/api/src/modules/watermark/services/pdf-watermark.service.interface.ts`:
  - `WatermarkOptions` and `WatermarkResult` interfaces.
  - `IPdfWatermarkService` interface definition.
  - `PDF_WATERMARK_SERVICE` injection token.
- [x] Create `apps/api/src/modules/watermark/services/watermark-queue.service.interface.ts`:
  - `WATERMARK_QUEUE = 'watermark'` queue name constant.
  - `IWatermarkQueueService` interface definition (`dispatchWatermarkJob`, `getJobStatus`).
  - `WATERMARK_QUEUE_SERVICE` injection token.

### Step 3: Implement `PdfWatermarkService` using `pdf-lib`
- [x] Create `apps/api/src/modules/watermark/services/pdf-watermark.service.ts`:
  - Implement `IPdfWatermarkService`.
  - In `applyWatermark`:
    - Load PDF with `PDFDocument.load(pdfBuffer)`.
    - Embed standard Helvetica font (`StandardFonts.Helvetica`).
    - Iterate each page, calculate page width/height.
    - Stamp dynamic buyer identification text banner across pages.
    - Save modified document with `pdfDoc.save()`.
    - Return buffer, page count, and execution time.
  - In `getPageCount`: load PDF and return `pdfDoc.getPageCount()`.
  - Sanitize string inputs to ASCII safe characters to prevent font glyph encoding crashes.

### Step 4: Implement `WatermarkQueueService`
- [x] Create `apps/api/src/modules/watermark/services/watermark-queue.service.ts`:
  - Inject `@InjectQueue(WATERMARK_QUEUE) private readonly watermarkQueue: Queue`.
  - Implement `dispatchWatermarkJob` with 3 retries, exponential backoff (delay: 2000ms), and auto-cleanup options.
  - Implement `getJobStatus` returning current state.

### Step 5: Implement `WatermarkProcessor` (Worker Host)
- [x] Create `apps/api/src/modules/watermark/processors/watermark.processor.ts`:
  - Decorate with `@Injectable()` and `@Processor(WATERMARK_QUEUE)`.
  - Extend `WorkerHost`.
  - Inject `IS3StorageService`, `IPdfWatermarkService`, `EnvService`.
  - Implement `process(job: Job<WatermarkJobData, WatermarkJobResult>)`:
    - Progress 5%: Validating payload and setting up temp directory in `tmpdir()`.
    - Progress 15%: Downloading master PDF from S3 source bucket to scratch file.
    - Progress 50%: Executing `pdfWatermarkService.applyWatermark`.
    - Progress 80%: Uploading watermarked output to S3 destination bucket (`vetralink-deliveries`).
    - Progress 100%: Returning `WatermarkJobResult`.
    - Guaranteed cleanup in `finally` block removing scratch directory.

### Step 6: Module Assembly & Integration (`WatermarkModule`)
- [x] Create `apps/api/src/modules/watermark/watermark.module.ts`:
  - Import `BullModule.registerQueue({ name: WATERMARK_QUEUE })`.
  - Import `MediaModule` (for S3 storage provider).
  - Provide and export `PdfWatermarkService`, `WatermarkQueueService`, `WatermarkProcessor`.
- [x] Create `apps/api/src/modules/watermark/index.ts`.
- [x] Register `WatermarkModule` in `apps/api/src/app.module.ts`.

### Step 7: Comprehensive Unit & Integration Tests
- [x] Create `apps/api/src/modules/watermark/services/pdf-watermark.service.spec.ts`:
  - Test real PDF generation and watermark overlay with `pdf-lib`.
  - Test page count extraction.
  - Test ASCII sanitization on non-standard unicode characters.
- [x] Create `apps/api/src/modules/watermark/services/watermark-queue.service.spec.ts`:
  - Test job dispatch with options, retries, and backoff.
  - Test job status querying.
- [x] Create `apps/api/src/modules/watermark/processors/watermark.processor.spec.ts`:
  - Test end-to-end process lifecycle with mocked S3 storage and watermark service.
  - Test scratch file directory cleanup even on unexpected failures.
  - Test progress reporting.

---

## 3. Verification & Acceptance Criteria

1. **Test Suite Verification**:
   ```bash
   pnpm --filter @vetralink/api test src/modules/watermark
   ```
   All test suites must pass with 100% green status.
2. **Build Verification**:
   ```bash
   pnpm --filter @vetralink/shared-types build
   pnpm --filter @vetralink/api build
   ```
   Zero TypeScript or NestJS compilation errors.
3. **Clean Architecture Compliance**:
   Strict adherence to dependency inversion via interfaces and zero direct circular dependencies.
