# PLAN-505: Step-by-Step Execution Plan for Transactional Email Dispatch
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 5: Dynamic Anti-Piracy Watermarking & Fulfillment
# Task 5.5: Transactional email dispatch (Resend / AWS SES) with presigned download links
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Prerequisites & Dependencies

- [x] Ensure `EnvSchema` supports `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY`, `AWS_SES_REGION`, and `API_BASE_URL`.
- [x] Ensure BullMQ connection root is operational in `AppModule`.
- [x] Ensure `IOrderRepository` and `IAuditLogRepository` are accessible.

---

## 2. Implementation Checklist

### Step 1: Environment Variables & Shared Contracts
- [x] Update `apps/api/src/config/env.schema.ts` and `apps/api/src/config/env.service.ts`:
  - Add `EMAIL_PROVIDER`, `EMAIL_FROM`, `RESEND_API_KEY`, `AWS_SES_REGION`, `API_BASE_URL`.
- [x] Create `packages/shared-types/src/dto/mail/order-delivery-email.dto.ts`:
  - Define `OrderDeliveryEmailJobData`, `OrderItemEmailDetail`, `EmailDispatchResultDto`.
- [x] Export new mail DTOs from `packages/shared-types/src/index.ts`.
- [x] Build shared-types: `pnpm --filter @vetralink/shared-types build`.

### Step 2: Mail Module Core Interfaces & Providers (`apps/api`)
- [x] Create `apps/api/src/modules/mail/interfaces/mail-provider.interface.ts`:
  - Define `EmailMessage`, `EmailSendResult`, `IEmailProvider`, `EMAIL_PROVIDER_TOKEN`.
- [x] Create `apps/api/src/modules/mail/interfaces/mail-service.interface.ts`:
  - Define `IMailService`, `MAIL_SERVICE`, `MAIL_QUEUE_NAME`.
- [x] Create `apps/api/src/modules/mail/providers/mock-mail.provider.ts`:
  - Implement in-memory mock provider recording sent emails for tests and local dev.
- [x] Create `apps/api/src/modules/mail/providers/resend-mail.provider.ts`:
  - Implement Resend REST API integration using native Node.js `fetch`.
- [x] Create `apps/api/src/modules/mail/providers/ses-mail.provider.ts`:
  - Implement AWS SES provider or fallback stub with clear configuration checks.
- [x] Create `apps/api/src/modules/mail/templates/order-download-delivery.template.ts`:
  - Pure function generating HTML and plain text email bodies with order items, download links, quota notice, and anti-piracy warning.

### Step 3: Domain Mail Services & BullMQ Queue Worker
- [x] Create `apps/api/src/modules/mail/services/mail.service.ts`:
  - Implement `IMailService` coordinating with active `IEmailProvider` and `IOrderRepository`.
- [x] Create `apps/api/src/modules/mail/services/mail-queue.service.ts`:
  - Implement queue producer `enqueueOrderDeliveryEmail(orderId, recipientEmail, recipientName, traceId)`.
- [x] Create `apps/api/src/modules/mail/processors/mail.processor.ts`:
  - BullMQ worker `@Processor(MAIL_QUEUE_NAME)` that processes delivery jobs and invokes `IMailService`.
- [x] Create `apps/api/src/modules/mail/mail.module.ts`:
  - Register `BullModule.registerQueue({ name: MAIL_QUEUE_NAME })`.
  - Provide and export `MAIL_SERVICE`, `MAIL_QUEUE_SERVICE`.

### Step 4: Wire Mail Queue into Orders Module
- [x] Update `apps/api/src/app.module.ts`:
  - Import `MailModule`.
- [x] Update `apps/api/src/modules/orders/orders.module.ts`:
  - Import `MailModule`.
- [x] Update `apps/api/src/modules/orders/services/order-fulfillment.service.ts`:
  - Inject `MAIL_QUEUE_SERVICE`.
  - When fulfilling order (`fulfillOrder`), enqueue order delivery email if customer email is present.
- [x] Update `apps/api/src/modules/orders/orders.controller.ts`:
  - Add `POST /orders/:id/resend-email` endpoint allowing authorized users / admins to resend the delivery email.

### Step 5: Unit & Integration Tests
- [x] Create `apps/api/src/modules/mail/services/mail.service.spec.ts`:
  - Unit test `MailService` with mock provider, verifying correct template generation and dispatch.
- [x] Create `apps/api/src/modules/mail/providers/resend-mail.provider.spec.ts`:
  - Unit test Resend provider with mocked `fetch` API.
- [x] Create `apps/api/src/modules/mail/processors/mail.processor.spec.ts`:
  - Unit test BullMQ worker processor execution, progress updates, and error handling.
- [x] Update `apps/api/src/modules/orders/services/order-fulfillment.service.spec.ts` & `orders-fulfillment.int.spec.ts`:
  - Verify email enqueueing on order fulfillment and test `POST /orders/:id/resend-email`.

### Step 6: Full Verification & Roadmap Update
- [x] Run all test suites:
  ```bash
  pnpm --filter @vetralink/api test src/modules/mail src/modules/orders src/modules/watermark
  ```
- [x] Run full project build:
  ```bash
  pnpm --filter @vetralink/api build
  ```
- [x] Check off Task 5.5 and mark Sprint 5 as `✅ COMPLETE` in `ROADMAP.md`.
- [x] Suggest conventional git commit message.

---

## 3. Verification & Acceptance Criteria

1. **Provider Agnostic**: Switchable between Resend, AWS SES, and Mock provider via `EMAIL_PROVIDER` without code changes.
2. **Asynchronous Non-Blocking**: Webhook fulfillment completes within milliseconds while BullMQ delivers the email asynchronously.
3. **Link Integrity**: Email download links route to `/api/v1/orders/:id/download?token=:token&redirect=true`, properly triggering download counter increments and 302 redirects.
4. **Resilience**: Failed email delivery jobs retry 3 times with exponential backoff before logging an alert.
5. **Zero Regression**: 100% test pass rate across `src/modules/mail`, `src/modules/orders`, and `src/modules/watermark`.
