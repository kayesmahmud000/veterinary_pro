# SPEC-606: Printable QR Code Generation for Physical Barn Tagging

## 1. Feature Overview & Objective
In modern commercial and family livestock operations, physical animal identification is vital for daily farm workflows: milking parlour entry, veterinary inspections, artificial insemination, weighing, and sorting. Physical identification is maintained via plastic ear tags, stall placards mounted over stanchions, and pen/hutch cards.

Manually typing 10-15 character ear tag numbers or alphanumeric RFID identifiers on handheld tablets or mobile phones in wet, dusty barn environments is slow, frustrating, and prone to human error.

**Objective**:
Provide a printable QR code and physical tagging engine within VETRALINK PRO that generates:
1. High-contrast, error-tolerant QR codes encoding canonical HTTPS animal profile URLs universally resolvable by any smartphone camera or VETRALINK mobile scanner.
2. Individual printable barn placards / ear tag badges (PDF) with high-visibility typography (readable from 5-10 meters), animal pedigree lineage, breed, birth date/age, electronic RFID, and farm branding.
3. High-density batch printable PDF sheets (standard A4 and US Letter grid layouts with dashed cut lines) enabling farm operators to print dozens or hundreds of ear tag inserts and stall cards in a single print run on standard office or barn printers.
4. Dedicated REST endpoints for raw QR payload retrieval, single PDF badge generation, and batch PDF sheet generation, with strict multi-tenant isolation.

---

## 2. Current State vs. Proposed State

### Current State
- `AnimalsModule` provides complete animal CRUD, unique ear tag and RFID validation, lineage graph traversal, weight tracking, and bulk CSV/Excel herd ingestion.
- `pdf-lib` and `qrcode` libraries are already installed and utilized in `WatermarkModule` for digital product watermarking.
- No capabilities exist for generating printable physical tags, barn stall placards, or individual animal QR codes.

### Proposed State
- **`AnimalTagService` (`IAnimalTagService`)**:
  - Encapsulates QR code generation using `qrcode` with Error Correction Level `M` (15% redundancy) or `H` (30% redundancy) to withstand dirt, scratches, or wear on physical ear tags.
  - Implements vector PDF rendering via `pdf-lib` for both single placards and multi-tag grid sheets (A4 / Letter).
  - Handles typography, dynamic text scaling (preventing overflow on long tag numbers or breed names), pedigree tag resolution, age calculation, and dashed cut guides.
- **REST Endpoints in `AnimalsController`**:
  - `GET /api/v1/animals/:id/qr-code`: Returns JSON containing `{ animalId, farmId, tagNumber, qrCodeDataUrl, payload }` with optional `?format=png` for raw image streaming.
  - `GET /api/v1/animals/:id/tag-badge`: Returns `application/pdf` streaming a single-page printable tag/placard formatted with farm branding and animal vitals.
  - `POST /api/v1/animals/tag-badges/batch`: Accepts filter criteria or a list of `animalIds`, returning `application/pdf` streaming a multi-page printable grid sheet (A4 or US Letter, 6 or 8 tags per page).
- **Multi-Tenancy & Authorization**:
  - Strictly scoped to the authenticated tenant's `farmId`.
  - Guarded by `@Roles(UserRole.FARM_OWNER, UserRole.FARM_MANAGER, UserRole.VETERINARIAN)`.

---

## 3. Architectural & Design Trade-offs

### Trade-off 1: Server-Side PDF Rendering (`pdf-lib`) vs. Client-Side Browser Print (`window.print()`)
- **Option A (Client-side HTML/Canvas rendering)**:
  - Generate HTML/CSS in the web client and use browser print dialog.
  - *Cons*: Highly inconsistent rendering across browsers (Chrome, Safari, Firefox), mobile devices, and OS printer drivers. Margins and cut lines shift, resulting in ruined expensive waterproof synthetic tag stock.
- **Option B (Server-side Vector PDF via `pdf-lib` - SELECTED)**:
  - Generate pixel-perfect, vector-sharp PDF documents on the server.
  - *Pros*: 100% deterministic layout down to the exact point (1/72 inch). Identical output across mobile apps, web browsers, and desktop OSs. Native support for embedded high-density PNG QR codes and standard vector fonts (`Helvetica`, `Helvetica-Bold`).
  - *Justification*: Physical tag sheets and barn placards require exact dimensions and consistent cut guides regardless of client hardware or browser.

### Trade-off 2: QR Code Payload Format: Canonical HTTPS URL vs. Opaque Identifier / JSON
- **Option A (Opaque Tag or JSON string)**: e.g. `{"farm":"uuid","tag":"COW-101"}`.
  - *Cons*: Scanning with standard iOS/Android camera apps displays a meaningless text string or prompts a web search, requiring users to open a custom scanning mode inside the VETRALINK app.
- **Option B (Canonical HTTPS Web & Deep Link URL - SELECTED)**:
  - Format: `https://vetralink.pro/farms/{farmId}/animals/{animalId}?tag={tagNumber}`
  - *Pros*: Universal compatibility. Scanning with any smartphone camera instantly opens the browser to the animal's profile. When the VETRALINK mobile application is installed, universal app links (iOS Universal Links / Android App Links) automatically intercept the URL and navigate directly to the native animal record screen.
  - *Justification*: Maximizes convenience for farm hands, visiting veterinarians, and external auditors who may not have the native mobile app pre-installed.

