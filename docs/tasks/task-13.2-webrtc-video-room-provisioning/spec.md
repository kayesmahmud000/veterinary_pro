# Task 13.2 Specification: WebRTC 1-on-1 Video Room Provisioning with Ephemeral Security Tokens

## 1. Feature Overview & Objective

In the VETRALINK PRO Tele-Veterinary platform, `LIVE_VIDEO` consultations enable real-time interactive telehealth sessions between farmers and attending veterinarians.

**Task 13.2** implements the **WebRTC 1-on-1 Video Room Provisioning Engine**:
1. **Strict 1-on-1 Video Room Isolation**:
   - Every video room is strictly restricted to a maximum of **2 active participants** (1 Attending Veterinarian + 1 Farmer/Client).
   - Prevents unauthorized third-party intrusion, maintains strict clinical privacy, and protects animal patient data.
2. **Ephemeral Cryptographic Meeting Tokens**:
   - Participants cannot access the room via static URLs.
   - Entry requires an ephemeral, time-bounded security token (TTL: 2 hours) signed with the platform's Daily.co API key.
   - **Role-Based Permissions within Room**:
     - **Attending Veterinarian / Admin (`isOwner: true`)**: Granted doctor privileges (can mute participants, eject unauthorized joiners, initiate recording, and control room lifecycle).
     - **Farmer / Farm Member (`isOwner: false`)**: Client privileges (audio/video streaming, screenshare).
3. **Session Lifecycle & Pay-Per-Consult Gate**:
   - Provisioning is gated by financial authorization: If `feeCents > 0`, the room cannot be provisioned or joined until payment is `AUTHORIZED` or `CAPTURED`.
   - Idempotency: Multiple requests to provision a room for the same consultation return the existing active room session without creating redundant rooms.
   - Room Teardown: When the session concludes (`endVideoRoom`), the room is deleted from the SFU gateway and the consultation transitions towards completion.
4. **Multi-Provider Architecture**:
   - Provider abstraction via `IVideoRoomProvider` decoupling business logic from Daily.co / LiveKit.
   - Deterministic `MockVideoRoomProvider` for CI/CD test automation and offline local development without external API dependencies.

---

## 2. Current State vs. Proposed State

### Current State
- `Consultation` has `roomSessionId: String?`, but no service provisions or manages WebRTC video rooms.
- `ConsultationEntity.startConsultation(roomSessionId)` accepts a string, but no tokens or Daily.co integration exists.
- `DAILY_API_KEY` is present in `EnvSchema` and `EnvService`, but unused.

### Proposed State
- **Shared Types (`packages/shared-types`)**:
  - Add `VideoRoomDto`, `JoinVideoRoomDto`, and `EndVideoRoomDto`.
- **Gateway & Provider Layer**:
  - `IVideoRoomProvider`: Interface defining `createRoom()`, `createMeetingToken()`, `getRoom()`, and `deleteRoom()`.
  - `DailyVideoRoomProvider`: Live Daily.co REST API client with fallback to mock mode when `DAILY_API_KEY` is not set.
  - `MockVideoRoomProvider`: In-memory deterministic mock for tests.
- **Domain Service Layer**:
  - `IVideoRoomService` & `VideoRoomService`:
    - Enforces payment authorization gate (`feeCents > 0 => isPaymentAuthorized()`).
    - Enforces consultation type (`LIVE_VIDEO`).
    - Provisions private room with `max_participants: 2` and 2-hour TTL.
    - Generates role-differentiated meeting tokens (`isOwner` true for vet, false for farmer).
    - Emits structured audit logs (`CONSULTATION_ROOM_PROVISIONED`, `CONSULTATION_ROOM_JOINED`, `CONSULTATION_ROOM_TERMINATED`).
- **REST Endpoints (`VideoRoomController`)**:
  - `POST /consultations/:id/video-room/provision`: Provision room.
  - `POST /consultations/:id/video-room/join`: Generate ephemeral security token.
  - `POST /consultations/:id/video-room/end`: Teardown room and conclude session.

---

## 3. Architectural & Design Trade-offs

| Architectural Decision | Option A | Option B (Selected) | Technical Justification |
| :--- | :--- | :--- | :--- |
| **WebRTC Architecture** | Peer-to-peer (Mesh WebRTC) directly between browsers. | Selective Forwarding Unit (SFU) via Daily.co / LiveKit. | **Selected: Option B**. Peer-to-peer mesh suffers from severe packet loss and NAT/firewall traversal failures in rural, low-bandwidth farm environments. SFU handles media routing, bandwidth adaptation, and TURN relays reliably. |
| **Room Access Security** | Public room URLs with password in frontend. | Private rooms with Daily.co Ephemeral Meeting Tokens. | **Selected: Option B**. Guarantees zero eavesdropping. Ephemeral tokens expire automatically, bind to specific user identities, and enforce participant caps on the SFU edge. |
| **Payment Verification Timing** | Verify payment after video call completes. | Gate room provisioning and token issuance behind authorization hold verification (`feeCents > 0 => paymentStatus in [AUTHORIZED, CAPTURED]`). | **Selected: Option B**. Prevents unpaid video consultations. Veterinarians are guaranteed payment before spending 20–30 minutes on a live video triage call. |

---

## 4. Data Models & Contracts

### Shared Types (`packages/shared-types`)

```typescript
export interface VideoRoomDto {
  consultationId: string;
  roomName: string;
  roomUrl: string;
  maxParticipants: number;
  privacy: "private" | "public";
  createdAt: string;
  expiresAt: string;
}

export interface JoinVideoRoomDto {
  consultationId: string;
  roomName: string;
  roomUrl: string;
  token: string;
  isOwner: boolean;
  userName: string;
  expiresAt: string;
}

export interface EndVideoRoomDto {
  consultationId: string;
  roomName: string;
  endedAt: string;
  durationMinutes?: number;
}
```

---

## 5. Security & Edge Cases

1. **Strict 1-on-1 Enforced at Gateway**:
   - `max_participants: 2` is sent to Daily.co room properties. The SFU gateway refuses entry to any third connection.
2. **Payment Authorization Gate**:
   - If `consultation.feeCents > 0` and `consultation.paymentStatus` is `UNPAID` or `FAILED`, provisioning throws `ValidationDomainException("Payment authorization hold required before video room can be provisioned.")`.
3. **Invalid Consultation Type**:
   - Calling video room endpoints on `ASYNC_TICKET` consultations throws `ValidationDomainException("Video rooms can only be provisioned for LIVE_VIDEO consultations.")`.
4. **Participant Role Verification**:
   - Only the assigned veterinarian, the farmer, authorized farm members, or administrators can generate join tokens.
   - Non-participants receive `ForbiddenOperationException`.
5. **Token Expiration**:
   - Ephemeral tokens are created with `exp: Math.floor(Date.now() / 1000) + 7200` (2 hours). Stale tokens are rejected by Daily.co.
