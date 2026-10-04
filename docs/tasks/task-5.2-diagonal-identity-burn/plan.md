# PLAN-502: Step-by-Step Execution Plan for Diagonal Identity Burn Engine
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 5: Dynamic Anti-Piracy Watermarking & Fulfillment
# Task 5.2: Burn buyer identity (Full Name, masked email, Order ID, timestamp) diagonally across pages
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Prerequisites & Dependencies

- [x] Ensure `pdf-lib` is installed in `apps/api` (completed in Task 5.1).
- [x] Ensure `crypto` native Node.js module is available for HMAC-SHA256 integrity tokens.

---

## 2. Implementation Checklist

### Step 1: Layout & Geometry Utility (`apps/api/src/modules/watermark/utils/`)
- [x] Create `apps/api/src/modules/watermark/utils/pdf-watermark-layout.util.ts`:
  - `computePageLayoutGeometry(width: number, height: number)`:
    - Determine if page is Portrait or Landscape.
    - Calculate optimal diagonal rotation angle (default 45° or dynamic `Math.atan2(height, width)`).
    - Calculate dynamic font size based on page dimensions (bounds: 11pt to 18pt).
    - Calculate Y-offsets for tri-band diagonal coverage: center band, upper band (+0.26 height), lower band (-0.26 height).
  - `generateBuyerIntegrityHash(email: string, orderId: string, timestamp: string, secret?: string)`:
    - Compute HMAC-SHA256 / SHA-256 fingerprint, return 16-character compact hex string.
  - `maskBuyerEmail(email: string)`:
    - Adhere to PII protection: mask local part (`j***e@domain.com`), preserve domain.
  - `sanitizeAsciiText(text: string)`:
    - Transliterate / replace non-ASCII characters to prevent WinAnsi standard font crashes.

### Step 2: Extend Watermark Service Interface
- [x] Update `apps/api/src/modules/watermark/services/pdf-watermark.service.interface.ts`:
  - Extend `WatermarkOptions` with:
    - `opacity?: number` (default 0.22)
    - `rotationDegrees?: number` (default 45)
    - `repeatDiagonal?: boolean` (default true)
    - `includeIntegrityHash?: boolean` (default true)
  - Extend `WatermarkResult` with `integrityHash?: string`.

### Step 3: Upgrade `PdfWatermarkService` Implementation
- [x] Update `apps/api/src/modules/watermark/services/pdf-watermark.service.ts`:
  - Utilize `computePageLayoutGeometry` for every page individually.
  - Burn primary diagonal buyer identity band across center:
    `Licensed to: <Name> (<MaskedEmail>) | Order #<OrderId> | Strictly Confidential`
  - When `repeatDiagonal: true`, burn secondary upper and lower diagonal bands:
    - Upper band: Secondary identity watermark with calibrated subtle opacity (0.15).
    - Lower band: Warning band `VETRALINK PRO SECURE ASSET • NON-TRANSFERABLE • STRICTLY CONFIDENTIAL` (0.15 opacity).
  - Burn micro-print security header:
    `DOCUMENT CLASSIFICATION: CONFIDENTIAL • AUTHORIZED VETERINARY COPY` (0.50 opacity).
  - Burn security footer:
    `SECURE DELIVERY • Issued: <UTC Timestamp> • Order: <OrderId> • Integrity: <SHA256 Hash>` and right-aligned `Page X of Y`.
  - Set PDF document metadata (Producer: `VETRALINK PRO Watermark Engine`, Subject: `Licensed Copy for <Name>`).
  - Return `WatermarkResult` with `integrityHash`.

### Step 4: Update Processor & Queue Integration
- [x] Verify `apps/api/src/modules/watermark/processors/watermark.processor.ts` properly passes options and receives `integrityHash`.
- [x] Verify `WatermarkJobResult` can report completion details smoothly.

### Step 5: Comprehensive Unit & Integration Tests
- [x] Create `apps/api/src/modules/watermark/utils/pdf-watermark-layout.util.spec.ts`:
  - Test `computePageLayoutGeometry` for Portrait (e.g. 595 x 842 A4).
  - Test `computePageLayoutGeometry` for Landscape (e.g. 842 x 595 A4 landscape).
  - Test `generateBuyerIntegrityHash` deterministic output and uniqueness.
  - Test `maskBuyerEmail` for various email lengths, subdomains, and invalid formats.
  - Test `sanitizeAsciiText` with accents, umlauts, emojis, and whitespace.
- [x] Expand `apps/api/src/modules/watermark/services/pdf-watermark.service.spec.ts`:
  - Test multi-page document with mixed portrait & landscape pages.
  - Test tri-band diagonal rendering.
  - Test configurable opacity, custom rotation angle, and integrity hash inclusion.
  - Verify embedded document metadata.
- [x] Verify `watermark.processor.spec.ts` passes with updated service.

### Step 6: Full Build & Regression Verification
- [x] Run watermark module tests:
  ```bash
  pnpm --filter @vetralink/api test src/modules/watermark
  ```
- [x] Run full project build:
  ```bash
  pnpm --filter @vetralink/api build
  ```
- [x] Update `ROADMAP.md` ticking off Task 5.2.
- [x] Suggest conventional git commit message.

---

## 3. Verification & Acceptance Criteria

1. **Orientation Agnostic**: Documents containing both Portrait and Landscape pages render watermarks that span the full diagonal without clipping off-screen.
2. **Tri-Band Crop Resistance**: Center, upper-third, and lower-third diagonal bands ensure that cropping any section of the document retains indelible buyer identity.
3. **Cryptographic Integrity**: Footer contains verifiable SHA-256 fingerprint matching the buyer identity parameters.
4. **Legibility Gate**: Opacity calibrated so that clinical drug names, numbers, and diagrams remain 100% legible under the watermark.
5. **Zero Regression**: 100% passing rate on all existing and new test suites.
