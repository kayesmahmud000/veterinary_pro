# SPEC-502: Advanced Diagonal Anti-Piracy Identity Burn Engine
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 5: Dynamic Anti-Piracy Watermarking & Fulfillment
# Task 5.2: Burn buyer identity (Full Name, masked email, Order ID, timestamp) diagonally across pages
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Feature Overview & Objective

### The Problem
Simple single-line watermarks on digital PDFs suffer from several vulnerabilities:
1. **Cropping & Redaction Exploits**: If a watermark only appears once in the center or solely in the footer/margins, pirates can easily crop borders, mask the central section, or cut out diagrams and charts for unauthorized resale.
2. **Page Geometry & Orientation Fragility**: Documents in veterinary medicine frequently mix Portrait pages (standard text chapters) with Landscape pages (large dosage tables, anatomical charts, financial ROI spreadsheets). Hardcoded coordinates cause watermarks to clip off-screen or leave vast unwatermarked blind spots.
3. **Contrast & Legibility Interference**: An improperly calibrated watermark either obscures critical clinical text (too dark/opaque) making medications unreadable, or is so faint (too transparent) that simple PDF software or image filters can strip it without trace.
4. **Non-Repudiation Void**: If a leaked PDF has its visible watermark altered or text replaced, there is no cryptographic watermark proof embedded within the PDF structure to verify original buyer identity against the platform database.

### The Objective
Engineer an **Adaptive Diagonal Anti-Piracy Watermarking Engine**:
1. **Multi-Band Diagonal Tiling Grid**: Compute an adaptive diagonal coordinate grid spanning each page from bottom-left to top-right at 45 degrees, burning primary and secondary identity bands to prevent cropping attacks.
2. **Full Buyer Attribution Formula**:
   - Primary running diagonal band:
     `Licensed to: <Sanitized Name> (<Masked Email>) | Order #<OrderId> | Strictly Confidential`
   - Secondary companion band:
     `VETRALINK PRO SECURE ASSET • NON-TRANSFERABLE • COPYING PROHIBITED`
   - Security Header Band: Micro-print document classification and digital delivery notice.
   - Security Footer Band: Purchase timestamp in UTC, page numbering (`Page X of Y`), and SHA-256 Buyer Proof Integrity Stamp.
3. **Adaptive Page Geometry Engine**: Automatically compute page bounds (`width`, `height`), handle Portrait and Landscape aspect ratios dynamically, and scale font sizes proportionally so watermarks look crisp and consistent across A4, Letter, Legal, and custom dimensions.
4. **Cryptographic SHA-256 Buyer Integrity Hash**: Generate an immutable HMAC-SHA256 / SHA-256 integrity token over `(buyerEmail + orderId + purchaseDate)` and stamp it onto the document metadata and footer, enabling zero-knowledge verification even if visual text is partially obscured.
5. **PII Masking & Unicode Safe Sanitization**: Enforce RFC-compliant email masking (`j***e@domain.com`) and robust character transliteration/sanitization to prevent WinAnsi standard font encoding exceptions while retaining international buyer legibility.

---

## 2. Current State vs. Proposed State

| Capability | Current State (Task 5.1 Baseline) | Proposed State (Post Task 5.2) |
| :--- | :--- | :--- |
| **Diagonal Layout** | Fixed single diagonal text line in page center with basic offset calculation. | Adaptive multi-band diagonal grid tiled proportionally based on hypotenuse and page aspect ratio. |
| **Orientation Handling** | Fixed coordinate calculation regardless of landscape/portrait. | Dynamic geometry engine computing angle, bounding box, and font scaling dynamically for Portrait & Landscape. |
| **Integrity Proof** | No cryptographic token embedded in PDF. | SHA-256 Buyer Proof Token generated and stamped in security band for non-repudiation. |
| **Visual Security** | Single opacity setting without contrast calibration. | Calibrated dual-opacity rendering (subtle background diagonal at 0.22 opacity + micro-security bands at 0.65 opacity) preventing OCR stripping while preserving medical text legibility. |
| **Customization & Configuration** | Minimal options (`buyerName`, `buyerEmail`, `orderId`, `purchaseDate`). | Comprehensive options interface (`opacity`, `rotationDegrees`, `repeatDiagonal`, `includeIntegrityHash`, `customNotice`). |

