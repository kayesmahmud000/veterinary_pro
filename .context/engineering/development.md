# Development and coding rules

Apply the relevant [senior role perspectives](../roles.md); refactoring uses the [Maintainability and Regression Prevention role](../roles/architecture-lead.md). Follow the [self-review cycle](../workflows/self-review.md) and [evidence standard](evidence.md). Technical quality means clear responsibilities, natural extensibility and verified behavior within the existing architecture, without speculative abstraction.

Use TypeScript for API/web and Dart for Flutter. Respect `.editorconfig` (two spaces, LF, UTF-8), nearby formatting and existing naming: kebab-case Nest files, PascalCase classes/components, camelCase members, uppercase interface injection tokens. Avoid whole-repository formatting for a local change.

Prefer explicit boundary parameter/return types, `unknown` plus narrowing over new `any`, shared enums over magic status strings, and bounded/validated external input. Do not use casts to disguise an incompatible DTO or null value. API compiler flags are in `apps/api/tsconfig.json`; they do not currently enable every strictness flag claimed by legacy rules. Improve changed code without mass-converting unrelated code.

Keep transport logic in controllers, use cases in services and database operations in repositories. Register interface bindings and import/export providers in the module. Follow the module's existing root vs `services/`/`controllers/` structure. Domain entities should not depend on HTTP request objects. Existing transaction interfaces expose Prisma types; do not add layers merely to pretend this dependency does not exist.

Use domain exceptions from `apps/api/src/common/exceptions/domain.exception.ts` for expected failures. Catch errors only when translating provider/persistence errors, preserving context or performing cleanup; do not swallow errors into successful empty responses. Preserve retryability distinctions and redact logs.

Dependencies: first check existing libraries. Add only when needed, with a documented purpose, maintenance/security review and lockfile update. Use pnpm for workspace packages; Flutter uses pubspec and its lockfile. Do not mix npm/yarn lockfiles or modify generated Prisma clients/build outputs manually. Keep shared contracts usable without server framework dependencies.

Performance work begins with a measured symptom. Bound queries, page large collections, avoid N+1 relations, use appropriate tenant/date indexes and move expensive media/document jobs off request paths using existing queues. Do not introduce microservices, new state libraries or caching layers without a concrete requirement and decision record.

See [API](api.md), [database](database.md), [security](security.md), [testing](testing.md). Follow [agent instructions](../agent-instructions.md) for spec/plan and Git policy.
