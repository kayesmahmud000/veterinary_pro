# Task 13.3 Execution Plan: WebSocket-Driven Real-Time Chat Channel with Media Sharing

## 1. Prerequisites

- Phase 5 Sprint 12 & Task 13.1, 13.2 completed and verified.
- `@nestjs/websockets`, `@nestjs/platform-socket.io`, and `socket.io` installed.
- PostgreSQL database running and Prisma schema updated with `ConsultationMessage` model and `ConsultationMessageType` enum.
- `IS3StorageService` available for presigned media upload generation.

---

## 2. Implementation Steps

### Step 1: Dependencies & Database Schema
- [x] Install WebSocket dependencies in `apps/api`:
  - `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io`.
- [x] Update `apps/api/prisma/schema.prisma`:
  - Add `ConsultationMessageType` enum (`TEXT`, `IMAGE`, `VIDEO`, `AUDIO`, `DOCUMENT`, `SYSTEM`).
  - Add `ConsultationMessage` model with foreign keys to `Consultation` and `User`.
  - Add relations to `Consultation` (`messages`) and `User` (`sentConsultationMessages`).
- [x] Create database migration SQL and regenerate Prisma Client (`prisma generate`).

### Step 2: Shared Types & DTO Contracts (`packages/shared-types`)
- [x] Update `packages/shared-types`:
  - Add `ConsultationMessageType` enum to `src/enums/index.ts`.
  - Add DTOs in `src/dto/consultations/consultation-chat.dto.ts`:
    - `ChatMediaAttachment`
    - `ConsultationMessageDto`
    - `CreateConsultationMessageDto`
    - `QueryConsultationMessagesDto`
    - `MarkMessagesReadDto`
    - `ChatMediaUploadUrlDto`
    - `ChatMediaUploadResponseDto`
    - `ChatClientToServerEvents`
    - `ChatServerToClientEvents`
  - Export from `src/dto/consultations/index.ts` and `src/index.ts`.
- [x] Build `@vetralink/shared-types` via `pnpm --filter @vetralink/shared-types build`.

### Step 3: Domain Entity & Repository Layer
- [x] Create `ConsultationMessageEntity` in `apps/api/src/modules/consultations/entities/consultation-message.entity.ts`:
  - Invariant rules: trim content, validate sender, check media attachment structure, mark read status.
- [x] Create `IConsultationMessageRepository` interface in `apps/api/src/modules/consultations/repositories/consultation-message.repository.interface.ts`:
  - `create(entity: ConsultationMessageEntity): Promise<ConsultationMessageEntity>`
  - `findById(id: string): Promise<ConsultationMessageEntity | null>`
  - `findByConsultation(consultationId: string, page: number, limit: number, before?: Date): Promise<{ items: ConsultationMessageEntity[]; total: number }>`
  - `markAsRead(consultationId: string, messageIds: string[], readAt: Date): Promise<number>`
  - Token: `CONSULTATION_MESSAGE_REPOSITORY`
- [x] Implement `ConsultationMessageRepository` in `apps/api/src/modules/consultations/repositories/consultation-message.repository.ts`.

### Step 4: Domain Service Layer
- [x] Create `IConsultationChatService` interface in `apps/api/src/modules/consultations/services/consultation-chat.service.interface.ts`:
  - `sendMessage(consultationId: string, sender: JwtPayload, dto: CreateConsultationMessageDto, traceId?: string): Promise<ConsultationMessageDto>`
  - `getMessages(consultationId: string, requestingUser: JwtPayload, query: QueryConsultationMessagesDto): Promise<{ items: ConsultationMessageDto[]; total: number; page: number; limit: number }>`
  - `generateMediaUploadUrl(consultationId: string, requestingUser: JwtPayload, dto: ChatMediaUploadUrlDto): Promise<ChatMediaUploadResponseDto>`
  - `markMessagesRead(consultationId: string, requestingUser: JwtPayload, dto: MarkMessagesReadDto): Promise<{ updatedCount: number }>`
  - Token: `CONSULTATION_CHAT_SERVICE`
- [x] Implement `ConsultationChatService` in `apps/api/src/modules/consultations/services/consultation-chat.service.ts`:
  - Access validation: verify vet, farmer, farm member, or admin.
  - Lifecycle validation: reject sending to `COMPLETED` or `CANCELLED` consultations.
  - S3 presigned upload URL generation with MIME validation.
  - Read receipts update and audit logging.

### Step 5: WebSocket Gateway
- [x] Implement `ConsultationChatGateway` in `apps/api/src/modules/consultations/gateways/consultation-chat.gateway.ts`:
  - `@WebSocketGateway({ namespace: '/consultations', cors: { origin: '*' } })`
  - Connection handling with JWT handshake verification (`handleConnection`, `handleDisconnect`).
  - Event listeners:
    - `@SubscribeMessage('join_room')`
    - `@SubscribeMessage('leave_room')`
    - `@SubscribeMessage('send_message')`
    - `@SubscribeMessage('typing_indicator')`
    - `@SubscribeMessage('mark_as_read')`
  - Broadcast methods:
    - `broadcastToRoom(consultationId, event, data)`

### Step 6: REST Controller & Module Wiring
- [x] Implement `ConsultationChatController` in `apps/api/src/modules/consultations/controllers/consultation-chat.controller.ts`:
  - `GET /consultations/:id/messages`: Paginated message history.
  - `POST /consultations/:id/messages`: HTTP fallback to send message (triggers WS broadcast).
  - `POST /consultations/:id/messages/media-upload-url`: Presigned S3 upload URL.
  - `PATCH /consultations/:id/messages/read`: Mark messages as read.
  - Guards: `JwtAuthGuard`, `RolesGuard`.
  - Swagger / OpenAPI documentation.
- [x] Update `ConsultationsModule`:
  - Import `MediaModule` for `IS3StorageService`.
  - Register `ConsultationMessageRepository` (`CONSULTATION_MESSAGE_REPOSITORY`).
  - Register `ConsultationChatService` (`CONSULTATION_CHAT_SERVICE`).
  - Register `ConsultationChatGateway`.
  - Register `ConsultationChatController`.
  - Export service and repository.

### Step 7: Unit & Integration Tests Verification
- [x] Write `consultation-message.entity.spec.ts`.
- [x] Write `consultation-message.repository.spec.ts`.
- [x] Write `consultation-chat.service.spec.ts`.
- [x] Write `consultation-chat.gateway.spec.ts`.
- [x] Write `consultation-chat.controller.spec.ts`.
- [x] Run full test suite (`pnpm test`) and build verification (`pnpm build`).

---

## 3. Verification & Acceptance Criteria

- [x] All unit test suites pass with >80% code coverage.
- [x] WebSocket handshake validates JWT tokens securely.
- [x] Room isolation (`consultation:{id}`) restricts messaging strictly to authorized participants.
- [x] Presigned S3 URLs correctly enforce media types and file sizes.
- [x] Chat history pagination correctly returns messages in chronological order.
- [x] Full build succeeds with zero TypeScript errors.
