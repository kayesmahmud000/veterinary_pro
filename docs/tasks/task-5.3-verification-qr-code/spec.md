# SPEC-503: Cryptographic Verification QR Code Generation on Watermarked PDFs
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 5: Dynamic Anti-Piracy Watermarking & Fulfillment
# Task 5.3: Generate cryptographic verification QR code on watermarked PDFs
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Feature Overview & Objective

### The Problem
While visible diagonal text watermarks and integrity hashes deter casual file sharing, they have limitations in real-world verification:
1. **Friction in Manual Verification**: If an unauthorized PDF is discovered in circulation or a veterinarian brings a printed clinical protocol to a farm inspection, manually typing a 36-character UUID or 16-character hex hash into a web browser to verify ownership is tedious and prone to human error.
2. **Physical Printout Disconnect**: Once a digital eBook, guide, or signed prescription is printed to physical paper, digital metadata is lost. Without a machine-readable barcode or QR code, farm auditors and veterinary inspectors cannot verify whether the physical document was legitimately purchased or pirated.
3. **Absence of Visual Authenticity Anchor**: High-end enterprise SaaS delivery platforms (e.g. DocuSign, Coursera, Wiley) place an authoritative, scannable QR verification badge in a designated margin corner to signal official provenance and instill buyer confidence.

### The Objective
Engineer a **Cryptographic Verification QR Code Engine** integrated into the dynamic watermarking pipeline:
1. **High-Performance In-Memory QR Generation (`QrCodeService`)**: Encapsulate the `qrcode` engine behind `IQrCodeService`, producing optimized PNG image buffers with error correction Level M/Q directly in memory without disk I/O.
2. **Verification URL Resolution**: Generate an immutable, tamper-resistant verification URL linking to `https://vetralink.pro/verify/license?token=<downloadToken>&orderId=<orderId>&sig=<hash>`.
3. **Corner Badge Layout & Margin Calibration**: Using `pdf-lib`, embed the generated PNG image (`pdfDoc.embedPng`) and draw it onto the bottom-right corner of PDF pages (`width: 46pt, height: 46pt`), perfectly aligned above the security footer to avoid obscuring text, clinical charts, or page numbering.
4. **Adaptive Page Placement Strategy**: Support configurable placement (e.g. `every-page` for maximum piracy deterrence, or `first-and-last` for cleaner intermediate reading, with `every-page` as default).
5. **Decoupled Architecture**: Cleanly inject `IQrCodeService` into `PdfWatermarkService`, allowing independent mocking, unit testing, and zero coupling to BullMQ or S3 storage.

---

## 2. Current State vs. Proposed State

| Capability | Current Codebase State (Post Task 5.2) | Proposed State (Post Task 5.3) |
| :--- | :--- | :--- |
| **QR Code Engine** | None installed. | In-memory `qrcode` engine behind `IQrCodeService` supporting PNG buffer generation with error correction. |
| **Document Scannability** | Text-only diagonal watermarks and footer string. Not scannable by smartphone camera or barcode scanner. | Authoritative 46x46pt high-contrast QR code rendered on the bottom-right corner linking to official verification portal. |
| **Physical Printout Verification** | Printouts lose digital verification capabilities; verification requires manual typing of hash. | Anyone scanning the physical paper printout immediately resolves the digital license status, purchaser name, and order date. |
| **Watermark Options** | Supports text, opacities, and hash flags. | Extended with `includeQrCode?: boolean`, `qrCodeUrl?: string`, and `qrPlacement?: 'all-pages' | 'first-page' | 'first-and-last'`. |

---

## 3. Architectural & Design Trade-offs

### Trade-off 1: In-Memory PNG Buffer Embedding vs. Raw Vector Path Drawing
- **Option A: Generating SVG and parsing raw vector path coordinates to draw in `pdf-lib`.**
  - *Cons*: QR codes consist of hundreds of tiny square path elements; rendering raw paths in `pdf-lib` is computationally heavy and significantly inflates PDF execution time per page.
