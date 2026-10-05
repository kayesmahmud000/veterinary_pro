# Known gaps and documentation drift

Source review baseline: **2026-10-05 / 4b1597a**. These observations are not a full penetration test or a live deployment audit. They are investigation priorities, not permission to expand an unrelated task. Revalidate before fixing; attach test/evidence links when resolving.

| Area | Observed evidence | Consequence / next verification |
| --- | --- | --- |
| Client completeness | Web has only layout/home; mobile main is a text screen with an unconnected sync library | Do not call dashboards, clinical editors, auth navigation or offline product UX complete |
| Schema authority | API package selects `apps/api/prisma/schema.prisma`; root schema differs | Use API schema explicitly; compare/consolidate only as a separate migration-aware task |
| CI/test claims | API/web workflows build only; Jest has no coverage threshold; e2e config is absent | “80% enforced” and comprehensive CI test claims are unsupported; measure actual tests |
| Lint/tooling | ESLint scripts exist without checked-in configuration/direct lint dependencies | Verify/setup tooling in a scoped task; never label skipped lint as passed |
| Mobile delivery | No platform directories; `path` used without direct dependency | Flutter CI release build and device readiness need verification |
| Deployment topology | No API/web Dockerfiles; Compose only backs DB/cache/storage | Old container/non-root production claims are not implemented artifacts here |
| Serverless disclosure | `apps/api/api/index.js` diagnostics exposes paths/files and error stacks; `src/serverless.ts` catches errors into HTTP 200 | Must assess/restrict diagnostics and correct error handling before production approval |
| Serverless security parity | `src/serverless.ts` reflects origins when unset, disables CSP/COEP; differs from `main.ts` | Verify explicit origins and security headers in the selected runtime |
| Environment defaults | `EnvSchema` accepts development secrets; Vercel branch skips integration validation | Boot success is insufficient; require production secret/integration checks |
| Crypto persistence | `common/crypto/pki-crypto.service.ts` generates in-memory keys without RSA env | Verify persistent keys and historical signature verification across restarts/rotation |
| Notification delivery | Consultations binds mock SMS/push; clinical-health includes mock providers | Do not claim real reminders/notifications were delivered; inspect every binding |
| Other provider fallbacks | Orders may use mock gateway; mail defaults to mock | Verify selected production providers, failure handling and actual sandbox delivery |
| Guard/rate-limit claims | Controller-scoped guards; no installed throttler shown by manifests/bootstrap | Check every public/protected endpoint; rate-limit requirements are not automatically enforced |
| Logging/typing | Nest Logger and existing `any`; API tsconfig lacks some advertised strict flags | Legacy Pino/zero-any/all-strict claims describe goals, not current enforcement |
| Sync atomic audit | `SyncService.push` audits after repository transaction | Mutation can commit without corresponding audit; require transaction-bound regression evidence |
| Sync permissions | Service checks membership; does not reuse normal farm-role/subscription guards | Verify permission parity and record/foreign-key farm ownership before broad offline rollout |
| Sync durability | Client removes queued rows on push success even when conflicts are returned; pull watermark is assigned after query on server | Exercise conflict retention, lost acknowledgements, concurrent edits and cursor race behavior |
| SQLite evolution | Version 1 `onCreate` only; engine not wired into UI | Add tested upgrade/session isolation/recovery behavior when building real mobile flows |
| Workers/realtime | BullMQ processors and chat gateway coexist with serverless bootstrap | Verify durable execution and appropriate realtime/worker hosting, not just HTTP availability |
| Production sign-off | `docs/tasks/task-15.4-security-audit-load-testing-readiness/readiness-report.md` claims certification and metrics; scripts are not run outputs | Treat as historical report, require fresh security/load/runtime evidence; advisory counts are not current facts |

`ARCHITECTURE.md` also lists packages/ui-kit, packages/tsconfig, nginx, feature UI folders, a prescriptions module and other planned paths absent from this checkout. `health/` is infrastructure probes; animal care lives in `clinical-health/`. `WatermelonDB`, Pino and fully implemented web state stores must not be inferred from prose.

Do not silently rewrite history to hide discrepancies. Update the current context and link a task with observed behavior, required behavior, owner/assignee if known, acceptance tests and resolution evidence. Never copy secrets into an issue or report.
