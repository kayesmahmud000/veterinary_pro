# SPEC-705: Milk Production Logs CSV & Excel Export Engine

## 1. Feature Overview & Objective
Livestock farm operators, veterinarians, and dairy farm managers require periodic exports of milk production logs for:
- External reporting to agricultural regulatory agencies and dairy cooperatives (e.g., milk processor audits).
- In-depth offline statistical analysis, custom spreadsheet pivot tables, and herd health reviews.
- Archival backups and integration with third-party accounting and dairy management software.

The objective of **Task 7.5** is to deliver a high-performance, multi-format export engine supporting both formatted **CSV (RFC 4180 compliant)** and **Excel spreadsheets (.xlsx)** with multi-sheet executive summaries, granular date/session/animal filtering, and strict multi-tenant authorization.

---

## 2. Current State vs. Proposed State

### Current State
- `MilkLogsModule` provides endpoints for recording individual animal session yields (`POST /milk-logs`), recording bulk cooling tank yields (`POST /milk-logs/bulk`), paginated JSON queries (`GET /milk-logs`), 7-day moving average analytics (`GET /milk-logs/analytics`), and anomaly alerts (`GET /milk-logs/anomalies`).
- All outputs are JSON payloads capped at 100 records per page.
- There is currently no mechanism for farmers to download full date ranges or multi-month historical yields in structured tabular files (CSV or Excel).

### Proposed State
- Introduce `GET /api/v1/milk-logs/export` supporting `format=CSV` and `format=EXCEL` (or `format=XLSX`).
- Provide customizable query filters:
  - `startDate` & `endDate` (ISO YYYY-MM-DD)
  - `animalId` (filter to a specific individual animal)
  - `session` (`MORNING`, `AFTERNOON`, `EVENING`)
  - `entryType` (`INDIVIDUAL`, `BULK`, `ALL`)
  - `limit` (safety cap up to 10,000 records per export; default 5,000)
- Deliver formatted, standards-compliant outputs:
  - **CSV**: UTF-8 encoded with BOM (for seamless Microsoft Excel double-click compatibility), comma-delimited with standard RFC 4180 quoting.
  - **Excel (.xlsx)**: Two structured worksheets:
    1. **"Production Logs"**: Formatted data grid with column headers, auto-adjusted column widths, and numeric data types for calculations.
    2. **"Summary & Aggregates"**: Key performance indicators including Total Yield (Liters), Record Count, Milking Animals Count, Average Yield per Record, Session Breakdown (Morning, Afternoon, Evening totals), and Weighted Average Fat & SNF percentages.
- Stream file downloads directly with appropriate MIME types (`text/csv` and `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`) and dynamic `Content-Disposition: attachment; filename="<farm-slug>-milk-production-<startDate>-to-<endDate>.<ext>"` headers.

---

## 3. Architectural & Design Trade-offs

### Option A: Synchronous Direct Memory Streaming via `xlsx` (Selected Approach)
- **Mechanism**: The backend executes an indexed query with a safety boundary ($\le 10,000$ records), generates the CSV string or XLSX binary buffer in-memory using the existing `xlsx` library, and streams the buffer directly to the HTTP response with `StreamableFile`.
- **Pros**:
  - Instant user feedback: the browser triggers a native file download immediately upon button click.
  - Zero cloud storage overhead: no transient S3/R2 file upload, presigned URL generation, or background queue orchestration needed for standard export ranges.
  - Highly memory efficient: 10,000 rows in `xlsx` require $< 15\,\text{MB}$ heap allocation and serialize in $< 120\,\text{ms}$.
  - Simple, robust error handling: query validation failures immediately return 400/422 status codes with clear error messages.
- **Cons**:
  - Unbounded exports could cause excessive memory usage if unlimited.
  - **Mitigation**: Strict validation enforces `limit <= 10000` and date boundaries.

### Option B: Asynchronous Background BullMQ Worker + S3 Presigned URL
- **Mechanism**: Enqueue export job in Redis, worker compiles file, writes to S3, sends notification with presigned download URL.
- **Trade-off Analysis**: Necessary for massive enterprise exports ($> 100,000$ rows) or PDF book generation. However, for milk production logs typically spanning 1 to 90 days (100 to 5,000 rows), introducing asynchronous polling adds significant UX friction (farmer must wait and refresh for download link).
- **Decision**: Adopt **Option A** for `GET /api/v1/milk-logs/export`. If future platform-wide multi-year exports require asynchronous processing, the domain service `IMilkExportService` can be reused directly inside a BullMQ worker.

