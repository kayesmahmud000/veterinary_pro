# Feature and requirement map

Paths below are relative to `apps/api/src/modules/` unless stated. “Present” means source exists, not that production integration was exercised. Exact routes, enums and response shapes must be read from controllers/shared contracts; task titles alone are insufficient.

| Domain | Implementation and behavior | Existing task documentation |
| --- | --- | --- |
| Identity | `auth/`, `users/`; registration/login/refresh/logout, user entities, encrypted phone lookup, token rotation | `docs/tasks/task-2.4-auth-service-core/`, `task-2.7-auth-controller/` |
| Farm access | `farms/` plus `common/guards/tenant.guard.ts`; farm membership and role checks | `docs/tasks/task-2.6-tenant-guard/` |
| Animal registry | `animals/`; registration, tag/RFID availability, pedigree traversal, weight history/growth, queued import, QR badges | `docs/tasks/task-6.1-animal-registration/` through task 6.6 directories |
| Milk production | `milk-logs/`; per-session and bulk collection, yield trends, anomaly processor, CSV/Excel export | task 7.1–7.5 directories under `docs/tasks/` |
| Clinical health | `clinical-health/`; incidents, vaccinations/deworming, reminder/escalation queues, S3 attachments | task 8.1–8.5 directories |
| Farm finances | `financial/`; expense/revenue repositories, date-range P&L, feed/cost analytics, monthly PDF | task 9.1–9.5 directories |
| Digital catalogue | `products/`, `media/`; product types, search, S3 multipart upload, FFmpeg transcode, DRM entitlement and stream delivery | task 3.1–3.6 directories |
| Commerce | `orders/`, `watermark/`, `mail/`; checkout snapshots, Stripe/MFS webhooks, fulfillment, watermarked delivery and mail queues | task 4.1–5.5 directories |
| Subscription | `subscriptions/`; plans, lifecycle, quotas, plan changes, portal, recurring failure/dunning, read-only access, metrics | task 10.1–11.4 directories |
| Tele-vet | `consultations/`; intake, triage, vet assignment/availability, payment hold, notification, EHR, video provider, chat, private notes | task 12.1–13.4 directories |
| Prescriptions | Inside `consultations/`, not a separate prescriptions module; structured drugs, withdrawal alerts, RSA signing, PDF/QR verification, EHR append | task 14.1–14.6 directories |
| Settlement/reviews | Consultation payout ledger and reviews/moderation | task 15.1–15.2 directories |
| Offline sync | `sync/` plus Flutter `lib/core/sync/`; six-entity delta protocol | [sync details](offline-sync.md), `docs/tasks/task-15.3-mobile-offline-sync-engine/` |
| Operations | `health/` is service health/probes, not animal clinical health; `audit/` records mutations | task 1.5, 1.6 and 15.4 directories |

## Domain invariants to preserve

**Farm ERP:** authorize the selected farm and every referenced animal; keep tag/RFID uniqueness scoped to active records in the correct farm. Validate pedigree links/cycles, units, dates and duplicate milk sessions. Animal updates can affect sync, quotas, EHR, milk analytics, imports and finance. Test those dependencies when their fields or lifecycle change.

**Money:** preserve currency, decimal precision, immutable purchase prices and state transitions. Never fulfill from a browser success redirect alone. Webhook signatures, replay safety and retryable queue work are part of the contract. Quota checks must survive concurrent writes; verify database/transaction behavior rather than relying only on a preflight count.

**Clinical:** preserve author/attending-vet access to private notes and prescription state/signature integrity. Never invent dosage, diagnosis or withdrawal-period rules; require domain-approved requirements for clinical behavior changes. Public verification should disclose only the intentional verification contract, not full private EHR data.

**Integrations:** inspect module bindings for mocks, retries, errors and environment fallbacks. An available provider interface or successful mocked test is not evidence of real delivery. See [known gaps](../known-gaps.md).

Use `rg --files docs/tasks` to locate each exact spec/plan. Keep acceptance criteria in those existing records, and link new task specs here only when they materially improve feature discovery.
