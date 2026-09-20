# Task 12.5 Execution Plan: Real-Time Notification Dispatch to Assigned Veterinarian

## 1. Prerequisites

- Sprint 12 Tasks 12.1–12.4 completed and verified.
- PostgreSQL Prisma schema and database connection available.
- Notification providers (`IPushNotificationProvider`, `ISmsNotificationProvider`, `IMailService`) available for injection.

---

## 2. Implementation Steps

### Step 1: Database Schema & Migration Update
- [x] Update `apps/api/prisma/schema.prisma` with:
  - `ConsultationNotificationChannel` enum (`PUSH`, `SMS`, `EMAIL`, `IN_APP`)
  - `ConsultationNotificationStatus` enum (`PENDING`, `SENT`, `FAILED`)
  - `ConsultationNotificationLog` model with composite indexes
  - Relations on `User` and `Consultation`
- [x] Run `prisma generate` to update `@prisma/client`.

### Step 2: Shared Types & DTO Contracts
- [x] Update `packages/shared-types`:
  - Export enums `ConsultationNotificationChannel`, `ConsultationNotificationStatus`
  - Export interfaces `ConsultationNotificationLogDto`, `NotifyVetDto`, `ChannelDeliveryResultDto`, `ConsultationNotificationResultDto`, `QueryVetNotificationsDto`, `PaginatedVetNotificationsDto`
- [x] Rebuild `packages/shared-types`.

### Step 3: Domain Entity & Repository Layer
- [x] Create `ConsultationNotificationLogEntity` in `apps/api/src/modules/consultations/entities/`:
  - Pure domain entity with factory `create()` and `fromPersistence()` methods.
  - Serialization to `ConsultationNotificationLogDto`.
  - Invariant methods: `markAsRead()`, `markFailed()`.
- [x] Create `IConsultationNotificationLogRepository` interface:
  - `create(entity: ConsultationNotificationLogEntity): Promise<ConsultationNotificationLogEntity>`
  - `findById(id: string): Promise<ConsultationNotificationLogEntity | null>`
  - `save(entity: ConsultationNotificationLogEntity): Promise<ConsultationNotificationLogEntity>`
  - `findByVet(vetId: string, query: QueryVetNotificationsDto): Promise<{ items: ConsultationNotificationLogEntity[]; total: number; unreadCount: number }>`
- [x] Implement `ConsultationNotificationLogRepository` wrapping `PrismaService`.

### Step 4: Notification Service & Real-Time SSE Dispatch
- [x] Define `IConsultationNotificationService` interface:
  - `dispatchAssignmentNotification(consultationId: string, vetId: string, options?: NotifyVetDto & { traceId?: string }): Promise<ConsultationNotificationResultDto>`
  - `getVetNotifications(vetId: string, query: QueryVetNotificationsDto): Promise<PaginatedVetNotificationsDto>`
  - `markAsRead(notificationId: string, vetId: string): Promise<ConsultationNotificationLogDto>`
  - `getNotificationStream(vetId: string): Observable<MessageEvent>`
- [x] Implement `ConsultationNotificationService`:
  - Multi-channel delivery: `IN_APP`, `PUSH`, `SMS`, `EMAIL`.
  - Format professional clinical messages with case details, animal tag/species, chief complaint, and scheduled appointment time.
  - Publish real-time events to RxJS `Subject` for active SSE connections.
  - Decrypt phone numbers via `EncryptionService` for SMS dispatch.
  - Record each channel delivery in `ConsultationNotificationLogRepository`.
  - Emit audit log entries for notification dispatches.
- [x] Wire `ConsultationNotificationService` into `VetAssignmentService.assignToVet()` so manual and auto assignments dispatch notifications automatically.

### Step 5: Controller & REST / SSE Endpoints
- [x] Create `ConsultationNotificationController`:
  - `POST /consultations/:id/notify-vet`: Manually trigger or resend notifications with optional custom notes.
  - `GET /consultations/vets/:vetId/notifications`: Paginated notification history with unread count.
  - `PATCH /consultations/vets/:vetId/notifications/:id/read`: Mark notification as read.
  - `Sse /consultations/vets/:vetId/notifications/stream`: Server-Sent Events stream delivering real-time notification events.
- [x] Update `ConsultationsModule` to register new repositories, services, and controllers.

### Step 6: Unit & Integration Tests
- [x] Write `consultation-notification.service.spec.ts` covering:
  - Multi-channel dispatch (PUSH, SMS, EMAIL, IN_APP).
  - SSE stream emission.
  - Error isolation when an external provider fails.
  - Read status toggling and pagination.
- [x] Write `consultation-notification.controller.spec.ts` covering:
  - Endpoint routing, role-based guard assertions, and SSE stream formatting.
- [x] Update `vet-assignment.service.spec.ts` to assert that assigning a vet invokes notification dispatch.
- [x] Run test suite (`pnpm test`) and build verification.

---

## 3. Verification & Acceptance Criteria

- [x] All unit tests pass (`pnpm test`).
- [x] Database schema compiles cleanly via `prisma generate`.
- [x] Manual and auto-assignment dispatch multi-channel notifications to the assigned veterinarian.
- [x] SSE stream delivers events to connected subscribers.
- [x] Notification logs and unread counts persist correctly.
