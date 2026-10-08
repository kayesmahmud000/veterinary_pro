# Registry implementation plan

1. Add failing form/route/response tests against actual animal DTOs and controller permissions.
2. Add scoped body/response schemas and fixed GET/POST/PATCH BFF mappings. No DELETE, generic proxy or backend schema migration.
3. Build animal list, register and detail/basic edit in the authorized farm context; query-preserving pagination, controlled values and dirty-switch guard.
4. Add live farm navigation/registration action, then verify unit, style, isolated production build and browser acceptance. Attempt live API/database acceptance separately.
5. Review, update exact WEB-3 slice and record evidence/limits here and in the parent ledger.

Current status: implemented locally. Strict scoped body/query/response checks, list/register/detail/basic edit, bilingual access/error/dirty feedback and live route navigation are complete. Farm unit checks pass 14/14; the parent controlled-upstream browser suite passes 64 checks, including registry operations in both languages. Tailwind checks and isolated production build pass. See the [parent execution ledger](../web-workspace-design/progress.md) for exact evidence and review corrections.

Live PostgreSQL/Redis/API creation/read/denial acceptance is pending: isolated services refuse connections and docker is unavailable. No production database/provider acceptance is claimed. Pedigree, weight history, tags/imports and archiving remain outside this first slice.
