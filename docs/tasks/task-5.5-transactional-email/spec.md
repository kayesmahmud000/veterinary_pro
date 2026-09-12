# SPEC-505: Transactional Email Dispatch with Presigned Download Links
# Phase 2: LMS & Digital Store with Payment Webhooks
# Sprint 5: Dynamic Anti-Piracy Watermarking & Fulfillment
# Task 5.5: Transactional email dispatch (Resend / AWS SES) with presigned download links
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Feature Overview & Objective

### 1.1 Problem Statement
When a customer purchases a digital product (eBook, veterinary calculation spreadsheet, or downloadable toolkit) on VetraLink Pro and their payment is confirmed (via Stripe or regional MFS webhooks), their order is settled to `COMPLETED` and unique line-item download tokens are generated. However, customers may not always remain on the checkout confirmation screen or download their assets immediately. 

Furthermore, digital assets require clear anti-piracy governance instructions (licensed to the buyer, watermarked with their identity and verification QR code, and subject to a 5-download quota). Without automated transactional email delivery, customers have no durable, offline record of their purchase receipt and no convenient access to their download links.

### 1.2 Objective
Implement an enterprise-grade, asynchronous transactional email delivery engine that:
1. **Asynchronous Dispatch via BullMQ**: Enqueues email delivery jobs (`MAIL_QUEUE`) upon order settlement, guaranteeing zero impact on webhook response latencies or database transaction rollbacks.
2. **Pluggable Multi-Provider Architecture**: Implements a Clean Architecture Provider Pattern supporting **Resend** (REST API) and **AWS SES** (or mock fallback for testing and development environments), switchable via configuration (`EMAIL_PROVIDER`).
3. **Responsive HTML & Plain Text Templates**: Produces a high-conversion, accessible email detailing order metadata, itemized purchases, dynamic direct download links, quota advisories, and anti-piracy licensing notes.
4. **Secure Download Link Resolution**: Crafts secure links routing to `/api/v1/orders/:id/download?token=:token&redirect=true`, ensuring that clicking the email link enforces real-time order authorization, increments the download counter, and issues an ephemeral 15-minute presigned S3 GET URL.
5. **Manual & Automated Resend Support**: Provides an authenticated endpoint (`POST /api/v1/orders/:id/resend-email`) allowing buyers and administrators to re-trigger delivery emails on demand.

---

## 2. Current State vs. Proposed State

| Capability | Current State | Proposed State (Task 5.5) |
| :--- | :--- | :--- |
| **Email Infrastructure** | None (`apps/api` has no mail/notification module). | Dedicated `MailModule` (`apps/api/src/modules/mail`) with BullMQ queue and worker. |
| **Provider Support** | N/A | Pluggable `IEmailProvider` strategy: `ResendEmailProvider`, `SesEmailProvider`, and `MockEmailProvider`. |
| **Email Trigger** | Order fulfillment generates download tokens in DB, but does not notify user. | `OrderFulfillmentService.fulfillOrder` enqueues an asynchronous delivery email job. |
| **Download Links in Email** | None | Dynamic links to `/api/v1/orders/:id/download?token=:token&redirect=true` with quota advisories. |
| **Template Engine** | None | Clean, inline-styled responsive HTML template + plaintext fallback. |
| **Resend Capability** | None | `POST /api/v1/orders/:id/resend-email` endpoint with throttle and ownership guards. |
| **Audit & Resilience** | None | Retry mechanism in BullMQ (3 attempts with exponential backoff) and `ORDER_EMAIL_SENT` audit logs. |

---

## 3. Architectural & Design Trade-offs

### 3.1 Provider Selection: Resend vs. AWS SES vs. Pluggable Strategy
- **Option A: Hardcode AWS SES via AWS SDK v3.**
  - *Pros*: Native AWS integration, cost-effective for large email volumes.
  - *Cons*: Difficult to test locally without localstack; SES sandbox mode requires email verification before sending to unverified addresses.
- **Option B: Hardcode Resend SDK.**
  - *Pros*: Excellent developer experience, modern REST API, clean deliverability.
  - *Cons*: Vendor lock-in; higher cost at massive enterprise scale.
- **Option C (Selected: Superior Architectural Approach): Clean Architecture Provider Strategy (`IEmailProvider`) with Resend, SES, and Mock implementations.**
  - *Implementation*: Define `IEmailProvider` interface. Implement `ResendEmailProvider` (using standard HTTP `fetch`), `SesEmailProvider` (using `@aws-sdk/client-ses`), and `MockEmailProvider` (in-memory logger for unit/int tests). Wire via `EMAIL_PROVIDER` (`'resend' | 'ses' | 'mock'`).
  - *Justification*: Complies with SOLID Open/Closed and Dependency Inversion principles. Allows local development and CI testing with zero external network requests, while allowing production deployments to switch between Resend and AWS SES via simple environment variable changes.