---

## 3. Architectural & Design Trade-offs

### Trade-off 1: Vector Text Stamping (`pdf-lib`) vs. Raster Image Overlay
- **Option A: Pre-rendering an SVG/PNG watermark and drawing it as an image overlay on each page.**
  - *Cons*: Increases output PDF file size significantly (often +500KB to 2MB per document); introduces pixelation when buyers zoom into clinical diagrams; adds image encoding CPU overhead.
- **Option B (Selected): Native Vector Font Text Drawing via `PDFPage.drawText()` with Opacity & Rotation.**
  - *Pros*: Near-zero file size impact (adds only a few kilobytes per document); vector-sharp rendering at any zoom level (100% to 800% zoom); native PDF text stream integration making simple layer extraction impossible.
  - *Rationale*: Optimal performance, pristine typography, and minimal bandwidth consumption for mobile/rural users.

### Trade-off 2: Full Repetition Grid vs. Strategic Dual-Diagonal Bands
- **Option A: High-density watermark repeating 10+ times across the page.**
  - *Cons*: Clutters clinical manuals, making complex surgical steps, veterinary drug dosage charts, or milk logging numbers hard to read, causing high buyer churn.
  - *Option B (Selected): Strategic Tri-Band Adaptive Layout (Upper Diagonal, Center Diagonal, Lower Diagonal) with Calibrated Low Opacity (0.20 - 0.24).**
  - *Pros*: Provides full coverage against cropping anywhere on the page while maintaining 100% legibility of underlying medical text.
  - *Rationale*: Balances aggressive anti-piracy deterrence with professional clinical readability.

### Trade-off 3: Cryptographic Integrity Hash Construction
- The integrity hash is generated via `crypto.createHmac('sha256', secret).update(buyerEmail + orderId + purchaseDate).digest('hex').substring(0, 16)`.
- *Rationale*: A 16-character hexadecimal fingerprint is compact enough to fit unobtrusively in the micro-print security band while providing $16^{16} \approx 1.84 \times 10^{19}$ entropy, making forgery computationally infeasible.

---

## 4. Data Models, Contracts & DTOs

### 1. Extended Watermark Options (`pdf-watermark.service.interface.ts`)
```typescript
export interface WatermarkOptions {
  readonly buyerName: string;
  readonly buyerEmail: string;
  readonly orderId: string;
  readonly purchaseDate: string;
  readonly customNotice?: string;
  readonly opacity?: number; // default 0.22
  readonly rotationDegrees?: number; // default 45
  readonly repeatDiagonal?: boolean; // default true
  readonly includeIntegrityHash?: boolean; // default true
}

export interface WatermarkResult {
  readonly pdfBuffer: Buffer;
  readonly pageCount: number;
  readonly executionTimeMs: number;
  readonly integrityHash?: string;
}
```

### 2. Geometry & Layout Contracts (`pdf-geometry.util.ts`)
```typescript
export interface PageLayoutGeometry {
  readonly width: number;
  readonly height: number;
  readonly isLandscape: boolean;
  readonly diagonalAngleDegrees: number;
  readonly centerDiagonalY: number;
  readonly upperDiagonalY: number;
  readonly lowerDiagonalY: number;
  readonly optimalFontSize: number;
}
```

---

## 5. Security & Edge Cases

1. **Extreme Aspect Ratios**: PDFs with extreme widths or heights (e.g. wide panoramic spreadsheets or long mobile receipts) calculate angle and font size using trigonometric bounds (`Math.atan2(height, width)`), preventing overflow.
2. **Encrypted or Permissions-Restricted PDFs**: Handled gracefully with `ignoreEncryption: true`; if the PDF has restrictive permissions or damaged xref tables, a structured domain exception is thrown.
3. **PII Masking Guarantees**: Under no circumstances is the raw buyer email burned in plaintext. The mask format `u***r@domain.com` ensures privacy in case the document is legitimately shared in internal farm audits.
4. **Tamper Detection**: If someone attempts to erase the visible watermark using PDF editors, the document metadata and SHA-256 integrity stamp in the footer can be used to re-identify the purchaser.
