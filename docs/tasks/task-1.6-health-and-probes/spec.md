# SPEC-106: High-Availability Health Monitoring Engine & DB/Redis Readiness Probes
# Status: PROPOSED (Pending Review)
# Phase 1: Foundation, DB Migration & Auth RBAC
# Sprint 1: Database Engine, Prisma Migration & Framework Core
# Task 1.6: Jest test runner and basic /api/v1/health endpoint with DB/Redis probes
# Author: Elite Software Architect & Tech Lead

---

## 1. Feature Overview & Objective

### 1.1 Objective
Establish an enterprise-grade, high-availability health monitoring subsystem for VETRALINK PRO. Container orchestrators (Kubernetes, AWS ECS, Docker Swarm), load balancers, and external status monitors require deterministic endpoints to ascertain system liveness (process vitality) and readiness (ability to process requests without database/cache errors).

This task delivers:
1. **Prisma Database Health Probe**: Validates PostgreSQL connectivity, query execution, and round-trip latency using `PrismaService.ping()`.
2. **Redis Cache & Queue Health Probe**: Validates Redis connectivity and ping latency against `REDIS_URL`.
3. **Multi-Tier Probe Endpoints**:
   - `GET /api/v1/health`: Comprehensive summary of overall platform status and individual dependency metrics.
   - `GET /api/v1/health/liveness`: Lightweight process liveness probe returning HTTP 200 immediately for container orchestrators.
   - `GET /api/v1/health/readiness`: Active readiness probe verifying both PostgreSQL and Redis before traffic routing.
4. **Resilient Error Status (HTTP 503)**: Automatically returns HTTP 503 Service Unavailable if any critical dependency fails, detailing which probe failed while maintaining response envelope standards.
5. **Full Unit & Integration Test Coverage**: Comprehensive Jest test suite testing all health probes, degraded states, and timeout boundaries.

### 1.2 Target Deliverables for Task 1.6
1. Redis service / health indicator (`apps/api/src/modules/health/indicators/redis.health.ts`).
2. Prisma health indicator (`apps/api/src/modules/health/indicators/prisma.health.ts`).
3. Enhanced `HealthController` with `/`, `/liveness`, and `/readiness` endpoints.
4. NestJS Terminus wiring in `HealthModule`.
5. Comprehensive unit test suite (`health.controller.spec.ts`, `prisma.health.spec.ts`, `redis.health.spec.ts`).

---

## 2. Current State vs. Proposed State

| Dimension | Current State | Proposed State (Task 1.6) |
| :--- | :--- | :--- |
| **Database Probe** | None in `HealthController` (returns static uptime). | Active `SELECT 1` execution with millisecond round-trip latency reporting. |
| **Redis Probe** | None. | Active `PING/PONG` check against Redis server with latency tracking. |
| **Probe Segregation** | Single endpoint with static string. | Three dedicated endpoints: full status (`/`), liveness (`/liveness`), and readiness (`/readiness`). |
| **HTTP Status Handling** | Always returns 200 regardless of database/redis availability. | Returns HTTP 200 when all dependencies are healthy; returns HTTP 503 when any dependency fails. |
| **Integration** | Ad-hoc object return. | Integrated with `@nestjs/terminus` and platform `ApiResponse<T>` envelope. |
| **Sprint 1 Completion** | Task 1.6 pending. | Sprint 1 100% complete and verified. |

---

## 3. Architectural & Design Trade-offs

### 3.1 Redis Client Implementation: Standalone Redis Client vs. Socket Ping
- **Option A: Raw TCP Socket Ping (`net.createConnection`)**
  - *Pros*: Zero dependencies.
  - *Cons*: Cannot test Redis authentication or Redis protocol commands (`PING/PONG`); false positives if TCP port is open but Redis is unresponsive or rejecting credentials.
- **Option B: Dedicated Redis Service / Client (`ioredis`) (CHOSEN)**
  - *Pros*: Sends real Redis `PING` command over authenticated connection; measures exact Redis response latency; directly reusable for Phase 2/3 BullMQ queue workers and caching layers.
  - *Justification*: Accurate, production-grade verification of Redis state.

### 3.2 Probe Granularity: Monolithic Health Check vs. Dedicated Liveness/Readiness
- **Option A: Single `/health` endpoint for all probes**
  - *Flaw*: If a database blip occurs, a Kubernetes liveness probe hitting `/health` would restart the entire container prematurely, exacerbating connection pool stampedes.
- **Option B: Segregated Liveness & Readiness Endpoints (CHOSEN)**
  - *Liveness (`/health/liveness`)*: Confirms the Node.js event loop is responsive. Never triggers a container restart during temporary DB network outages.
  - *Readiness (`/health/readiness`)*: Confirms PostgreSQL and Redis are reachable. If degraded, the load balancer removes the container from ingress traffic without killing the process.
  - *Justification*: Industry standard for cloud-native zero-downtime deployments.

---

## 4. API Endpoints & Response Contracts

### 4.1 Comprehensive Health Check: `GET /api/v1/health`
**Response (HTTP 200 OK):**
```json
{
  "success": true,
  "statusCode": 200,
  "message": "All system dependencies operational",
  "data": {
    "status": "ok",
    "info": {
      "database": {
        "status": "up",
        "latencyMs": 4
      },
      "redis": {
        "status": "up",
        "latencyMs": 2
      }
    },
    "details": {
      "database": {
        "status": "up",
        "latencyMs": 4
      },
      "redis": {
        "status": "up",
        "latencyMs": 2
      }
    },
    "system": {
      "uptimeSeconds": 1840,
      "memoryUsageMb": 54.2,
      "environment": "development"
    }
  },
  "traceId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "timestamp": "2026-09-05T13:40:00.000Z"
}
```

**Response on Failure (HTTP 503 Service Unavailable):**
```json
{
  "success": false,
  "statusCode": 503,
  "message": "Health check failed",
  "data": null,
  "errorDetails": {
    "type": "https://vetralink.pro/errors/service-unavailable",
    "title": "SERVICE_UNAVAILABLE",
    "status": 503,
    "detail": "Health check failed for: database",
    "instance": "/api/v1/health"
  },
  "errors": [
    {
      "field": "database",
      "message": "Can't reach database server at localhost:5432"
    }
  ],
  "traceId": "9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d",
  "timestamp": "2026-09-05T13:40:00.000Z"
}
```

---

## 5. Security & Edge Cases

1. **Denial-of-Service (DoS) via Probe Overload**:
   - Each dependency probe enforces a strict 3000ms timeout. A slow or hung database cannot starve worker threads or pile up connections.
2. **Secrets Protection**:
   - Connection URLs, credentials, and authentication strings are never reflected in health check output. Only dependency name and latency are exposed.
3. **Lightweight Liveness**:
   - `/health/liveness` executes zero database or network operations, guaranteeing instantaneous responses under heavy load.

---

## 6. Verification Criteria

1. **Unit Test Pass**: All unit tests in `src/modules/health/` pass with 100% green status.
2. **Probe Resilience**: Tests verify that when PostgreSQL or Redis is down, the readiness probe fails gracefully with HTTP 503.
3. **Zero Type Errors**: `nest build` executes cleanly with zero errors.
