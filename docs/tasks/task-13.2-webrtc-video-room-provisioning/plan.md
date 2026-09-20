# Task 13.2 Execution Plan: WebRTC 1-on-1 Video Room Provisioning with Ephemeral Security Tokens

## 1. Prerequisites

- Phase 5 Sprint 12 & Task 13.1 completed and verified.
- Daily.co API key available via `EnvService` (`dailyApiKey`).
- `ConsultationRepository`, `AuditLogRepository`, and `PrismaService` available.

---

## 2. Implementation Steps

### Step 1: Shared Types & DTO Contracts
- [x] In `packages/shared-types`:
  - Define and export:
    - `VideoRoomDto`
    - `JoinVideoRoomDto`
    - `EndVideoRoomDto`
- [x] Build `@vetralink/shared-types`.

### Step 2: WebRTC Provider Layer (Daily.co & Mock)
- [x] Create `IVideoRoomProvider` interface in `apps/api/src/modules/consultations/providers/video-room-provider.interface.ts`:
  - `createRoom(params: CreateRoomParams): Promise<VideoRoomResult>`
  - `createMeetingToken(params: CreateMeetingTokenParams): Promise<MeetingTokenResult>`
  - `getRoom(roomName: string): Promise<VideoRoomResult | null>`
  - `deleteRoom(roomName: string): Promise<void>`
  - Token: `VIDEO_ROOM_PROVIDER`
- [x] Implement `DailyVideoRoomProvider` in `apps/api/src/modules/consultations/providers/daily-video-room.provider.ts`:
  - Interacts with Daily.co REST API (`https://api.daily.co/v1/rooms`, `https://api.daily.co/v1/meeting-tokens`).
  - Fallback to mock behavior if `dailyApiKey` is not configured.
- [x] Implement `MockVideoRoomProvider` in `apps/api/src/modules/consultations/providers/mock-video-room.provider.ts`:
  - In-memory deterministic mock for testing.

### Step 3: Domain Entity & Service Layer
- [x] Update `ConsultationEntity`:
  - Add `setRoomSessionId(roomSessionId: string)` invariant method.
- [x] Create `IVideoRoomService` interface in `apps/api/src/modules/consultations/services/video-room.service.interface.ts`:
  - `provisionVideoRoom(consultationId: string, requestingUser: JwtPayload, traceId?: string): Promise<VideoRoomDto>`
  - `joinVideoRoom(consultationId: string, requestingUser: JwtPayload, traceId?: string): Promise<JoinVideoRoomDto>`
  - `endVideoRoom(consultationId: string, requestingUser: JwtPayload, traceId?: string): Promise<EndVideoRoomDto>`
  - Token: `VIDEO_ROOM_SERVICE`
- [x] Implement `VideoRoomService` in `apps/api/src/modules/consultations/services/video-room.service.ts`:
  - Gate checks: `LIVE_VIDEO` type, payment authorized, active consultation status (`ASSIGNED` or `IN_PROGRESS`).
  - Strict 1-on-1: `max_participants: 2`.
  - Ephemeral meeting token issuance (2h TTL) with doctor ownership (`isOwner: true` for vet/admin, `false` for farmer).
  - Room teardown upon session conclusion.
  - Structured audit logging (`CONSULTATION_ROOM_PROVISIONED`, `CONSULTATION_ROOM_JOINED`, `CONSULTATION_ROOM_TERMINATED`).

### Step 4: Controller & API Routing
- [x] Create `VideoRoomController` in `apps/api/src/modules/consultations/controllers/video-room.controller.ts`:
  - `POST /consultations/:id/video-room/provision`: Provision or retrieve room.
  - `POST /consultations/:id/video-room/join`: Generate ephemeral meeting token for entry.
  - `POST /consultations/:id/video-room/end`: Conclude session and delete room.
  - Guards: `JwtAuthGuard`, `RolesGuard`.
  - Roles: `SUPER_ADMIN`, `ADMIN`, `VET`, `FARMER`.
  - OpenAPI / Swagger documentation.

### Step 5: Module Wiring
- [x] Update `ConsultationsModule` (`apps/api/src/modules/consultations/consultations.module.ts`):
  - Register `DailyVideoRoomProvider` (`VIDEO_ROOM_PROVIDER`).
  - Register `VideoRoomService` (`VIDEO_ROOM_SERVICE`).
  - Register `VideoRoomController`.
  - Export providers and services.

### Step 6: Unit & Integration Tests
- [x] Write `video-room.service.spec.ts`:
  - Test room provisioning with payment gate and type checks.
  - Test ephemeral token generation with role assignment (doctor isOwner: true vs farmer isOwner: false).
  - Test room teardown and audit logging.
  - Test error handling (unauthorized user, async ticket rejection, unpaid consultation).
- [x] Write `video-room.controller.spec.ts`:
  - Test endpoint routing, guards, and parameter pipes.
- [x] Run test suite (`pnpm test`) and build verification (`pnpm build`).

---

## 3. Verification & Acceptance Criteria

- [x] All unit tests pass with >80% coverage.
- [x] Strict 1-on-1 room creation with `max_participants: 2` verified.
- [x] Ephemeral security token contains valid expiration and role claims.
- [x] Gating checks correctly reject unpaid or non-video consultations.
- [x] Full build succeeds with zero TypeScript errors.