### 3.2 Direct S3 Presigned URL in Email vs. Secure Token Endpoint Link
- **Option A: Generate 24-hour or 7-day presigned S3 GET URLs and embed them directly in the email HTML.**
  - *Cons*: S3 URLs are long, unwieldy, and expire in 24 hours. Once expired, the email becomes completely useless. Additionally, clicking the direct S3 URL bypasses `downloadCount` tracking, quota limits, and audit logs!
- **Option B (Selected: Superior Approach): Embed Application Endpoint Link (`/api/v1/orders/:id/download?token=:token&redirect=true`).**
  - *Pros*: The email link never becomes prematurely invalid due to S3 presigned URL expiration. Each click hits the secure endpoint built in Task 5.4, which validates order settlement, checks whether `downloadCount < 5`, atomically increments the counter, emits an `ORDER_ITEM_DOWNLOADED` audit log, and 302-redirects directly to a fresh 15-minute presigned S3 URL.

### 3.3 Synchronous Dispatch in Webhook vs. Asynchronous BullMQ Queue
- **Option A: Send email directly inside `fulfillOrder` or the Stripe webhook handler.**
  - *Cons*: External email API latencies (200ms - 2000ms) delay webhook responses, increasing webhook timeout risk and potentially rolling back database transactions if SMTP/API fails.
- **Option B (Selected: Robust Asynchronous Architecture): BullMQ `MAIL_QUEUE` with worker processor.**
  - *Pros*: Sub-millisecond queue dispatch during order settlement. The webhook finishes immediately. Transient network failures to Resend or SES are automatically retried with exponential backoff without affecting database state.

---

## 4. Data Models, DTOs & Contracts

### 4.1 Shared Types (`@vetralink/shared-types`)
```typescript
export interface OrderDeliveryEmailJobData {
  orderId: string;
  recipientEmail: string;
  recipientName?: string;
  traceId?: string;
}

export interface OrderItemEmailDetail {
  itemId: string;
  productId: string;
  productTitle: string;
  productType: string;
  priceCents: number;
  downloadUrl: string;
  maxDownloads: number;
  remainingDownloads: number;
}

export interface EmailDispatchResultDto {
  success: boolean;
  messageId?: string;
  provider: string;
  recipient: string;
  dispatchedAt: string;
}
```

### 4.2 Mail Service & Provider Interfaces
```typescript
export interface EmailMessage {
  to: string | string[];
  from?: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface EmailSendResult {
  success: boolean;
  messageId?: string;
  provider: string;
  error?: string;
}

export interface IEmailProvider {
  readonly providerName: string;
  sendEmail(message: EmailMessage): Promise<EmailSendResult>;
}

export interface IMailService {
  sendEmail(message: EmailMessage): Promise<EmailSendResult>;
  sendOrderFulfillmentEmail(
    orderId: string,
    recipientEmail: string,
    recipientName?: string,
    traceId?: string
  ): Promise<EmailSendResult>;
}
```

### 4.3 Environment Variables (`EnvSchema`)
```typescript
EMAIL_PROVIDER: z.enum(["resend", "ses", "mock"]).default("mock"),
EMAIL_FROM: z.string().default("VetraLink Pro <orders@vetralink.pro>"),
RESEND_API_KEY: z.string().optional(),
AWS_SES_REGION: z.string().optional(),
API_BASE_URL: z.string().url().default("http://localhost:3001"),
```

---

## 5. Security & Edge Cases

1. **PII Protection**: Customer email addresses in logs are masked (e.g. `c***r@vetralink.pro`).
2. **Quota Gating**: Even if an email is forwarded to unauthorized third parties, clicking the download link enforces the 5-download quota limit and user authentication if accessed directly.
3. **Idempotent Queue Jobs**: BullMQ job IDs for order fulfillment email are deterministic (`mail:order:${orderId}`), preventing duplicate emails if webhooks or fulfillment logic run concurrently.
4. **Resend Endpoint Throttling**: The `POST /api/v1/orders/:id/resend-email` endpoint is throttled (3 requests per minute per user) and guarded with `JwtAuthGuard` and order ownership checks to prevent email spamming.
5. **Provider Failure Fallback**: If the active provider fails, BullMQ retries 3 times with exponential backoff (delay: 2000ms, backoff factor: 2). If all retries fail, an alert log is generated for administrative intervention.