### Trade-off 3: Batch Tag Generation: Synchronous Streaming vs. Background Worker (BullMQ)
- **Option A (Background Worker with Download URL)**: Enqueue batch generation on BullMQ, upload generated PDF to S3, and notify user.
  - *Cons*: Adds unnecessary queue and polling latency for typical farm printing batches (1 to 100 animals).
- **Option B (Synchronous In-Memory PDF Streaming with Max Batch Limit - SELECTED)**:
  - For batches up to 100 animals (approximately 12–17 pages of 6-up tags), `pdf-lib` generates the entire vector PDF in < 350ms, consuming under 4MB of RAM.
  - Stream directly to HTTP response with `Content-Type: application/pdf`.
  - Cap request at 100 animals per batch.
  - *Justification*: Immediate user gratification; farmers click "Print Tags" and the browser print preview opens instantaneously.

---

## 4. Data Models, DTOs & API Contracts

### 4.1 Shared Types & Enums (`packages/shared-types`)

#### `TagBadgeLayout` Enum:
```typescript
export enum TagBadgeLayout {
  GRID_2X3 = "GRID_2X3",         // 6 tags per page (approx 3.5" x 3.3" each)
  GRID_2X4 = "GRID_2X4",         // 8 tags per page (approx 3.5" x 2.5" each)
  SINGLE_PER_PAGE = "SINGLE_PER_PAGE", // 1 large placard per page (4" x 6" / half-letter / A5)
}

export enum TagBadgePageSize {
  A4 = "A4",                     // 595.28 x 841.89 points
  LETTER = "LETTER",             // 612.00 x 792.00 points
}
```

#### DTOs:
```typescript
export class AnimalQrCodeDto {
  animalId: string;
  farmId: string;
  tagNumber: string;
  qrCodeDataUrl: string;         // data:image/png;base64,...
  payload: string;               // canonical URL
}

export class BatchTagBadgeRequestDto {
  animalIds?: string[];          // Optional explicit list of animal UUIDs (max 100)
  species?: AnimalSpecies;       // Optional species filter
  status?: AnimalStatus;         // Optional status filter
  layout?: TagBadgeLayout;       // Default: GRID_2X3
  pageSize?: TagBadgePageSize;   // Default: A4
  includePedigree?: boolean;     // Default: true
}
```

### 4.2 REST API Endpoints (`apps/api`)

#### 1. `GET /api/v1/animals/:id/qr-code`
- **Query Params**: `format?: 'json' | 'png'` (default: `json`)
- **Response (json)**:
  ```json
  {
    "success": true,
    "statusCode": 200,
    "message": "Animal QR code generated successfully",
    "data": {
      "animalId": "473af71c-fd27-437a-922b-114518469e62",
      "farmId": "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      "tagNumber": "COW-100",
      "qrCodeDataUrl": "data:image/png;base64,iVBORw0KGgo...",
      "payload": "https://vetralink.pro/farms/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/animals/473af71c-fd27-437a-922b-114518469e62?tag=COW-100"
    },
    "traceId": "...",
    "timestamp": "..."
  }
  ```
- **Response (png)**: Binary `image/png` stream.

#### 2. `GET /api/v1/animals/:id/tag-badge`
- **Headers**:
  - `Content-Type`: `application/pdf`
  - `Content-Disposition`: `inline; filename="tag-COW-100.pdf"`
- **Response**: Binary PDF containing a single clean printable placard card with cut margins.

#### 3. `POST /api/v1/animals/tag-badges/batch`
- **Body**: `BatchTagBadgeRequestDto`
- **Headers**:
  - `Content-Type`: `application/pdf`
  - `Content-Disposition`: `attachment; filename="farm-tags-{timestamp}.pdf"`
- **Response**: Binary PDF containing multi-page grid sheets with dashed crop marks.

---

## 5. Security & Edge Cases
1. **Multi-Tenant Scoping**: All animal lookups enforce `farmId` matching. If an animal does not belong to the user's active tenant farm, an `EntityNotFoundDomainException` is thrown.
2. **Batch Limit Guard**: Maximum 100 animals per batch request. If `animalIds` contains > 100 items, throw `ValidationDomainException("Batch tag generation cannot exceed 100 animals per request.")`.
3. **Empty Herd Guard**: If filters match 0 animals, throw `ValidationDomainException("No animals found matching the specified criteria for tag badge generation.")`.
4. **Missing / Optional Fields**:
   - `rfid`: Rendered if present; omitted or displayed as `RFID: —` if absent.
   - `dateOfBirth`: Calculated as age string (e.g. `2y 4m` or `6m`) plus formatted date; displays `DOB: Unknown` if null.
   - `sire` / `dam`: Displays Sire Tag & Dam Tag if pedigree links exist; displays `Sire: — | Dam: —` if unregistered.
5. **Dynamic Text Layout**: Long ear tag strings (e.g. 16-character international RFID ear tags) dynamically scale font size from 28pt down to 18pt so text never collides with card margins or the QR code.
