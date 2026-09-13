# VETRALINK PRO — Master Project Roadmap & Execution Plan
# Version: 1.0.0 | Status: ACTIVE | Last Updated: 2026-09-05

---

## 🧭 HIGH-LEVEL PHASING & STATUS

| Phase | Description | Sprints | Status |
| :--- | :--- | :--- | :--- |
| **Phase 0** | Workspace Bootstrap, Architectural Standard & Persistence | Sprint 0 | **READY / COMPLETED** |
| **Phase 1** | Foundation, DB Migration & Auth RBAC | Sprint 1–2 | **READY / COMPLETED** |
| **Phase 2** | LMS & Digital Assets Store (Encrypted Stream / Watermark / Pay) | Sprint 3–5 | **READY / COMPLETED** |
| **Phase 3** | Farm ERP Core (Livestock Registry, Milk Logging, P&L, Health) | Sprint 6–9 | 🟡 In Progress |
| **Phase 4** | Subscription Engine (Tier Gating, Quotas & Stripe Billing) | Sprint 10–11 | 🔲 Pending |
| **Phase 5** | Tele-Veterinary Platform (Triage, WebRTC, Signed EHR Prescriptions)| Sprint 12–15 | 🔲 Pending |

---

## 🚀 SPRINT BREAKDOWN & GRANULAR CHECKLISTS

### Phase 0: Workspace Bootstrap & Persistent System Architecture
> **Sprint 0: Engineering Foundation & Workspace Bootstrap**  
> **Status**: ✅ **COMPLETE (2026-09-05)**  
> **Documentation**: [`docs/features/sprint-0-bootstrap/spec.md`](docs/features/sprint-0-bootstrap/spec.md) | [`docs/features/sprint-0-bootstrap/plan.md`](docs/features/sprint-0-bootstrap/plan.md)

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
> **Status**: 🔲 Pending

- [ ] Clinical health incident logging (symptoms, diagnosis, treatments, costs).
- [ ] Multi-species vaccination and deworming schedule tracker.
- [ ] Automated BullMQ cron task: scan next due dates and send SMS/Push reminders.
- [ ] Escalation worker for unresolved critical illnesses.
- [ ] Image attachment upload for visible lesions/symptoms via presigned S3 URLs.

> **Sprint 9: Farm Financial Ledger & P&L Engine**  
> **Status**: 🔲 Pending

- [ ] Expense tracking categorizer (Feed, Veterinary Drugs, Labor, Utility, Equipment).
- [ ] Revenue tracking (Milk sales, Livestock sales, Manure, Byproducts).
- [ ] Real-time farm Profit & Loss (P&L) generation per custom date ranges.
- [ ] Feed Conversion Ratio (FCR) and cost-per-liter milk computation.
- [ ] Comprehensive Monthly Farm Performance PDF statement generator.

---

### Phase 4: Subscription Engine & Quota Gating
> **Sprint 10: Subscription Plans, Tier Quotas & Enforcement**  
> **Status**: 🔲 Pending

- [ ] Plan configuration (`STARTER`: 5 animals, `PRO`: 30 animals, `ENTERPRISE`: Unlimited).
- [ ] Subscription lifecycle management (`TRIALING`, `ACTIVE`, `PAST_DUE`, `CANCELED`).
- [ ] `SubscriptionGuard`: Intercept animal registration and member invitations against tier limits.
- [ ] Upgrade/downgrade subscription flow with prorated billing calculation.
- [ ] Stripe Customer Portal integration for self-service payment method updates.

> **Sprint 11: Dunning Workflows & Grace Periods**  
> **Status**: 🔲 Pending

- [ ] Webhook handling for failed recurring subscription renewals (`invoice.payment_failed`).
- [ ] 3-stage automated dunning retry notifications (Day 1, Day 3, Day 7).
- [ ] Grace period mechanism: restrict to read-only access before account suspension.
- [ ] SaaS metrics aggregator for platform admins (MRR, ARR, Churn rate, LTV).

---

### Phase 5: Tele-Veterinary Telehealth & EHR Platform
> **Sprint 12: Triage Intake & Case Assignment Engine**  
> **Status**: 🔲 Pending

- [ ] Farmer consultation request submission (chief complaint, affected animal, image/video uploads).
- [ ] Triage queue dashboard for triage officers and clinic administrators.
- [ ] Vet assignment and scheduling algorithm based on availability and specialty.
- [ ] Pay-per-consult checkout authorization hold before session confirmation.
- [ ] Real-time notification dispatch to assigned veterinarian.

> **Sprint 13: Clinical Portal & Real-time Consultation Room**  
> **Status**: 🔲 Pending

- [ ] Doctor clinical portal: comprehensive animal Electronic Health Record (EHR) view.
- [ ] WebRTC 1-on-1 video room provisioning (Daily.co / LiveKit) with ephemeral security tokens.
- [ ] WebSocket-driven real-time chat channel with media sharing.
- [ ] Private internal clinical notes (accessible only to attending veterinarians).

> **Sprint 14: Digitally Signed PDF Prescriptions**  
> **Status**: 🔲 Pending

- [ ] Structured prescription editor (Drug name, formulation, dosage, frequency, duration, withdrawal period).
- [ ] Food Safety compliance: automated withdrawal period alert for milk/meat consumption.
- [ ] PKI cryptographic digital signature (RSA-SHA256) applied to prescription hash.
- [ ] Dynamic prescription PDF generation with clinic letterhead, vet license #, and verify QR code.
- [ ] Public cryptographic verification endpoint (`/verify/prescription/:id`).
- [ ] Automatic append of prescription into the animal's permanent EHR record.

> **Sprint 15: Tele-Vet Settlement, Rating & Mobile App Sync**  
> **Status**: 🔲 Pending

- [ ] Vet consultation fee split & payout ledger (e.g., 80% vet / 20% platform).
- [ ] Post-consultation rating and review pipeline.
- [ ] Mobile offline sync engine (Flutter SQLite/WatermelonDB <-> NestJS REST sync).
- [ ] Platform-wide security audit, load testing with k6, and production readiness sign-off.