- **Option B (Selected): Generating a Single In-Memory PNG Buffer via `qrcode.toBuffer()` and Embedding Once via `pdfDoc.embedPng()`.**
  - *Pros*: `pdfDoc.embedPng()` embeds the rasterized image into the PDF XObject dictionary **exactly once**; subsequent pages merely reference the single embedded object ID. Memory overhead is < 15KB total, execution time is < 5ms per document, and rendering is instant across hundreds of pages.
  - *Rationale*: Maximum throughput, minimal file size bloat, and sub-millisecond per-page stamping.

### Trade-off 2: QR Error Correction Level (Low 'L' vs. Medium 'M' vs. High 'H')
- **Option A: Level L (7% recovery).**
  - *Cons*: Any small physical tear, smudge, or diagonal watermark overlap renders the QR code unreadable by smartphone cameras.
- **Option B (Selected): Level M (15% recovery) / Level Q (25% recovery).**
  - *Pros*: Provides sufficient redundancy to withstand partial ink smudging or faint watermark crossing while maintaining a compact matrix (version 2-3 QR code, ~29x29 modules) that remains easily scannable even at 46x46pt size.
  - *Rationale*: Optimal balance between scan robustness and badge compactness.

### Trade-off 3: Page Placement Strategy
- By default, the QR verification badge is stamped on **all pages** (`all-pages`) in the lower-right margin (x: `width - 56`, y: `26`, size: `44x44`).
- Can be optionally configured to `first-page` or `first-and-last` via `WatermarkOptions.qrPlacement`.
- *Rationale*: For digital assets (e-books, templates), multi-page placement prevents cropping out the first page to eliminate the verification anchor.

---

## 4. Data Models, Contracts & DTOs

### 1. `IQrCodeService` Interface (`qr-code.service.interface.ts`)
```typescript
export interface QrCodeOptions {
  readonly width?: number; // default 150px
  readonly margin?: number; // default 1
  readonly errorCorrectionLevel?: "L" | "M" | "Q" | "H"; // default 'M'
}

export interface IQrCodeService {
  /**
   * Generates a PNG image Buffer for a given verification URL or payload string.
   */
  generateQrCodePngBuffer(
    payload: string,
    options?: QrCodeOptions
  ): Promise<Buffer>;
}

export const QR_CODE_SERVICE = "QR_CODE_SERVICE";
```

### 2. Extended `WatermarkOptions` (`pdf-watermark.service.interface.ts`)
```typescript
export type QrCodePlacement = "all-pages" | "first-page" | "first-and-last";

export interface WatermarkOptions {
  readonly buyerName: string;
  readonly buyerEmail: string;
  readonly orderId: string;
  readonly purchaseDate: string;
  readonly customNotice?: string;
  readonly opacity?: number;
  readonly rotationDegrees?: number;
  readonly repeatDiagonal?: boolean;
  readonly includeIntegrityHash?: boolean;
  readonly includeQrCode?: boolean; // default true
  readonly verificationUrl?: string; // custom or default to https://vetralink.pro/verify/<token>
  readonly qrPlacement?: QrCodePlacement; // default 'all-pages'
  readonly downloadToken?: string;
}
```

---

## 5. Security & Edge Cases

1. **URL Injection & XSS Protection**: The verification URL is constructed strictly using URL encoding (`encodeURIComponent`) over verified order UUIDs and tokens.
2. **Missing Token Fallback**: If no `downloadToken` or `verificationUrl` is explicitly provided, the service defaults to `https://vetralink.pro/verify/${orderId}`, ensuring a valid QR code is always generated.
3. **Single-Page Documents**: In single-page PDFs, `first-and-last` placement behaves idempotently, stamping the page exactly once.
4. **Non-Overlapping Margin Geometry**: The QR code is placed at `y: 26` with height `44pt`, ensuring it sits strictly between the content body margin and the security footer (`y: 18`), preventing overlap with clinical text or page numbers.
