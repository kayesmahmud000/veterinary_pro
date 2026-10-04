# VETRALINK PRO — Vercel Serverless Backend Deployment Execution Plan
# Version: 1.0.0 | Date: 2026-10-04 | Task: vercel-backend-deployment

---

## 1. Prerequisites
- [x] Node.js 20+ and pnpm installed locally.
- [x] Turborepo monorepo structure with `@vetralink/shared-types` and `@vetralink/api`.
- [x] Neon / Supabase cloud PostgreSQL database account (free tier).
- [x] Upstash cloud Redis account (free tier).

---

## 2. Implementation Steps

### Step 1: Serverless Entry Point & Adapter
- [x] Create `apps/api/src/serverless.ts` with cached Express server instance, NestJS bootstrap, Swagger CDN UI, and handler.
- [x] Create `apps/api/api/index.js` exporting the compiled serverless handler for Vercel.
- [x] Create `apps/api/vercel.json` routing configuration with `/(.*)` rewrite to `/api`.

### Step 2: Infrastructure & Engine Compatibility
- [x] Update `apps/api/prisma/schema.prisma` with `binaryTargets = ["native", "rhel-openssl-1.0.x", "rhel-openssl-3.0.x"]`.
- [x] Update `apps/api/src/app.module.ts` BullModule connection factory to support `rediss://` TLS for Upstash Redis.
- [x] Add explicit `express` dependency in `apps/api/package.json`.
- [x] Add `vercel-build` command in `apps/api/package.json` (`prisma generate && nest build`).

### Step 3: Deployment Template & Environment Configuration
- [x] Create `apps/api/.env.vercel.example` with cloud database, Upstash Redis, and development defaults for easy copy-pasting into Vercel dashboard.

### Step 4: Build Verification & Testing
- [x] Run `pnpm prisma generate` to verify binary targets.
- [x] Run `pnpm --filter @vetralink/api build` to verify successful compilation of serverless entry point and API.
- [x] Verify handler import resolution in Node.js runtime.

### Step 5: End-to-End Documentation & User Process Guide
- [x] Provide the complete step-by-step walkthrough covering database setup (Neon/Supabase), Redis setup (Upstash), Vercel dashboard project import, environment variables configuration, database migration, and live API verification via Swagger UI (`/api/docs`).
