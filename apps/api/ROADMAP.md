# VETRALINK PRO — Backend/API Roadmap

Reviewed: **2026-10-05**, source baseline **d5d311b**. Start with the [project roadmap](../../ROADMAP.md) and [documentation authority](../../docs/README.md).

## Scope and current status

**Confirmed from documentation:** the original tracker records Sprints 0–15 complete. Their original task IDs, dates and checkboxes are preserved below. This is backend delivery history, including shared bootstrap, mobile sync and release work; it does not mean the web product is complete. “Dashboard,” “portal” and “editor” in those task names mean the supporting API capability. The original `READY / COMPLETED` labels are historical task claims, not current integration or production readiness.

**Confirmed from code:** domain controllers/services and adjacent tests exist under [modules](src/modules/). The [web roadmap](../web/ROADMAP.md) owns browser implementation status. Updated 2026-10-07: default LEARNER/six-role authentication, audited farmer onboarding/member management, professional review, SUPER privilege management and a durable role-mail worker are implemented; see [evidence/runbook](../../docs/features/role-request-approval/operations.md).

## API dependency register

Updated 2026-10-09: safe HTTP completion diagnostics cover main/serverless Nest entry points, including validation/guard errors. Development defaults on; production requires `API_DEBUG=1`. Focused logger/filter/envelope/auth checks and API build evidence are in the [diagnostics plan](../../docs/tasks/api-request-diagnostics/plan.md). This code has not been deployed by this task.

Updated 2026-10-08: explicit offline first-super-admin bootstrap also supports new
email/name/password accounts. Owner-requested account creation and real authenticated
API checks against the configured database are recorded in the
[owner-login plan](../../docs/tasks/first-super-admin-login/plan.md). Public signup
still excludes administrative roles; this is separate from deployed-site acceptance.

This register owns API availability for web planning. Paths are relative to `/api/v1`; inspect linked controllers, DTOs, guards and module bindings for exact methods, permissions and response shapes. **Present** means source exists, **Partial** means a required contract is missing, and **Unverified** means runtime/provider acceptance evidence is still required. No row currently certifies a deployed integration as **Ready**. A historical completed task alone cannot promote a row to Ready.

