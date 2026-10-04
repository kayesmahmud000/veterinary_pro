# Task 13.3 Specification: WebSocket-Driven Real-Time Chat Channel with Media Sharing

## 1. Feature Overview & Objective

In veterinary telemedicine, synchronous textual communication and immediate clinical media exchange (photos of lesions, wounds, animal behavior videos, lab reports) are crucial during both live consultations and ongoing triage cases. 

While WebRTC video rooms (Task 13.2) handle the high-bandwidth audio/video stream, a persistent, low-latency WebSocket chat channel is required to:
1. Provide in-consultation real-time messaging between the attending veterinarian and the client farmer/caretakers.
2. Support rich media attachments (images, clinical videos, PDF diagnostic reports) through secure presigned S3 uploads.
3. Maintain an immutable, persistent chat log linked to the consultation for historical audits and animal Electronic Health Record (EHR) traceability.
4. Support real-time typing indicators, read receipts, and presence tracking (`user_joined`, `user_left`).
5. Provide REST fallback endpoints for paginated history retrieval, offline message synchronization, and HTTP-only clients.

---

## 2. Current State vs. Proposed State

### Current State
- `Consultation` entity exists with `status`, `feeCents`, `paymentStatus`, `roomSessionId`, `chiefComplaint`, and initial submission `mediaUrls`.
- Video rooms are provisioned via Daily.co / mock provider (Task 13.2).
- There is NO persistent chat messaging model in Prisma schema or domain layer.
- There are NO WebSocket gateways in the API for bidirectional messaging or room-based chat dispatch.
- Media uploads for consultation chat attachments are not currently provisioned with dedicated presigned S3 endpoints.

### Proposed State
- **Prisma Schema & Database**:
  - Add `ConsultationMessage` model mapped to `consultation_messages` table with UUID primary key, `consultationId`, `senderId`, `content`, `mediaUrls` (JSON array of attachment metadata), `messageType` enum (`TEXT`, `IMAGE`, `VIDEO`, `AUDIO`, `DOCUMENT`, `SYSTEM`), `readAt`, `createdAt`, `updatedAt`.
  - Add composite index on `[consultationId, createdAt(sort: Asc)]` and index on `[senderId]`.
  - Migration script created and Prisma client regenerated.
- **Shared Types (`packages/shared-types`)**:
  - `ConsultationMessageType` enum: `TEXT`, `IMAGE`, `VIDEO`, `AUDIO`, `DOCUMENT`, `SYSTEM`.
  - DTOs: `ConsultationMessageDto`, `CreateConsultationMessageDto`, `QueryConsultationMessagesDto`, `MarkMessagesReadDto`, `ChatMediaUploadUrlDto`, `ChatMediaUploadResponseDto`.
  - Socket.io event interfaces: `ChatClientToServerEvents`, `ChatServerToClientEvents`.
- **Domain Layer**:
  - `ConsultationMessageEntity` with encapsulation of invariant rules (validation of message sender, content trimming, media URL binding, read receipt marking).
  - `IConsultationMessageRepository` and `ConsultationMessageRepository` (paginated retrieval, creation, bulk mark as read).
- **Service Layer**:
  - `IConsultationChatService` and `ConsultationChatService`:
    - Validates consultation existence and participant authorization (vet, farmer, farm member, admin).
    - Checks consultation state (messaging allowed in `ASSIGNED`, `IN_PROGRESS`, and read-only in `COMPLETED`).
    - Persists messages and emits real-time events to the consultation room.
    - Generates presigned S3 upload URLs for chat media attachments (`consultations/:id/chat/:fileId`).
    - Handles message read receipts.
- **WebSocket Gateway**:
  - `ConsultationChatGateway` using `@WebSocketGateway({ namespace: '/consultations', cors: true })`:
    - Authenticates connections via JWT extraction from handshake headers / auth object / query.
    - Manages room subscriptions (`consultation:{id}`).
    - Handles events: `join_room`, `leave_room`, `send_message`, `typing_indicator`, `mark_as_read`.
    - Emits: `user_joined`, `user_left`, `new_message`, `user_typing`, `messages_read`, `error`.
- **REST Controller**:
  - `ConsultationChatController`:
    - `GET /consultations/:id/messages` (paginated chat history).
    - `POST /consultations/:id/messages` (HTTP fallback message sending, triggers WS broadcast).
    - `POST /consultations/:id/messages/media-upload-url` (presigned S3 upload URL generation).
    - `PATCH /consultations/:id/messages/read` (mark messages as read).

---

## 3. Architectural & Design Trade-offs

