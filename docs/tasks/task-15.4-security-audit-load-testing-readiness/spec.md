# Specification: Task 15.4 - Platform-Wide Security Audit, Load Testing with k6, and Production Readiness Sign-Off

## 1. Feature Overview & Objective
As VETRALINK PRO reaches the final milestone of Phase 5 (Tele-Veterinary Platform) and prepares for commercial production rollout, the platform requires rigorous, multi-vector verification:
1. **Platform-Wide Security Audit**:
   - Comprehensive audit of the system against Section 7 of `.antigravityrules` and OWASP Top 10 API Security guidelines.
   - Verification of:
     - JWT Authentication (15-minute access token + 7-day refresh token with single-use Refresh Token Rotation).
     - Role-Based Access Control (`@Roles()` and `RolesGuard`) across all endpoints.
     - Multi-Tenant Data Isolation (`TenantGuard` and repository-level scoping by `farmId`).
     - PII Data Encryption at rest (AES-256-GCM for phone numbers and sensitive identity fields).
     - Password Hashing (bcrypt with 12 salt rounds).
     - HTTP Security Headers (Helmet) and CORS policies.
     - Rate Limiting and DoS resistance.
     - SQL Injection prevention via Prisma parameterized queries.
     - Audit logging on all critical CUD mutations and financial transactions.
2. **High-Throughput Load Testing with k6**:
   - Comprehensive load test harness in `infrastructure/load-testing/` testing high concurrency and low latency:
     - `auth-load-test.js`: User registration, login, token refresh.
     - `farm-erp-load-test.js`: Livestock registry queries, daily milk logging, health incident logging.
     - `tele-vet-load-test.js`: Consultation triage queue, clinical note recording, prescription retrieval.
     - `offline-sync-load-test.js`: High-frequency `/api/v1/sync/pull` and `/api/v1/sync/push` delta sync.
     - Performance targets:
       - 95th percentile latency ($p_{95}$) $< 200\text{ ms}$ for standard read/write endpoints.
       - 95th percentile latency ($p_{95}$) $< 500\text{ ms}$ for batch offline sync push.
       - HTTP failure rate $< 1.0\%$.
3. **Production Readiness Sign-Off**:
   - Health probes (`/api/v1/health` with Prisma and Redis checks).
   - Graceful shutdown handlers in NestJS and Prisma.
   - Environment schema validation on application startup (`env.schema.ts`).
   - Clean monorepo build across packages and applications.

---

## 2. Current State vs. Proposed State

### Current State:
- Phase 0 through Phase 5 features (Sprint 0 through Sprint 15.3) are implemented.
- The monorepo has modular components for Auth, Farms, Animals, Milk Logs, Health, Finances, Subscriptions, Consultations, Prescriptions, and Mobile Offline Sync.
- However, there is no consolidated security verification test suite, no formal k6 load test scripts, and no comprehensive production sign-off document verifying system readiness under production load.

### Proposed State:
- Automated security audit test suite in `apps/api/test/security/security-audit.spec.ts` testing:
  - Unauthenticated access rejection on guarded endpoints (401 Unauthorized).
  - Cross-tenant data isolation rejection (403 Forbidden).
  - RBAC role enforcement (403 Forbidden for insufficient permissions).
  - PII encryption validation (AES-256-GCM cipher verification).
  - HTTP security headers (Helmet headers present).
- Production-grade k6 load testing suite in `infrastructure/load-testing/`:
  - `auth-load-test.js`
  - `farm-erp-load-test.js`
  - `tele-vet-load-test.js`
  - `offline-sync-load-test.js`
  - `run-load-tests.sh` / `run-load-tests.ps1` runner script.
- Production readiness checklist and verification report in `docs/tasks/task-15.4-security-audit-load-testing-readiness/readiness-report.md`.

---

## 3. Architectural & Design Trade-offs

### Load Testing Tool Selection: k6 vs. Apache JMeter vs. Artillery
- **Apache JMeter**: Heavy Java runtime, XML configuration, high memory footprint per thread, poor CI/CD ergonomics.
- **Artillery**: Node.js based, but CPU-bound at high VUs (>500 concurrent connections).
- **Grafana k6**: Written in Go, uses JavaScript for scenario authoring, ultra-low memory footprint (~10-20MB per 1000 VUs), native support for thresholds, and easy integration with CI pipelines and Grafana dashboards.
- **Decision**: Adopt **k6** as the official load testing engine for VETRALINK PRO.

---

## 4. Load Testing Scenarios & Thresholds

| Scenario | Target Virtual Users (VUs) | Duration | $p_{95}$ Threshold | Max Error Rate |
| :--- | :--- | :--- | :--- | :--- |
| **Auth Flow** | 50 VUs ramp-up | 2m | $< 250\text{ ms}$ | $< 0.5\%$ |
| **Farm ERP** | 100 VUs | 3m | $< 200\text{ ms}$ | $< 1.0\%$ |
| **Tele-Vet Triage** | 50 VUs | 2m | $< 200\text{ ms}$ | $< 0.5\%$ |
| **Mobile Offline Sync** | 100 VUs | 3m | $< 500\text{ ms}$ | $< 1.0\%$ |

---

## 5. Security Audit Verification Matrix

1. **Authentication & Authorization**:
   - Access tokens strictly 15 minutes.
   - Refresh tokens cryptographically hashed with SHA-256 and rotated on each call.
   - Invalidation of previous refresh tokens upon reuse detection.
2. **Multi-Tenant Data Isolation**:
   - All database queries strictly scoped by `farm_id` at the repository layer.
   - Cross-tenant access blocked by `TenantGuard` and domain service layers.
3. **Cryptography & Data at Rest**:
   - PII fields (phone, national ID) encrypted with AES-256-GCM with distinct IVs and auth tags.
   - Passwords hashed with bcrypt (salt rounds $\ge 12$).
   - Prescription PDF digital signatures generated using RSA-SHA256 PKI keys.
4. **Resilience & Graceful Handling**:
   - Database connection pools managed with health indicators.
   - Redis connectivity monitored via liveness/readiness probes.
   - Clean shutdown signal handling (`SIGTERM`, `SIGINT`).