| ID | Capability and source of contract | Delivery history | Availability / handoff condition |
| --- | --- | --- | --- |
| API-AUTH | [Auth controller](src/modules/auth/auth.controller.ts): `auth/register`, `login`, `refresh`, `logout`, `logout-all`, `me` | Tasks 2.1–2.7 | Present and locally verified with isolated real PostgreSQL/Redis/browser sessions; deployed acceptance remains unverified. No OTP/passwordless route in this controller. |
| API-FARM | [Farm members](src/modules/farms/farm-members.controller.ts): GET/POST `farms/:farmId/members`; [module](src/modules/farms/farms.module.ts) | Task 2.6 and 10.3 | Present: farms/onboarding create/confirm and farms/my discovery, OWNER membership, dashboard gate and email/UUID member management. Real isolated browser/DB quota/permission checks passed; production remains unverified. |
| API-ANIMAL | [Animals](src/modules/animals/animals.controller.ts): `animals`, lineage, weights/growth, import jobs, QR/badges | Tasks 6.1–6.6 | Present; tenant/role/quota checks and import worker/storage integration unverified. |
| API-MILK | [Milk logs](src/modules/milk-logs/milk-logs.controller.ts): CRUD, bulk, analytics, anomalies, export | Tasks 7.1–7.5 | Present; farm-scoped integration and anomaly worker operation unverified. |
| API-HEALTH | [Incidents/attachments](src/modules/clinical-health/clinical-health.controller.ts), [vaccinations/schedules](src/modules/clinical-health/vaccine-schedule.controller.ts) | Tasks 8.1–8.5 | Present; storage and real reminder/escalation delivery unverified; see provider gaps. |
| API-FINANCE | [Financial controllers](src/modules/financial/): expenses, revenues, profit-loss, analytics, statements | Tasks 9.1–9.5 | Present; authenticated farm data, binary exports and PDF generation unverified in the browser. |
| API-STORE | [Products](src/modules/products/products.controller.ts), [media](src/modules/media/), [orders](src/modules/orders/orders.controller.ts): catalog/search, stream session/manifest, checkout, my-orders, download tokens/files | Tasks 3.1–5.5 | Present for catalog/purchase/stream/download; payment, storage, workers and mail require integration evidence. Course chapters/progress and encrypted in-browser PDF reader are not established by these APIs; API-B2 tracks that gap. |
| API-BILLING | [Plans](src/modules/subscriptions/subscription-plan.controller.ts), [subscriptions](src/modules/subscriptions/subscription.controller.ts), [metrics](src/modules/subscriptions/controllers/subscription-metrics.controller.ts) | Tasks 10.1–11.4 | Present; use returned plans, quotas and access status. Stripe portal/renewal behavior unverified. Do not assume a standalone invoice API. |
| API-TRIAGE | [Consultations](src/modules/consultations/consultation.controller.ts), [triage](src/modules/consultations/controllers/consultation-triage.controller.ts), [availability](src/modules/consultations/controllers/vet-availability.controller.ts), [payment](src/modules/consultations/controllers/consultation-payment.controller.ts), [notifications](src/modules/consultations/controllers/consultation-notification.controller.ts) | Tasks 12.1–12.5 | Present; consultation payment flow unverified; SMS/push are mock-bound in the module. |
| API-ROOM | [EHR](src/modules/consultations/controllers/animal-ehr.controller.ts), [video room](src/modules/consultations/controllers/video-room.controller.ts), [chat](src/modules/consultations/controllers/consultation-chat.controller.ts), [gateway](src/modules/consultations/gateways/consultation-chat.gateway.ts), [notes](src/modules/consultations/controllers/consultation-clinical-notes.controller.ts) | Tasks 13.1–13.4 | Present; verify attending-vet access, Daily provider and persistent WebSocket hosting before integrated room acceptance. |
| API-RX | [Prescriptions](src/modules/consultations/controllers/prescriptions.controller.ts), [food safety](src/modules/consultations/controllers/food-safety.controller.ts), [public verification](src/modules/consultations/controllers/prescription-verification.controller.ts): `verify/prescription/:id` | Tasks 14.1–14.6 | Present; persisted signing keys, signed PDF generation, privacy and withdrawal displays need integration evidence. |
| API-SETTLEMENT | [Settlement](src/modules/consultations/controllers/consultation-settlement.controller.ts), [reviews](src/modules/consultations/controllers/consultation-review.controller.ts) | Tasks 15.1–15.2 | Present; ledger source does not certify external payout execution. Verify role-specific flows. |
| API-SYNC | [Sync controller](src/modules/sync/controllers/sync.controller.ts), [protocol and Flutter context](../../.context/features/offline-sync.md) | Task 15.3 | Present for server/Flutter library; web offline implementation absent. Known authorization/audit/conflict/cursor gaps prevent assuming browser offline readiness. |

## Remaining backend work

These are open integration/scope gaps, not retroactive changes to historical checkboxes or newly promised features. API-B1 is implemented locally; API-B2/B3 remain separate scope/release work. Create a scoped spec/plan before implementation and link it here; preserve the original task history.

