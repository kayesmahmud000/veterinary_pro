# PLAN-606: Step-by-Step Execution Plan for Printable QR Code Physical Barn Tagging

## 1. Prerequisites & Dependencies
- [x] Task 6.5 completed and verified.
- [x] `pdf-lib` and `qrcode` present in `apps/api/package.json`.
- [x] `@vetralink/shared-types` workspace package available for building.

---

## 2. Implementation Checklist

### Step 1: Shared Contracts & DTOs (`packages/shared-types`)
- [x] Update `packages/shared-types/src/enums/index.ts`:
  - Add `TagBadgeLayout` (`GRID_2X3`, `GRID_2X4`, `SINGLE_PER_PAGE`).
  - Add `TagBadgePageSize` (`A4`, `LETTER`).
- [x] Create `packages/shared-types/src/dto/animals/tag-badge.dto.ts`:
  - `AnimalQrCodeDto` (`animalId`, `farmId`, `tagNumber`, `qrCodeDataUrl`, `payload`).
  - `BatchTagBadgeRequestDto` (`animalIds`, `species`, `status`, `layout`, `pageSize`, `includePedigree`).
- [x] Export in `packages/shared-types/src/dto/animals/index.ts` and `src/index.ts`.
- [x] Rebuild `@vetralink/shared-types` (`pnpm --filter @vetralink/shared-types build`).

### Step 2: Animal Tag Service Contract & Layout Utilities (`apps/api`)
- [x] Create `apps/api/src/modules/animals/services/animal-tag.service.interface.ts`:
  - Token `ANIMAL_TAG_SERVICE = "ANIMAL_TAG_SERVICE"`.
  - Methods:
    - `generateQrCode(farmId: string, animalId: string): Promise<AnimalQrCodeDto>;`
    - `generateQrCodePngBuffer(farmId: string, animalId: string): Promise<{ buffer: Buffer; tagNumber: string }>;`
    - `generateSingleTagBadgePdf(farmId: string, animalId: string): Promise<{ buffer: Buffer; tagNumber: string }>;`
    - `generateBatchTagBadgesPdf(farmId: string, dto: BatchTagBadgeRequestDto): Promise<Buffer>;`
- [x] Create `apps/api/src/modules/animals/utils/tag-layout.util.ts`:
  - Dimensions for A4 (595.28 x 841.89) and US Letter (612 x 792).
  - Grid cell calculation (x, y, width, height) for 2x3 and 2x4 layouts.
  - Age formatter (`"3y 2m"`, `"5m"`, `"12d"`).
  - Text truncation and dynamic font sizing helpers.

### Step 3: Animal Tag Service Implementation (`apps/api`)
- [x] Create `apps/api/src/modules/animals/services/animal-tag.service.ts`:
  - Fetch target animal(s) scoped by `farmId` using `IAnimalRepository`.
  - Resolve sire/dam tag numbers when `includePedigree` is true.
  - QR Code generation:
    - Encodes canonical URL: `https://vetralink.pro/farms/${farmId}/animals/${animalId}?tag=${tagNumber}`.
    - Error correction level `M` for resilience against dust and scratches.
  - Single Placard PDF generator:
    - Single landscape card (6" x 4" / 432 x 288 pt).
    - Large bold tag number, high-res QR code, breed, species, gender, DOB, RFID, pedigree.
  - Batch Grid PDF generator:
    - Configurable grid (2x3 or 2x4 per page) on A4 / US Letter.
    - Dashed cut lines between cells for scissors / paper guillotine cutting.
    - Page footer ("Page X of Y • VetraLink Pro Livestock Registry • [Date]").
    - Max 100 animals per batch constraint.
- [x] Register `AnimalTagService` and provider `ANIMAL_TAG_SERVICE` in `AnimalsModule`.

### Step 4: Controller Endpoints & Wiring (`apps/api`)
- [x] Update `AnimalsController` in `apps/api/src/modules/animals/animals.controller.ts`:
  - `GET /api/v1/animals/:id/qr-code`:
    - Handles query `?format=png` (streams PNG buffer) or default JSON response.
  - `GET /api/v1/animals/:id/tag-badge`:
    - Streams `application/pdf` with `inline` disposition.
  - `POST /api/v1/animals/tag-badges/batch`:
    - Validates DTO, streams `application/pdf` with `attachment` disposition.
- [x] Verify static vs parameterized route ordering so `:id/tag-badge` and `:id/qr-code` do not conflict with static endpoints.

### Step 5: Unit & Integration Tests
- [x] Create `apps/api/src/modules/animals/services/animal-tag.service.spec.ts`:
  - Test QR code generation (payload structure, data URL, PNG buffer).
  - Test single animal placard PDF generation (valid `%PDF-` signature, correct animal data).
  - Test batch tag sheet PDF generation (multi-animal, page count, grid cell count).
  - Test error cases (animal not found, foreign farm isolation, > 100 animals limit, zero matching animals).
- [x] Update `apps/api/src/modules/animals/animals.controller.spec.ts`:
  - Test controller delegation for `getAnimalQrCode`, `getAnimalTagBadgePdf`, and `printBatchTagBadges`.
- [x] Update `apps/api/src/modules/animals/animals.int.spec.ts`:
  - Supertest tests for `GET /api/v1/animals/:id/qr-code`.
  - Supertest tests for `GET /api/v1/animals/:id/tag-badge` returning `application/pdf`.
  - Supertest tests for `POST /api/v1/animals/tag-badges/batch` returning `application/pdf`.

### Step 6: Verification & Roadmap Update
- [x] Run full test suite for animals module:
  ```bash
  pnpm --filter @vetralink/api test src/modules/animals
  ```
- [x] Run production build:
  ```bash
  pnpm --filter @vetralink/api build
  ```
- [x] Update `ROADMAP.md` marking Task 6.6 as completed (`[x]`).
- [x] Suggest conventional commit message.

---

## 3. Verification & Acceptance Criteria
1. **Scannable QR Codes**: QR codes generated encode canonical URLs and scan reliably with error correction level M.
2. **Deterministic PDF Output**: Vector PDFs generated via `pdf-lib` open cleanly in standard PDF viewers without layout corruption or font errors.
3. **Dual Print Layouts**: Supports single placard format (4"x6") and multi-tag grid sheets (2x3 or 2x4 on A4 / US Letter) with dashed cutting guides.
4. **Pedigree & Vitals Visibility**: Badges prominently display ear tag, species, breed, gender, age, RFID, and sire/dam tags.
5. **Strict Multi-Tenancy**: Tenant farm isolation strictly enforced; cannot generate tags for animals belonging to other farms.
6. **Zero Regression**: 100% test pass rate across all unit and integration tests.
