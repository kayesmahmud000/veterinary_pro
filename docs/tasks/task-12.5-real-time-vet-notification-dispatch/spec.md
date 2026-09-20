# Task 12.5 Specification: Real-Time Notification Dispatch to Assigned Veterinarian

## 1. Feature Overview & Objective

In the VETRALINK PRO Tele-Veterinary platform, when a triage case is assigned to a veterinarian (either through manual triage assignment or through the automated matching algorithm), immediate awareness by the veterinarian is essential to ensure prompt triage response times and timely preparation for live video sessions.

**Task 12.5** implements the **Real-Time Notification Dispatch Engine** for assigned veterinarians:
1. **Multi-Channel Dispatch**:
   - **In-App / Server-Sent Events (SSE)**: Real-time event push directly to the veterinarian's active web portal or mobile app session via RxJS event streams.
   - **Push Notification (`PUSH`)**: Mobile/Web push notification with high-priority alert, deep-link payload to consultation EHR, and chief complaint snippet.
   - **SMS Alert (`SMS`)**: High-priority SMS alert sent to the veterinarian's registered mobile phone (essential for emergency/critical triage cases and upcoming live video appointments).
   - **Email Summary (`EMAIL`)**: Rich transactional email containing case overview, animal species, tag number, farmer information, appointment time, and direct consultation portal link.
2. **Automated Trigger on Assignment**:
   - Seamlessly triggered within `VetAssignmentService.assignToVet()` (which powers both manual assignment and `autoAssign()`).
   - Resilient execution: Notification failures do not roll back the database assignment; all channel delivery statuses (`SENT` or `FAILED`) are captured and logged.
3. **Audit Trail & Delivery Persistence**:
   - Persistent `ConsultationNotificationLog` records capturing channel, message content, delivery status, error reasons, and timestamps.
   - Full integration with `AuditLogRepository` for compliance and observability.
4. **Veterinarian Notification Feed & SSE Streaming**:
   - `GET /consultations/vets/:vetId/notifications`: Paginated notification history with read/unread tracking.
   - `PATCH /consultations/vets/:vetId/notifications/:notificationId/read`: Mark notification as read.
   - `GET /consultations/vets/:vetId/notifications/stream` (SSE): Real-time event stream for live client updates.
   - `POST /consultations/:id/notify-vet`: Manual re-dispatch trigger for triage officers and clinic administrators.

---

## 2. Current State vs. Proposed State

### Current State
- `VetAssignmentService.assignToVet()` updates `consultation.vetId`, sets status to `ASSIGNED`, and records an audit log.
- However, no notification is sent to the veterinarian. The assigned veterinarian remains unaware of the new case unless they manually refresh the portal.
- No notification log entity or SSE streaming mechanism exists for tele-vet consultations.

### Proposed State
- **Database Schema**:
  - Add `ConsultationNotificationChannel` enum (`PUSH`, `SMS`, `EMAIL`, `IN_APP`).
  - Add `ConsultationNotificationStatus` enum (`PENDING`, `SENT`, `FAILED`).
  - Add `ConsultationNotificationLog` model with indexes on `[vetId, dispatchedAt]`, `[consultationId]`, and `[vetId, readAt]`.
- **Shared Types (`packages/shared-types`)**:
  - Add notification enums and DTOs: `ConsultationNotificationLogDto`, `NotifyVetDto`, `ConsultationNotificationResultDto`, `QueryVetNotificationsDto`, `PaginatedVetNotificationsDto`.
- **Domain Service & Engine**:
  - `IConsultationNotificationService` and `ConsultationNotificationService`:
    - Dispatches across `PUSH`, `SMS`, `EMAIL`, and `IN_APP` channels.
    - Emits real-time SSE events via RxJS Subject.
    - Persists logs in `ConsultationNotificationLogRepository`.
  - Wire into `VetAssignmentService.assignToVet()` so every assignment automatically dispatches notifications.
- **REST & SSE Endpoints**:
  - `POST /consultations/:id/notify-vet`: Re-dispatch or custom notification trigger.
  - `GET /consultations/vets/:vetId/notifications`: View notification history.
  - `PATCH /consultations/vets/:vetId/notifications/:id/read`: Mark notification read.
  - `GET /consultations/vets/:vetId/notifications/stream`: SSE real-time event stream.

---

## 3. Architectural & Design Trade-offs