| Architectural Decision | Option A: HTTP Polling / Server-Sent Events (SSE) | Option B: Socket.io WebSocket Gateway (Chosen) | Justification |
| :--- | :--- | :--- | :--- |
| **Real-time Transport** | Client polls or listens to SSE, sends via HTTP POST | Bidirectional WebSockets with Socket.io room abstractions | Socket.io provides native room scoping (`consultation:{id}`), connection lifecycle events, automatic reconnection, and sub-millisecond bidirectional latency for typing indicators and messages. |
| **Media Handling** | Base64 encoded payload in WebSocket message | Presigned S3 direct upload + URL references (Chosen) | Base64 in WebSocket messages congests the Node.js event loop and socket buffers. Direct S3 presigned PUT offloads file transfer to AWS S3/MinIO, keeping the API and WS server lightweight. |
| **Persistence Strategy** | Store in Redis and batch write to PostgreSQL | Direct ACID write to PostgreSQL + WS Broadcast (Chosen) | Veterinary consultations generate moderate message volumes (dozens to hundreds per session, not millions). Direct PostgreSQL persistence guarantees immediate durability, auditability, and foreign key integrity with EHR. |
| **Dual Access (WS + REST)**| WebSocket only | Hybrid WS + REST Endpoints (Chosen) | Provides full real-time interactive UX via WebSockets while allowing mobile offline queues, paginated scroll-back history, and audit log exports via REST endpoints. |

---

## 4. Data Models & Contracts

### 4.1 Prisma Schema

```prisma
enum ConsultationMessageType {
  TEXT
  IMAGE
  VIDEO
  AUDIO
  DOCUMENT
  SYSTEM
}

model ConsultationMessage {
  id             String                  @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  consultationId String                  @map("consultation_id") @db.Uuid
  senderId       String                  @map("sender_id") @db.Uuid
  content        String                  @db.Text
  mediaUrls      Json                    @default("[]") @map("media_urls")
  messageType    ConsultationMessageType @default(TEXT) @map("message_type")
  readAt         DateTime?               @map("read_at") @db.Timestamptz(6)
  createdAt      DateTime                @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime                @default(now()) @updatedAt @map("updated_at") @db.Timestamptz(6)

  consultation Consultation @relation(fields: [consultationId], references: [id], onDelete: Cascade)
  sender       User         @relation("SentConsultationMessages", fields: [senderId], references: [id], onDelete: Restrict)

  @@index([consultationId, createdAt])
  @@index([senderId])
  @@map("consultation_messages")
}
```

### 4.2 Shared DTOs & Contracts

```typescript
export interface ChatMediaAttachment {
  url: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

export interface ConsultationMessageDto {
  id: string;
  consultationId: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  content: string;
  mediaUrls: ChatMediaAttachment[];
  messageType: ConsultationMessageType;
  readAt?: string | null;
  createdAt: string;
}

export interface CreateConsultationMessageDto {
  content: string;
  mediaUrls?: ChatMediaAttachment[];
  messageType?: ConsultationMessageType;
}

export interface QueryConsultationMessagesDto {
  page?: number;
  limit?: number;
  before?: string;
}

export interface MarkMessagesReadDto {
  messageIds: string[];
}

export interface ChatMediaUploadUrlDto {
  fileName: string;
  contentType: string;
  fileSizeBytes: number;
}

export interface ChatMediaUploadResponseDto {
  uploadUrl: string;
  mediaUrl: string;
  s3Key: string;
  expiresInSeconds: number;
}
```

### 4.3 WebSocket Event Contracts

```typescript
export interface ClientToServerEvents {
  join_room: (data: { consultationId: string }) => void;
  leave_room: (data: { consultationId: string }) => void;
  send_message: (data: { consultationId: string; content: string; mediaUrls?: ChatMediaAttachment[]; messageType?: ConsultationMessageType }) => void;
  typing_indicator: (data: { consultationId: string; isTyping: boolean }) => void;
  mark_as_read: (data: { consultationId: string; messageIds: string[] }) => void;
}

export interface ServerToClientEvents {
  user_joined: (data: { userId: string; role: string }) => void;
  user_left: (data: { userId: string }) => void;
  new_message: (message: ConsultationMessageDto) => void;
  user_typing: (data: { userId: string; isTyping: boolean }) => void;
  messages_read: (data: { userId: string; readAt: string; messageIds: string[] }) => void;
  error: (data: { message: string; code?: string }) => void;
}
```

---

## 5. Security & Edge Cases

1. **Authentication & Authorization**:
   - Connection handshake checks JWT authenticity using `JwtService` with platform public/secret key.
   - Socket room access (`join_room`, `send_message`) validates that `requestingUser.sub` is either:
     - The assigned veterinarian (`consultation.vetId === sub`).
     - The consultation farmer (`consultation.farmerId === sub`).
     - A member of the consultation's farm (`farm_members` record).
     - A platform administrator (`ADMIN` or `SUPER_ADMIN`).
2. **Consultation Lifecycle Gating**:
   - Sending new messages is permitted only when consultation status is `ASSIGNED` or `IN_PROGRESS`.
   - In `COMPLETED` or `CANCELLED` status, the chat channel is read-only (message history can be retrieved, but new messages are rejected with `ValidationDomainException`).
3. **Media Attachment Security**:
   - Presigned upload URLs restrict `Content-Type` to allowed MIME types: `image/jpeg`, `image/png`, `image/webp`, `video/mp4`, `video/quicktime`, `audio/mpeg`, `application/pdf`.
   - Max attachment file size: 25 MB per media file.
   - S3 keys are scoped under `consultations/<consultationId>/chat/<uuid>-<filename>`.
4. **Resilience & Concurrency**:
   - Socket disconnection cleanly unsubscribes from rooms and broadcasts `user_left` presence.
   - Messages are saved to PostgreSQL within proper repository transaction isolation.
   - Audit logs recorded for chat room entry and media attachments.