- [x] **API-B1 — Farm workspace contract (implemented locally, 2026-10-07):** mandatory new-FARMER onboarding, atomic farm/OWNER creation or actual-member confirmation, current-user discovery and audited quota-protected members. [Feature evidence](../../docs/features/role-request-approval/operations.md) verifies the isolated API/DB/browser flow; separate release verification remains API-B3. Consumer: [WEB-2](../web/ROADMAP.md#web-delivery-backlog).
- [ ] **API-B2 — Product coverage reconciliation (not started):** reconcile PDF §3/§7 requirements not covered by the original sprint checklist: course chapters/progress/resources, encrypted browser PDF reading, flock mortality, standalone invoice expectations, and OTP/passwordless. No dedicated controllers were found for those flows; a DTO/schema or provider portal does not prove end-to-end support. Decide contract gaps and client scope in a shared feature spec; do not silently drop requirements or invent APIs. Consumer: WEB-11 and the affected web rows.
- [ ] **API-B3 — Integration and release evidence (unverified):** resolve applicable [known gaps](../../.context/known-gaps.md), then attach current real provider/runtime/security/load evidence to scoped plans. This includes notifications, payment/mail fallbacks, durable workers/realtime, signing keys, and sync concerns. Detailed gap facts stay in that single register. Consumers: every API-dependent web feature; UI work can begin against reviewed contracts, but integrated completion must wait for its required evidence.

## Preserved sprint history

The content below retains the original tracker, including the original header date and mixed-scope Sprint 0 / Task 15.3 / Task 15.4. It was previously at root `ROADMAP.md`; relative documentation links now resolve from `apps/api/`. Consult the [documentation guide](../../docs/README.md#historical-documents-and-conflicts) for phase numbering, status and specification reconciliations. Shared bootstrap history is retained once here; it is not a second global or mobile backlog.

---

# VETRALINK PRO — Master Project Roadmap & Execution Plan
# Version: 1.0.0 | Status: ACTIVE | Last Updated: 2026-09-05

---

## 🧭 HIGH-LEVEL PHASING & STATUS

| Phase | Description | Sprints | Status |
| :--- | :--- | :--- | :--- |
| **Phase 0** | Workspace Bootstrap, Architectural Standard & Persistence | Sprint 0 | **READY / COMPLETED** |
| **Phase 1** | Foundation, DB Migration & Auth RBAC | Sprint 1–2 | **READY / COMPLETED** |
| **Phase 2** | LMS & Digital Assets Store (Encrypted Stream / Watermark / Pay) | Sprint 3–5 | **READY / COMPLETED** |
| **Phase 3** | Farm ERP Core (Livestock Registry, Milk Logging, P&L, Health) | Sprint 6–9 | **READY / COMPLETED** |
| **Phase 4** | Subscription Engine (Tier Gating, Quotas & Stripe Billing) | Sprint 10–11 | **READY / COMPLETED** |
| **Phase 5** | Tele-Veterinary Platform (Triage, WebRTC, Signed EHR Prescriptions)| Sprint 12–15 | **READY / COMPLETED** |

---

## 🚀 SPRINT BREAKDOWN & GRANULAR CHECKLISTS

### Phase 0: Workspace Bootstrap & Persistent System Architecture
> **Sprint 0: Engineering Foundation & Workspace Bootstrap**  
> **Status**: ✅ **COMPLETE (2026-09-05)**  
> **Documentation**: [`docs/features/sprint-0-bootstrap/spec.md`](../../docs/features/sprint-0-bootstrap/spec.md) | [`docs/features/sprint-0-bootstrap/plan.md`](../../docs/features/sprint-0-bootstrap/plan.md)

- [x] Create `.antigravityrules` (Agent rules, Clean Architecture, SOLID, typing, guardrails).
- [x] Create `ARCHITECTURE.md` (System design, Monorepo topology, 3NF schema, HLS & Watermarking pipelines).
- [x] Create `ROADMAP.md` (Phased sprint tracker with granular checklists).
- [x] Define Prisma 3NF database schema covering all core domains (Users, Farms, Livestock, EHR, Orders, Subscriptions, Prescriptions).
- [x] Author Sprint 0 Specification Document (`docs/features/sprint-0-bootstrap/spec.md`).
- [x] Author Sprint 0 Step-by-Step Execution Plan (`docs/features/sprint-0-bootstrap/plan.md`).
- [x] Initialize Turborepo Monorepo structure (`apps/api`, `apps/web`, `apps/mobile`, `packages/shared-types`).
- [x] Configure `docker-compose.yml` for local services (PostgreSQL 16, Redis 7, MinIO S3 mock).

---

### Phase 1: Foundation, DB Migration & Auth RBAC
> **Sprint 1: Database Engine, Prisma Migration & Framework Core**  
> **Status**: ✅ **COMPLETE (2026-09-05)**  
> **Protocol**: Strict Micro-Task Execution (Execute one atomic task at a time)

- [x] **Task 1.1**: Database baseline migration script with composite partial indexes (`uq_active_farm_animal_tag`, `phone_hash`).
- [x] **Task 1.2**: NestJS `PrismaService` with connection pooling, health checks, and graceful shutdown hooks.
- [x] **Task 1.3**: Runtime environment configuration with strict Zod validation (`env.schema.ts`).
- [x] **Task 1.4**: Universal `ApiResponse<T>` interceptor and RFC-7807 `GlobalExceptionFilter`.
- [x] **Task 1.5**: Centralized `AuditLogRepository` and atomic database transaction wrapper.
- [x] **Task 1.6**: Jest test runner and basic `/api/v1/health` endpoint with DB/Redis probes.

> **Sprint 2: Authentication, Token Lifecycle & Multi-Tenant RBAC**  
> **Status**: ✅ **COMPLETE (2026-09-05)**  

- [x] **Task 2.1**: User entity schema, migration, and PII encryption engine (AES-256-GCM + HMAC-SHA256 `phone_hash`).
- [x] **Task 2.2**: Auth DTOs (Register, Login, Refresh, OTP) in `@vetralink/shared-types`.
- [x] **Task 2.3**: `UserRepository` and `RefreshTokenRepository` with interface contracts.
- [x] **Task 2.4**: `AuthService` core: Password hashing (bcrypt 12 rounds), JWT issuance, and Refresh Token Rotation (RTR).
- [x] **Task 2.5**: Role-based access control: `@Roles()` decorator and `RolesGuard`.
- [x] **Task 2.6**: Multi-tenant protection: `TenantGuard` enforcing farm isolation via `farm_members`.
- [x] **Task 2.7**: `AuthController` endpoints, Swagger OpenAPI docs, and integration test suite.

---

### Phase 2: LMS & Digital Store with Payment Webhooks
> **Sprint 3: Digital Product Catalog & Media Asset Pipeline**  
> **Status**: ✅ **COMPLETE (2026-09-12)**  

- [x] **Task 3.1**: Product master CRUD (`VIDEO_COURSE`, `EBOOK`, `EXCEL_TOOL`).
- [x] **Task 3.2**: Presigned S3 direct multipart upload for heavy video masters and PDF assets.
- [x] **Task 3.3**: BullMQ video processing worker: FFmpeg automated multi-bitrate HLS segmentation.
- [x] **Task 3.4**: AES-128 / DRM key server endpoint with time-bound JWT verification.
- [x] **Task 3.5**: CloudFront Origin Access Control (OAC) signed URL delivery pipeline.
- [x] **Task 3.6**: Product catalog public search with full-text indexing and filtering.

> **Sprint 4: Orders, Checkout & Payment Webhooks**  
> **Status**: ✅ **COMPLETE (2026-09-12)**  

- [x] **Task 4.1**: ACID-compliant checkout workflow inside Prisma `$transaction`:
  - Verify price and product availability.
  - Insert order and immutable snapshot `order_items`.
  - Dispatch payment intent to gateway.
- [x] **Task 4.2**: Stripe Webhook receiver with raw payload signature validation (`stripe-signature`).
- [x] **Task 4.3**: Regional MFS Webhook receiver (bKash / SSLCommerz / Paymob IPN).
- [x] **Task 4.4**: Idempotency key guard on payment events to prevent duplicate order fulfillment.
- [x] **Task 4.5**: Automated download token generation upon payment completion.

> **Sprint 5: Dynamic Anti-Piracy Watermarking & Fulfillment**  
> **Status**: ✅ **COMPLETE (2026-09-13)**  

- [x] **Task 5.1**: BullMQ dynamic watermarking worker using `pdf-lib` / Gotenberg engine.
- [x] **Task 5.2**: Burn buyer identity (Full Name, masked email, Order ID, timestamp) diagonally across pages.
- [x] **Task 5.3**: Generate cryptographic verification QR code on watermarked PDFs.
- [x] **Task 5.4**: Secure time-limited download endpoint (`/api/v1/orders/:id/download`) with download counters.
- [x] **Task 5.5**: Transactional email dispatch (Resend / AWS SES) with presigned download links.

---

### Phase 3: Farm ERP Core Engine
> **Sprint 6: Multi-Species Livestock Registry**  
> **Status**: 🟢 Completed (Tasks 6.1, 6.2, 6.3, 6.4, 6.5 & 6.6 Complete)

- [x] **Task 6.1**: Multi-species animal registration (`COW`, `BUFFALO`, `GOAT`, `SHEEP`, `CAMEL`, `POULTRY`, `OTHER`) with tenant isolation and pedigree validation.
- [x] **Task 6.2**: Enforce unique ear tag / RFID numbers per tenant farm.
- [x] **Task 6.3**: Animal lineage graph (sire/dam pedigree traversal).
- [x] **Task 6.4**: Weight tracking history with automated growth curve calculation.
- [x] **Task 6.5**: Bulk CSV/Excel animal import via BullMQ background parser with validation error reports.
- [x] **Task 6.6**: Printable QR Code generation for physical barn tagging.

> **Sprint 7: Daily Milk Production & Analytics**  
> **Status**: ✅ **COMPLETE (2026-09-13)**  

- [x] **Task 7.1**: Daily milk yield logging per animal and session (`MORNING`, `AFTERNOON`, `EVENING`).
- [x] **Task 7.2**: Bulk herd collection logging for commercial operations.
- [x] **Task 7.3**: Aggregate daily, weekly, and monthly yield analytics with 7-day moving averages.
- [x] **Task 7.4**: Anomaly detection worker: flag animals experiencing a >20% sudden drop in milk yield.
- [x] **Task 7.5**: Export milk production logs to formatted CSV and Excel spreadsheets.

> **Sprint 8: Clinical Health Events, Deworming & Vaccination Schedules**  
> **Status**: ✅ **COMPLETE (2026-09-13)**  

- [x] **Task 8.1**: Clinical health incident logging (symptoms, diagnosis, treatments, costs).
- [x] **Task 8.2**: Multi-species vaccination and deworming schedule tracker.
- [x] **Task 8.3**: Automated BullMQ cron task: scan next due dates and send SMS/Push reminders.
- [x] **Task 8.4**: Escalation worker for unresolved critical illnesses.
- [x] **Task 8.5**: Image attachment upload for visible lesions/symptoms via presigned S3 URLs.

> **Sprint 9: Farm Financial Ledger & P&L Engine**  
> **Status**: 🟢 Completed (Tasks 9.1, 9.2, 9.3, 9.4 & 9.5 Complete)  

- [x] **Task 9.1**: Expense tracking categorizer (Feed, Veterinary Drugs, Labor, Utility, Equipment) with category analytics breakdown, optimistic concurrency, and soft deletes.
- [x] **Task 9.2**: Revenue tracking (Milk sales, Livestock sales, Manure, Byproducts).
- [x] **Task 9.3**: Real-time farm Profit & Loss (P&L) generation per custom date ranges.
- [x] **Task 9.4**: Feed Conversion Ratio (FCR) and cost-per-liter milk computation.
- [x] **Task 9.5**: Comprehensive Monthly Farm Performance PDF statement generator.

---

### Phase 4: Subscription Engine & Quota Gating
> **Sprint 10: Subscription Plans, Tier Quotas & Enforcement**  
> **Status**: ✅ **COMPLETE**
- [x] **Task 10.1**: Plan configuration (`STARTER`: 5 animals, `PRO`: 30 animals, `ENTERPRISE`: Unlimited).
- [x] **Task 10.2**: Subscription lifecycle management (`TRIALING`, `ACTIVE`, `PAST_DUE`, `CANCELED`).
- [x] **Task 10.3**: `SubscriptionGuard`: Intercept animal registration and member invitations against tier limits.
- [x] **Task 10.4**: Upgrade/downgrade subscription flow with prorated billing calculation.
- [x] **Task 10.5**: Stripe Customer Portal integration for self-service payment method updates.

> **Sprint 11: Dunning Workflows & Grace Periods**  
> **Status**: ✅ **COMPLETE**

- [x] **Task 11.1**: Webhook handling for failed recurring subscription renewals (`invoice.payment_failed`).
- [x] **Task 11.2**: 3-stage automated dunning retry notifications (Day 1, Day 3, Day 7).
- [x] **Task 11.3**: Grace period mechanism: restrict to read-only access before account suspension.
- [x] **Task 11.4**: SaaS metrics aggregator for platform admins (MRR, ARR, Churn rate, LTV).

---

### Phase 5: Tele-Veterinary Telehealth & EHR Platform
> **Sprint 12: Triage Intake & Case Assignment Engine**  
> **Status**: ✅ **COMPLETE (2026-09-20)**

- [x] **Task 12.1**: Farmer consultation request submission (chief complaint, affected animal, image/video uploads).
- [x] **Task 12.2**: Triage queue dashboard for triage officers and clinic administrators.
- [x] **Task 12.3**: Vet assignment and scheduling algorithm based on availability and specialty.
- [x] **Task 12.4**: Pay-per-consult checkout authorization hold before session confirmation.
- [x] **Task 12.5**: Real-time notification dispatch to assigned veterinarian.

> **Sprint 13: Clinical Portal & Real-time Consultation Room**  
> **Status**: 🟢 Completed (2026-09-20)

- [x] **Task 13.1**: Doctor clinical portal: comprehensive animal Electronic Health Record (EHR) view.
- [x] **Task 13.2**: WebRTC 1-on-1 video room provisioning (Daily.co / LiveKit) with ephemeral security tokens.
- [x] **Task 13.3**: WebSocket-driven real-time chat channel with media sharing.
- [x] **Task 13.4**: Private internal clinical notes (accessible only to attending veterinarians).

> **Sprint 14: Digitally Signed PDF Prescriptions**  
> **Status**: ✅ Completed

- [x] **Task 14.1**: Structured prescription editor (Drug name, formulation, dosage, frequency, duration, withdrawal period).
- [x] **Task 14.2**: Food Safety compliance: automated withdrawal period alert for milk/meat consumption.
- [x] **Task 14.3**: PKI cryptographic digital signature (RSA-SHA256) applied to prescription hash.
- [x] **Task 14.4**: Dynamic prescription PDF generation with clinic letterhead, vet license #, and verify QR code.
- [x] **Task 14.5**: Public cryptographic verification endpoint (`/verify/prescription/:id`).
- [x] **Task 14.6**: Automatic append of prescription into the animal's permanent EHR record.

> **Sprint 15: Tele-Vet Settlement, Rating & Mobile App Sync**  
> **Status**: ✅ **COMPLETE (2026-09-21)**

- [x] **Task 15.1**: Vet consultation fee split & payout ledger (e.g., 80% vet / 20% platform).
- [x] **Task 15.2**: Post-consultation rating and review pipeline.
- [x] **Task 15.3**: Mobile offline sync engine (Flutter SQLite/WatermelonDB <-> NestJS REST sync).
- [x] **Task 15.4**: Platform-wide security audit, load testing with k6, and production readiness sign-off.