---

## 4. Data Models, Schemas & API Contracts

### 4.1 Shared Types & Enums (`@vetralink/shared-types`)

#### `MilkExportFormat` Enum:
```typescript
export enum MilkExportFormat {
  CSV = "CSV",
  EXCEL = "EXCEL",
}
```

#### `ExportMilkLogsRequestDto`:
```typescript
export interface ExportMilkLogsRequestDto {
  readonly format?: MilkExportFormat; // Default: CSV
  readonly startDate?: string;        // YYYY-MM-DD
  readonly endDate?: string;          // YYYY-MM-DD
  readonly animalId?: string;         // UUID
  readonly session?: MilkSession;     // MORNING | AFTERNOON | EVENING
  readonly entryType?: "INDIVIDUAL" | "BULK" | "ALL"; // Default: ALL
  readonly limit?: number;            // Default: 5000, Max: 10000
}
```

### 4.2 Spreadsheet Schema & Column Layout

#### Sheet 1: Production Logs (`Production Logs`)
| Column Header | Field Source | Example Value | Formatting |
| :--- | :--- | :--- | :--- |
| **Log ID** | `id` | `a1b2c3d4-...` | Text |
| **Date** | `loggedDate` | `2026-09-13` | Date (`YYYY-MM-DD`) |
| **Session** | `session` | `MORNING` | Text |
| **Entry Type** | `isBulk` ? "BULK" : "INDIVIDUAL" | `INDIVIDUAL` | Text |
| **Animal Tag** | `animal.tagNumber` | `COW-042` | Text |
| **Animal Name** | `animal.name` | `Bella` | Text |
| **Species** | `animal.species` | `COW` | Text |
| **Breed** | `animal.breed` | `Holstein Friesian` | Text |
| **Yield (Liters)** | `yieldLiters` | `14.500` | Number (`0.000`) |
| **Fat %** | `fatPercent` | `3.80` | Number (`0.00` or `N/A`) |
| **SNF %** | `snfPercent` | `8.50` | Number (`0.00` or `N/A`) |
| **Recorded By** | `recordedBy.name` | `Dr. Tariq Rahman` | Text |
| **Recorded Email**| `recordedBy.email`| `tariq@vetralink.pro` | Text |
| **Sync Version** | `syncVersion` | `1` | Integer |
| **Created At** | `createdAt` | `2026-09-13 06:30:00`| Timestamp |

#### Sheet 2: Executive Summary (`Executive Summary`)
| Metric | Value |
| :--- | :--- |
| **Farm Tenant ID** | `farmId` |
| **Export Generated At** | ISO Timestamp |
| **Date Range** | `startDate` to `endDate` |
| **Total Records Exported** | Count of rows |
| **Total Milk Volume (L)** | Sum of `yieldLiters` |
| **Average Yield per Log (L)** | Mean of `yieldLiters` |
| **Morning Session Volume (L)** | Sum where `session === 'MORNING'` |
| **Afternoon Session Volume (L)**| Sum where `session === 'AFTERNOON'` |
| **Evening Session Volume (L)** | Sum where `session === 'EVENING'` |
| **Average Fat %** | Weighted / Arithmetic mean of non-null fat entries |
| **Average SNF %** | Weighted / Arithmetic mean of non-null snf entries |

---

## 5. Security, Authorization & Edge Cases

### Security & Multi-Tenancy
- **Authentication**: `JwtAuthGuard` checks valid JWT token.
- **Tenant Isolation**: `TenantGuard` and `@Tenant()` verify caller has active membership in the target farm specified by `x-farm-id` header.
- **Role Gating**: `@FarmRoles(FarmRole.OWNER, FarmRole.MANAGER, FarmRole.HERDSMAN, FarmRole.VET_STAFF)`.

### Edge Cases
1. **Empty Result Set**: If zero milk logs match the criteria, generate a valid CSV or Excel file containing the headers and an empty dataset, or a summary indicating 0 records. Never return a corrupt 0-byte file or 500 error.
2. **Invalid Date Ranges**: If `startDate > endDate`, throw a `ValidationDomainException` (422 Unprocessable Entity).
3. **Future Dates**: Disallow `startDate` or `endDate` beyond the current date + 1 day buffer.
4. **Max Limit Protection**: Clamp or reject queries exceeding 10,000 records with a clear validation error advising the user to narrow the date window.
5. **Special Characters in CSV**: Animal names, notes, or user names with commas, quotes, or newlines are escaped in accordance with RFC 4180.
