# PLAN-503: Step-by-Step Execution Plan for Cryptographic Verification QR Code
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 5: Dynamic Anti-Piracy Watermarking & Fulfillment
# Task 5.3: Generate cryptographic verification QR code on watermarked PDFs
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Prerequisites & Dependencies

- [x] Install `qrcode` and `@types/qrcode` in `apps/api`:
  ```bash
  pnpm --filter @vetralink/api add qrcode
  pnpm --filter @vetralink/api add -D @types/qrcode
  ```
- [x] Verify `apps/api/package.json` contains `qrcode` and `@types/qrcode`.

---

## 2. Implementation Checklist

### Step 1: Install Dependencies
- [x] Execute `pnpm --filter @vetralink/api add qrcode` and dev dependency `@types/qrcode`.

### Step 2: QR Code Service Interface (`apps/api/src/modules/watermark/services/`)
- [x] Create `apps/api/src/modules/watermark/services/qr-code.service.interface.ts`:
  - `QrCodeOptions` interface (`width`, `margin`, `errorCorrectionLevel`).
  - `IQrCodeService` interface with `generateQrCodePngBuffer(payload: string, options?: QrCodeOptions): Promise<Buffer>`.
  - `QR_CODE_SERVICE = 'QR_CODE_SERVICE'` injection token.

### Step 3: Implement `QrCodeService`
- [x] Create `apps/api/src/modules/watermark/services/qr-code.service.ts`:
  - Injectable service using `qrcode.toBuffer(payload, { type: 'png', ... })`.
  - Set default options: `width: 150`, `margin: 1`, `errorCorrectionLevel: 'M'`.
  - Validate payload and return in-memory PNG Buffer.

### Step 4: Extend `WatermarkOptions` Interface
- [x] Update `apps/api/src/modules/watermark/services/pdf-watermark.service.interface.ts`:
  - Define `QrCodePlacement = 'all-pages' | 'first-page' | 'first-and-last'`.
  - Add `includeQrCode?: boolean`, `verificationUrl?: string`, `qrPlacement?: QrCodePlacement`, and `downloadToken?: string` to `WatermarkOptions`.

### Step 5: Integrate QR Code Stamping in `PdfWatermarkService`
- [x] Update `apps/api/src/modules/watermark/services/pdf-watermark.service.ts`:
  - Inject `@Inject(QR_CODE_SERVICE) private readonly qrCodeService: IQrCodeService`.
  - Resolve verification URL: `options.verificationUrl ?? https://vetralink.pro/verify/${options.downloadToken || options.orderId}`.
  - If `options.includeQrCode !== false`:
    - Generate QR code buffer via `this.qrCodeService.generateQrCodePngBuffer(verificationUrl)`.
    - Embed PNG into document once via `const qrImage = await pdfDoc.embedPng(qrBuffer)`.
    - Determine which pages to stamp based on `qrPlacement` (default: `'all-pages'`).
    - Draw QR code image on target pages:
      - Coordinate: `x: width - 56, y: 26, width: 44, height: 44, opacity: 0.88`.
      - Draw subtle border or background card if needed.

### Step 6: Module Assembly & Processor Wiring
- [x] Update `apps/api/src/modules/watermark/watermark.module.ts`:
  - Provide `QrCodeService` and export `QR_CODE_SERVICE` and `QrCodeService`.
- [x] Update `apps/api/src/modules/watermark/index.ts` to export QR service and interface.
- [x] Update `apps/api/src/modules/watermark/processors/watermark.processor.ts`:
  - Pass `downloadToken` into `pdfWatermarkService.applyWatermark`.

### Step 7: Comprehensive Unit & Integration Tests
- [x] Create `apps/api/src/modules/watermark/services/qr-code.service.spec.ts`:
  - Test generating valid PNG buffer (inspect PNG magic number bytes `\x89PNG`).
  - Test custom width and error correction levels.
  - Test validation on empty payload.
- [x] Update `apps/api/src/modules/watermark/services/pdf-watermark.service.spec.ts`:
  - Provide mock or real `QrCodeService`.
  - Test QR code embedding on valid PDF.
  - Test `qrPlacement` strategies (`all-pages`, `first-page`, `first-and-last`).
  - Test disabling QR code (`includeQrCode: false`).
- [x] Verify `watermark.processor.spec.ts` with QR-enabled pipeline.

### Step 8: Full Build & Regression Verification
- [x] Run watermark module test suite:
  ```bash
  pnpm --filter @vetralink/api test src/modules/watermark
  ```
- [x] Run full project build:
  ```bash
  pnpm --filter @vetralink/api build
  ```
- [x] Update `ROADMAP.md` ticking off Task 5.3.
- [x] Suggest conventional git commit message.

---

## 3. Verification & Acceptance Criteria

1. **Scannable QR Verification**: QR code generated at 44x44pt on bottom-right margin is cleanly scannable by smartphone camera, resolving the exact verification URL.
2. **Single Embed XObject Optimization**: PNG is embedded exactly once into the PDF XObject catalog, resulting in minimal (< 15KB) file size increase regardless of total page count.
3. **Multi-Page Placement Flexibility**: Accurately honors `all-pages`, `first-page`, and `first-and-last` placement rules.
4. **Zero Layout Distortion**: QR code sits at `y: 26`, staying strictly above the security footer (`y: 18`) without overlapping clinical text, formulas, or page numbers.
5. **Zero Regression**: 100% test pass rate across the full API suite.
