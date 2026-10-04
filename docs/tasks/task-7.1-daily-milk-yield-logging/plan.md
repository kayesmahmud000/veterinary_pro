# PLAN-701: Step-by-Step Execution Plan for Task 7.1

## Prerequisites
- PostgreSQL 16 running and seeded.
- Prisma schema already contains `MilkLog` and `MilkSession` models.
- Turborepo workspace dependencies built (`pnpm build`).

---

## Granular Implementation Checklist

### Step 1: Shared Types & DTO Contracts (`packages/shared-types`)
- [x] `1.1`: Create `packages/shared-types/src/dto/milk-logs/` directory.
- [x] `1.2`: Define `CreateMilkLogDto` and request interface with validation decorators (`@IsUUID`, `@IsEnum`, `@IsNumber`, `@Min`, `@Max`, `@IsDateString`, `@IsOptional`).
- [x] `1.3`: Define `UpdateMilkLogDto` with partial properties.
- [x] `1.4`: Define `MilkLogQueryDto` for filtering (`startDate`, `endDate`, `animalId`, `session`, `page`, `limit`).
- [x] `1.5`: Define `MilkLogResponseDto` and `PaginatedMilkLogsDto`.
- [x] `1.6`: Export new DTOs in `packages/shared-types/src/dto/index.ts` and `packages/shared-types/src/index.ts`.
- [x] `1.7`: Compile and verify shared types package (`pnpm --filter @vetralink/shared-types build`).

### Step 2: Domain Entity & Repository Layer (`apps/api/src/modules/milk-logs/`)
- [x] `2.1`: Create `MilkLogEntity` in `apps/api/src/modules/milk-logs/entities/milk-log.entity.ts` (pure domain class, no ORM decorators).
- [x] `2.2`: Create `IMilkLogRepository` interface in `apps/api/src/modules/milk-logs/repositories/milk-log.repository.interface.ts`.
- [x] `2.3`: Implement `MilkLogRepository` in `apps/api/src/modules/milk-logs/repositories/milk-log.repository.ts` wrapping `PrismaService`, strictly scoping every query by `farmId`.
- [x] `2.4`: Implement repository methods: `create`, `findById`, `findBySessionAndDate`, `findManyWithPagination`, `update`, `delete`.

### Step 3: Domain Service & Business Logic
- [x] `3.1`: Create `IMilkLogService` interface in `apps/api/src/modules/milk-logs/services/milk-log.service.interface.ts`.
- [x] `3.2`: Implement `MilkLogService` in `apps/api/src/modules/milk-logs/services/milk-log.service.ts`:
  - Enforce tenant verification (`farmId`).
  - Validate animal exists, is active, is female, and belongs to a dairy/mammalian species.
  - Check for duplicate session entry on `[farmId, animalId, loggedDate, session]` -> throw `ConflictException`.
  - Validate yield bounds (0.001 to 100.000 L).
  - Validate fat % and SNF % boundaries (0.00 to 20.00%).
  - Record audit log entry inside transaction for create/update/delete.
  - Implement pagination with sorting by `loggedDate DESC, session ASC`.

### Step 4: Controller & API Routing
- [x] `4.1`: Implement `MilkLogsController` in `apps/api/src/modules/milk-logs/milk-logs.controller.ts`:
  - Route: `/api/v1/milk-logs`
  - Decorators: `@ApiTags('Milk Logs')`, `@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard)`, `@Tenant()`, `@ApiBearerAuth()`.
  - Endpoints:
    - `POST /` -> Log session milk yield.
    - `GET /` -> List milk logs with filters and pagination.
    - `GET /:id` -> Retrieve milk log by ID.
    - `PATCH /:id` -> Update milk log.
    - `DELETE /:id` -> Delete milk log.
- [x] `4.2`: Create `MilkLogsModule` in `apps/api/src/modules/milk-logs/milk-logs.module.ts`.
- [x] `4.3`: Register `MilkLogsModule` in `apps/api/src/app.module.ts`.

### Step 5: Unit & Integration Tests
- [x] `5.1`: Create unit tests in `apps/api/src/modules/milk-logs/services/milk-log.service.spec.ts` mocking repository and audit service.
- [x] `5.2`: Test biological validation failures (male animal, deceased animal, poultry species, excessive yield).
- [x] `5.3`: Test duplicate session conflict detection.
- [x] `5.4`: Create controller unit tests in `apps/api/src/modules/milk-logs/milk-logs.controller.spec.ts`.
- [x] `5.5`: Run Jest test suite (`pnpm --filter @vetralink/api test`).

---

## Verification & Acceptance Criteria

### 1. Unit Test Coverage
- `MilkLogService` line coverage >= 85%.
- `MilkLogsController` unit test suite passes with zero errors.

### 2. Manual Verification via cURL

#### A. Record Morning Milk Yield (Success)
```bash
curl -X POST http://localhost:3001/api/v1/milk-logs \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "x-farm-id: $FARM_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "animalId": "'$FEMALE_COW_ID'",
    "session": "MORNING",
    "yieldLiters": 14.5,
    "fatPercent": 3.8,
    "snfPercent": 8.5,
    "loggedDate": "2026-09-13"
  }'
```
**Expected Response**: `201 Created` with standard `ApiResponse<MilkLogResponseDto>` envelope.

#### B. Reject Duplicate Entry for Same Session (Conflict)
```bash
curl -X POST http://localhost:3001/api/v1/milk-logs \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "x-farm-id: $FARM_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "animalId": "'$FEMALE_COW_ID'",
    "session": "MORNING",
    "yieldLiters": 15.0,
    "loggedDate": "2026-09-13"
  }'
```
**Expected Response**: `409 Conflict` ("Milk log for this animal, date, and session already exists").

#### C. Reject Male Animal (Biological Validation)
```bash
curl -X POST http://localhost:3001/api/v1/milk-logs \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "x-farm-id: $FARM_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "animalId": "'$BULL_ID'",
    "session": "MORNING",
    "yieldLiters": 5.0,
    "loggedDate": "2026-09-13"
  }'
```
**Expected Response**: `422 Unprocessable Entity` ("Cannot log milk yield for male or non-milking animal").

#### D. List and Filter Milk Logs with Pagination
```bash
curl -X GET "http://localhost:3001/api/v1/milk-logs?startDate=2026-09-01&endDate=2026-09-13&session=MORNING&page=1&limit=20" \
  -H "Authorization: Bearer $JWT_TOKEN" \
  -H "x-farm-id: $FARM_ID"
```
**Expected Response**: `200 OK` with paginated array and pagination metadata.
