# Vercel role build compatibility specification

Status: Locally verified; deployment pending human-managed Git/Vercel rollout
Date and inspected revision: 2026-10-08 / main, 6f20fbd

## Outcome and scope

Fix the nine TypeScript errors in the supplied Vercel backend build log.
Keep the shared public registration contract (LEARNER/FARMER/VET/BUYER,
omitted role defaults to LEARNER) and reject administrative or unknown roles.
Align the generated API Prisma role enum with that contract. Real notification
worker hosting and mail provider configuration remain deferred by the user.

## Evidence and design

- Observed behavior: Vercel built dev-fontend at 6f20fbd, which is also the
  current main revision. Shared types built successfully; API compilation failed.
- Confirmed from code: shared RegisterRequestDto restricts public roles and
  contains LEARNER; the API DTO accepts every UserRole, the service compares
  narrowed input with admin roles, and API Prisma lacks LEARNER.
- Confirmed from code: the current branch lacks dev-backend's full role request,
  farmer onboarding and current-identity implementation. This bounded build fix
  does not integrate those separate application changes or claim they exist.
- Preserve the shared contract; reuse PUBLIC_REGISTRATION_ROLES in DTO validation
  and service defense. Do not use casts in production to hide enum mismatches.
- Add the original, already deployed learner enum migration verbatim from
  dev-backend. Do not edit applied SQL or run production database commands.
- Add a production tsconfig that excludes tests and emits the flat serverless
  artifact already supported by the repaired Vercel wrapper.
- Clean the generated dist output on each Nest build: validation exposed old
  nested output/specs left by the baseline build and retained without cleanup.

## Contracts and security

POST /api/v1/auth/register remains public with the same response envelope.
The DTO must reject ADMIN, SUPER_ADMIN and unrecognized roles with 400.
Direct service calls must also reject unsupported input before password hashing,
token issuance, repository checks or transactions. Omitted role registers a
LEARNER; explicit public roles are preserved in persistence and session claims.
Other entity/database creation defaults stay unchanged in this bounded repair.

## Acceptance and limits

1. Reproduce the supplied API build failure with fresh shared types and API client.
2. Observe regression tests fail under old runtime validation/default behavior.
3. Pass DTO/service/auth/user regression tests and the actual Vercel build command.
4. Validate the active API schema and the generated flat serverless artifact;
   pass existing wrapper tests. No live DB is used for tests.
5. Re-review the final diff and document the missing full backend feature code.
   Git operations and Vercel rollout remain human-managed.
