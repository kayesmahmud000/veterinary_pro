# VETRALINK PRO — Vercel Serverless Backend Deployment Specification
# Version: 1.0.0 | Date: 2026-10-04 | Task: vercel-backend-deployment

---

## 1. Feature Overview & Objective

### 1.1 Objective
Enable frictionless deployment of the VETRALINK PRO NestJS backend (`apps/api`) to **Vercel** as a serverless application, allowing stakeholders, developers, and QA teams to test, inspect, and share live API endpoints and Swagger OpenAPI documentation via a public HTTPS URL.

### 1.2 Problem Statement
The NestJS application was originally built as a long-lived Node.js daemon running on a dedicated port (`app.listen(port)`), utilizing local Docker containers for PostgreSQL and Redis.
When deploying directly to Vercel:
1. **Execution Model Mismatch**: Vercel executes serverless functions (AWS Lambda under the hood), which require an exported request handler `(req, res)` rather than a continuously listening daemon.
2. **Cold Starts & Instance Re-bootstrap**: Without caching the NestJS Express instance, every incoming request would re-bootstrap the entire NestJS DI container, causing 3-5 second latencies.
3. **Database & Cache Accessibility**: Localhost Docker instances (`localhost:5432`, `localhost:6379`) are inaccessible from Vercel's cloud functions. Managed cloud services (e.g. Neon Serverless Postgres, Upstash Redis) must be used.
4. **Prisma Binary Engines**: Vercel's serverless environment runs on Amazon Linux/RHEL. Prisma Client must be configured with `rhel-openssl` binary targets.
5. **Swagger UI Asset Loading**: NestJS Swagger UI by default relies on local static npm assets (`swagger-ui-dist`), which often 404 in serverless lambda environments unless loaded via CDN.
6. **Turborepo Monorepo Dependencies**: `@vetralink/api` depends on `@vetralink/shared-types`. The Vercel build pipeline must resolve and compile workspace packages.

---

## 2. Current State vs. Proposed State

| Capability | Current State (Local Daemon) | Proposed State (Vercel Serverless) |
| :--- | :--- | :--- |
| **Boot Mechanism** | `app.listen(port)` in `main.ts` | Serverless handler `api/index.ts` with `ExpressAdapter` and memory cache |
| **Routing** | Node HTTP Server router | `vercel.json` rewrite routing all incoming requests `/(.*)` to `/api` |
| **Prisma Engine** | Native Windows/Linux engine | `native`, `rhel-openssl-1.0.x`, `rhel-openssl-3.0.x` |
| **Database** | Local PostgreSQL 16 container | Cloud PostgreSQL (Neon / Supabase) with connection pooling |
| **Redis Connection** | Non-TLS local Redis 7 (`redis://`) | TLS-aware connection (`rediss://`) supporting Upstash Redis |
| **Swagger UI** | Local file serving at `/api/docs` | CDN-backed Swagger UI (`cdnjs`) at `/api/docs` |
| **Environment Check** | Requires live Stripe/AWS keys if `NODE_ENV=production` | Tested with `NODE_ENV=development` or test stubs for API verification |

---

## 3. Architectural & Design Trade-offs

### Option A: Direct Serverless Function on Vercel (Selected)
- **Architecture**: Express adapter wraps NestJS in `apps/api/api/index.ts`. All routes rewritten through `vercel.json`.
- **Pros**:
  - Zero server management, instant provisioning, zero cost on Vercel hobby tier.
  - Automatic HTTPS and preview URLs per git branch.
  - Perfect for "checking and sharing APIs" with team members and clients.
- **Cons & Serverless Constraints**:
  - BullMQ background consumer workers cannot run as continuous daemon loops (HTTP endpoints that enqueue or read from DB work fine).
  - WebSockets (Socket.IO for live video consultations) are not supported by serverless lambdas.
  - Cold starts on first invocation (mitigated by warm instance caching).

### Option B: Dedicated Container Host (Render / Railway / Fly.io / AWS ECS)
- **Architecture**: Docker container running `node dist/main.js`.
- **Pros**: Full support for background workers and persistent WebSockets.
- **Cons**: Requires dedicated container billing/instance management; user explicitly requested Vercel deployment for checking and sharing APIs.

---

## 4. Technical Contracts & Implementation Details

### 4.1 Serverless Entry Point (`apps/api/api/index.ts`)
- Utilizes `ExpressAdapter` from `@nestjs/platform-express`.
- Retains instance in `cachedServer: Express` across invocations.
- Applies:
  - `helmet` (with content security policy relaxed for Swagger CDN)
  - `cors` (accepting requests from frontend origins)
  - `app.setGlobalPrefix('api/v1')`
  - `ValidationPipe` with `transform: true` and `whitelist: true`
  - `ResponseInterceptor` and `GlobalExceptionFilter`
  - `SwaggerModule.setup('api/docs', ...)` with unpkg/cdnjs CDN bundles.

### 4.2 Vercel Configuration (`apps/api/vercel.json`)
```json
{
  "version": 2,
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/api"
    }
  ]
}
```

### 4.3 Redis TLS Support (`apps/api/src/app.module.ts`)
Update BullModule connection factory to enable `tls: url.protocol === "rediss:" ? {} : undefined` and `maxRetriesPerRequest: null` for cloud Redis providers like Upstash.

### 4.4 Prisma Binary Targets (`apps/api/prisma/schema.prisma`)
Add `binaryTargets = ["native", "rhel-openssl-1.0.x", "rhel-openssl-3.0.x"]` to ensure compatibility across developer machines and Vercel cloud environments.

---

## 5. Security & Edge Cases

1. **Database Connection Exhaustion**:
   - Serverless functions can open multiple concurrent connections. Using Neon's pooled connection string (`-pooler`) or Supabase transaction pooler (port 6543) prevents Postgres max-connections exhaustion.
2. **Cold Start Latency**:
   - First call takes 2-3s to initialize NestJS dependencies. Subsequent warm requests respond in 20-50ms.
3. **Environment Validation Failures**:
   - If deploying for testing and sharing, set `NODE_ENV=development` in Vercel to allow development defaults for optional integration keys, or supply valid test keys (`sk_test_...`).
