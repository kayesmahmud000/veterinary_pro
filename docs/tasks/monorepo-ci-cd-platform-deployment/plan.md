# VETRALINK PRO — Independent Platform-Wise CI/CD Execution Plan
# Version: 1.0.0 | Date: 2026-10-04 | Task: monorepo-ci-cd-platform-deployment

---

## 1. Prerequisites
- [x] Node.js 20+, pnpm 10+, and Turborepo workspace.
- [x] `apps/api` (NestJS), `apps/web` (Next.js), and `apps/mobile` (Flutter).

---

## 2. Implementation Steps

### Step 1: GitHub Actions CI/CD Pipeline
- [x] Create `.github/workflows/api-ci.yml` (path-triggered on `apps/api/**` and `packages/**`).
- [x] Create `.github/workflows/web-ci.yml` (path-triggered on `apps/web/**` and `packages/**`).
- [x] Create `.github/workflows/mobile-ci.yml` (path-triggered on `apps/mobile/**`).

### Step 2: Vercel Ignored Build Step & Web Configuration
- [x] Verify `apps/web` Next.js build.
- [x] Document Turborepo `npx turbo-ignore` configuration for independent Vercel projects.

### Step 3: Comprehensive Multi-Platform Setup Guide
- [x] Provide clear, step-by-step documentation explaining:
  - Architecture comparison: Monorepo vs Polyrepo (3 repos).
  - How to connect GitHub to Vercel for 2 separate projects (`vetralink-api` and `vetralink-web`) from the SAME GitHub repo.
  - How `npx turbo-ignore` ensures zero cross-triggering between projects.
  - How Flutter Mobile builds run automatically via GitHub Actions and export `.apk`.
  - Alternative: How to split into 3 distinct Git repositories if strict repo isolation is desired.
