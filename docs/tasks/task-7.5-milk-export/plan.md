# PLAN-705: Execution Plan for Milk Production Logs CSV & Excel Export Engine

## Prerequisites
- Working NestJS monorepo (`@vetralink/api` and `@vetralink/shared-types`).
- `xlsx: ^0.18.5` installed in `@vetralink/api`.
- `MilkLog` repository and entities from Tasks 7.1–7.4.

---

## Implementation Steps

### Step 1: Shared Types & DTO Contracts (`packages/shared-types`)
- [x] Create `packages/shared-types/src/enums/milk-export-format.enum.ts`:
  - `MilkExportFormat.CSV = "CSV"`
  - `MilkExportFormat.EXCEL = "EXCEL"`
- [x] Create `packages/shared-types/src/dto/milk-logs/milk-export.dto.ts`:
  - `ExportMilkLogsRequestDto`
  - `MilkExportResult` (buffer, fileName, contentType)
- [x] Export enums and DTOs in `packages/shared-types/src/index.ts`.
- [x] Build shared types package (`pnpm --filter @vetralink/shared-types build`).

### Step 2: Repository Layer Enhancement (`apps/api/src/modules/milk-logs`)
- [x] Add `MilkLogExportFilter` to `apps/api/src/modules/milk-logs/repositories/milk-log.repository.interface.ts`.
- [x] Add `findLogsForExport(farmId: string, filter: MilkLogExportFilter): Promise<MilkLogEntity[]>` to `IMilkLogRepository`.
- [x] Implement `findLogsForExport` in `apps/api/src/modules/milk-logs/repositories/milk-log.repository.ts`.
  - Scopes strictly by `farmId`.
  - Supports filters: `animalId`, `session`, `startDate`, `endDate`, `entryType`.
  - Orders chronologically: `loggedDate asc, session asc`.
  - Includes `animal` and `recordedBy` relations.

### Step 3: Domain Service & Export Engine (`apps/api/src/modules/milk-logs`)
- [x] Create `apps/api/src/modules/milk-logs/services/milk-export.service.interface.ts`:
  - `exportMilkLogs(farmId: string, filter: ExportMilkLogsQueryDto): Promise<{ buffer: Buffer; fileName: string; contentType: string }>`
- [x] Implement `apps/api/src/modules/milk-logs/services/milk-export.service.ts`:
  - Validate date parameters (`startDate <= endDate`, no distant future dates).
  - Query logs via repository.
  - CSV generation:
    - Prepend UTF-8 BOM (`\uFEFF`) for Excel auto-detection.
    - Format RFC 4180 escaped CSV rows.
  - Excel generation (`xlsx`):
    - Build "Production Logs" worksheet with styled column widths and numeric cell types.
    - Build "Executive Summary" worksheet with calculated aggregates (Total Yield, Average Yield, Morning/Afternoon/Evening session volume, Weighted Average Fat/SNF).
    - Serialize workbook to binary buffer (`xlsx.write(wb, { type: "buffer", bookType: "xlsx" })`).
  - Dynamic file name generation: `milk-production-<farmId-slice>-<startDate>-to-<endDate>.<ext>`.

### Step 4: Controller Endpoint & Module Wiring
- [x] Create `apps/api/src/modules/milk-logs/dto/export-milk-logs-query.dto.ts` with `class-validator` and `@ApiProperty` decorators.
- [x] In `apps/api/src/modules/milk-logs/milk-logs.controller.ts`:
  - Add `GET /api/v1/milk-logs/export` endpoint.
  - Apply `@FarmRoles(...)`, `@Tenant()`, `@ApiOperation`, Swagger responses.
  - Stream file via `StreamableFile` with `Content-Type`, `Content-Disposition`, and `Content-Length` headers.
- [x] In `apps/api/src/modules/milk-logs/milk-logs.module.ts`:
  - Register `MILK_EXPORT_SERVICE` (`MilkExportService`) as a provider and export it.

### Step 5: Unit & Integration Tests Verification
- [x] Unit tests for `MilkExportService`:
  - Exports valid CSV with BOM and correct columns.
  - Exports valid Excel workbook with both sheets ("Production Logs" and "Executive Summary").
  - Handles empty result set gracefully.
  - Throws `ValidationDomainException` when `startDate > endDate`.
  - Correctly filters by session, animalId, and entryType.
- [x] Unit tests for `MilkLogRepository.findLogsForExport`.
- [x] Unit tests for `MilkLogsController.exportMilkLogs` endpoint.
- [x] Run `pnpm --filter @vetralink/api test src/modules/milk-logs`.
- [x] Run full test suite: `pnpm --filter @vetralink/api test`.
- [x] Run TypeScript compilation: `pnpm --filter @vetralink/api build`.
- [x] Check off items in `plan.md` and mark Task 7.5 as complete in `ROADMAP.md`.