| Architectural Decision | Option A | Option B (Selected) | Technical Justification |
| :--- | :--- | :--- | :--- |
| **Real-Time Delivery Mechanism** | WebSocket Gateway (`@WebSocketGateway` / Socket.io). | Server-Sent Events (`@Sse()` + RxJS `Observable`) + Multi-Channel Push/SMS/Email. | **Selected: Option B**. SSE operates over standard HTTP/2, requires no WebSocket handshake or complex connection state management, passes through corporate/firewall proxies reliably, and is natively supported by NestJS `@Sse()` and modern web/mobile fetch APIs. |
| **Dispatch Resiliency** | Synchronous blocking calls to SMS/Email providers during assignment transaction. | Non-blocking multi-channel dispatch with per-channel error isolation and logging. | **Selected: Option B**. Prevents external network latencies (e.g. Twilio, Resend) from slowing down the triage assignment HTTP response or causing database rollbacks if a notification provider temporarily fails. |
| **Notification History Storage** | Ephemeral cache in Redis only. | Persistent PostgreSQL `ConsultationNotificationLog` table + Redis/RxJS event streaming. | **Selected: Option B**. Guarantees clinical compliance, unread badge counters across restarts, and full auditability of when a veterinarian was notified about a critical case. |

---

## 4. Data Models & Contracts

### Prisma Schema Additions

```prisma
enum ConsultationNotificationChannel {
  PUSH
  SMS
  EMAIL
  IN_APP
}

enum ConsultationNotificationStatus {
  PENDING
  SENT
  FAILED
}

model ConsultationNotificationLog {
  id             String                          @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  consultationId String                          @map("consultation_id") @db.Uuid
  vetId          String                          @map("vet_id") @db.Uuid
  channel        ConsultationNotificationChannel
  status         ConsultationNotificationStatus  @default(SENT)
  title          String                          @db.VarChar(255)
  message        String                          @db.Text
  errorMessage   String?                         @map("error_message") @db.Text
  metadata       Json                            @default("{}")
  readAt         DateTime?                       @map("read_at") @db.Timestamptz(6)
  dispatchedAt   DateTime                        @default(now()) @map("dispatched_at") @db.Timestamptz(6)

  consultation Consultation @relation(fields: [consultationId], references: [id], onDelete: Cascade)
  vet          User         @relation(fields: [vetId], references: [id], onDelete: Cascade)

  @@index([vetId, dispatchedAt(sort: Desc)])
  @@index([consultationId])
  @@index([vetId, readAt])
  @@map("consultation_notification_logs")
}
```

### Shared Types (`packages/shared-types`)

```typescript
export enum ConsultationNotificationChannel {
  PUSH = "PUSH",
  SMS = "SMS",
  EMAIL = "EMAIL",
  IN_APP = "IN_APP",
}

export enum ConsultationNotificationStatus {
  PENDING = "PENDING",
  SENT = "SENT",
  FAILED = "FAILED",
}

export interface ConsultationNotificationLogDto {
  id: string;
  consultationId: string;
  vetId: string;
  channel: ConsultationNotificationChannel;
  status: ConsultationNotificationStatus;
  title: string;
  message: string;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
  readAt?: string | null;
  dispatchedAt: string;
}

export interface NotifyVetDto {
  channels?: ConsultationNotificationChannel[];
  customNote?: string;
}

export interface ChannelDeliveryResultDto {
  channel: ConsultationNotificationChannel;
  status: ConsultationNotificationStatus;
  messageId?: string;
  error?: string;
}

export interface ConsultationNotificationResultDto {
  consultationId: string;
  vetId: string;
  channels: ChannelDeliveryResultDto[];
  dispatchedAt: string;
}

export interface QueryVetNotificationsDto {
  page?: number;
  limit?: number;
  channel?: ConsultationNotificationChannel;
  unreadOnly?: boolean;
}

export interface PaginatedVetNotificationsDto {
  items: ConsultationNotificationLogDto[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    unreadCount: number;
  };
}
```

---

## 5. Security & Edge Cases

1. **Authorization & RBAC**:
   - `POST /consultations/:id/notify-vet` is restricted to `ADMIN`, `SUPER_ADMIN`, and `VET`.
   - `GET /consultations/vets/:vetId/notifications` and the SSE stream can only be accessed by the veterinarian themselves or administrators.
2. **Missing Contact Info (Phone / Email)**:
   - If the veterinarian does not have a verified phone number, the SMS channel is gracefully marked as `FAILED` with reason `"No phone number configured"` without interrupting `PUSH`, `EMAIL`, or `IN_APP` dispatch.
3. **Idempotency & Rate Limiting**:
   - Consecutive manual re-dispatches are logged with distinct timestamps and audit trails.
4. **SSE Reconnection & Resiliency**:
   - SSE stream sends keep-alive heartbeats every 30 seconds and automatically reconnects upon network drops.
5. **Decryption of PII (Phone)**:
   - Vet phone numbers are securely decrypted from AES-256-GCM ciphertext when preparing SMS dispatch payloads.
