# SPEC-103: Runtime Environment Configuration with Strict Zod Validation & Typed EnvService
# Status: PROPOSED (Pending Review)
# Phase 1: Foundation, DB Migration & Auth RBAC
# Sprint 1: Database Engine, Prisma Migration & Framework Core
# Task 1.3: Runtime environment configuration with strict Zod validation (env.schema.ts)
# Author: Elite Software Architect & Tech Lead

---

## 1. Feature Overview & Objective

### 1.1 Objective
Establish an enterprise-grade, strongly typed, and resilient runtime configuration system for VETRALINK PRO. In twelve-factor application architecture, configuration must be strictly separated from code and validated at the earliest bootstrap lifecycle boundary (`fail-fast`). 

This task implements:
1. A rigorous **Zod schema (`env.schema.ts`)** validating all core, security, database, cache, storage, and third-party environment variables.
2. Production-grade **conditional validation**: Ensuring critical production secrets (Stripe, AWS credentials) are strictly enforced in `production`/`staging` while providing smooth defaults in `development` and `test`.
3. A type-safe **`EnvService`** extending/wrapping NestJS `ConfigService` to eliminate loose string literals (`config.get('JWT_SECRET')`) across domain services and controllers.
4. Redaction of sensitive values during validation failure logs to prevent secret leakage in CI/CD or stdout logs.

### 1.2 Target Deliverables for Task 1.3
1. Authoritative Zod schema: `apps/api/src/config/env.schema.ts` matching Section 8 of `ARCHITECTURE.md`.
2. Dedicated typed configuration service: `apps/api/src/config/env.service.ts` and module `apps/api/src/config/config.module.ts`.
3. Updated `.env` and `.env.example` reflecting all standardized environment keys.
4. Comprehensive unit test suite (`apps/api/src/config/env.schema.spec.ts` & `env.service.spec.ts`) validating schema parsing, environment conditional constraints, default fallbacks, and error boundaries.

---

## 2. Current State vs. Proposed State

| Dimension | Current State | Proposed State (Task 1.3) |
| :--- | :--- | :--- |
| **Schema Scope** | Basic 10-field schema without staging/prod conditions or AWS/S3/Stripe variables. | Comprehensive schema covering all 21 architectural variables defined in `ARCHITECTURE.md`. |
| **Type Safety** | Accessing config requires `configService.get<T>('KEY')` with manual string keys. | Type-safe `EnvService` with strongly typed getters (e.g., `env.databaseUrl`, `env.jwtAccessSecret`, `env.isProduction`). |
| **Error Diagnostics** | Raw console dump of Zod issues; potential secrets exposure in error stack. | Formatted, structured validation error reporting with sanitized error details and clean fatal shutdown. |
| **Environment Parity** | Same loose rules apply to dev, test, and prod. | Environment-aware validation: strict in `production`, non-blocking fallbacks in `development` / `test`. |
| **Test Coverage** | Zero tests for environment parsing or validation rules. | 100% unit test coverage for validation errors, default resolution, and getter typings. |

---

## 3. Architectural & Design Trade-offs

### 3.1 Validation Engine: `class-validator` (Joi/Class) vs. `Zod`
- **Option A: `class-validator` + `class-transformer`**
  - *Pros*: Common in standard NestJS tutorials.
  - *Cons*: Clunky decorators; verbose boilerplate; awkward type inference; poor support for environment transformations (coercion, hex length validation, refined conditional requirements).
- **Option B: Zod Schema Validation (`z.object(...)`) (CHOSEN)**
  - *Pros*: Single source of truth for both runtime validation and static TypeScript types (`z.infer<typeof EnvSchema>`); composable, zero-runtime-dependency validator; powerful `.refine()` / `.superRefine()` for cross-field dependencies (e.g., requiring Stripe keys only in production).
  - *Justification*: Already mandated by Section 3.3 and 8 of `.antigravityrules` and `ARCHITECTURE.md`.

### 3.2 Configuration Access Pattern: Direct `ConfigService` vs. Dedicated `EnvService`
- **Option A: Direct `ConfigService<EnvConfig>` Injection across all modules**
  - *Cons*: Developers can make typos in string keys (`config.get('JWT_SECRETT')`); requires generic parameter on every injection; no place to attach computed helper properties like `isProduction`, `isDevelopment`, `dbPoolSize`.
- **Option B: Wrapper `EnvService` (CHOSEN)**
  - *Pros*: Pure encapsulation; provides type-safe getter properties (`envService.databaseUrl`, `envService.isProduction`); centralizes custom transformations; makes mocking in unit tests trivial.
  - *Justification*: Enforces Clean Architecture and SOLID principles (Single Responsibility & Interface Segregation).

---

## 4. Environment Schema & Type Contracts

### 4.1 Variables Matrix & Constraints

| Variable Name | Type | Allowed Values / Format | Required In Prod? | Default (Dev/Test) |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | Enum | `development`, `staging`, `production`, `test` | Yes | `development` |
| `PORT` | Number | Integer 1024–65535 | Yes | `3001` |
| `DATABASE_URL` | URL | Valid PostgreSQL connection string | Yes | Local dev postgres string |
| `DATABASE_REPLICA_URL` | URL | Valid PostgreSQL connection string | Optional | `undefined` |
| `REDIS_URL` | URL | Valid Redis connection string | Yes | Local dev redis string |
| `JWT_ACCESS_SECRET` | String | Min 32 chars | Yes | Dev default (32+ chars) |
| `JWT_REFRESH_SECRET` | String | Min 32 chars | Yes | Dev default (32+ chars) |
| `JWT_ACCESS_EXPIRATION` | String | Duration format (`15m`, `1h`) | Yes | `15m` |
| `JWT_REFRESH_EXPIRATION` | String | Duration format (`7d`, `30d`) | Yes | `7d` |
| `AES_PII_ENCRYPTION_KEY` | String | Exact 64 hex characters (32 bytes) | Yes | Dev 64-hex key |
| `HASH_PEPPER` | String | Min 16 chars | Yes | Dev 16+ chars |
| `CORS_ORIGINS` | String | Comma-separated URLs or wildcard | Yes | `http://localhost:3000` |
| `SLOW_QUERY_THRESHOLD_MS` | Number | Positive integer | No | `200` |
| `DB_CONNECT_RETRY_DELAY_MS` | Number | Positive integer | No | `1000` |
| `AWS_REGION` | String | AWS region string | In Prod | `us-east-1` |
| `AWS_ACCESS_KEY_ID` | String | String | In Prod | Optional in dev |
| `AWS_SECRET_ACCESS_KEY` | String | String | In Prod | Optional in dev |
| `S3_BUCKET_MEDIA` | String | Bucket identifier | In Prod | `vetralink-media-dev` |
| `S3_BUCKET_DELIVERIES` | String | Bucket identifier | In Prod | `vetralink-deliveries-dev` |
| `STRIPE_SECRET_KEY` | String | Starts with `sk_` | In Prod | Optional in dev |
| `STRIPE_WEBHOOK_SECRET` | String | Starts with `whsec_` | In Prod | Optional in dev |
| `DAILY_API_KEY` | String | String | Optional | `undefined` |

### 4.2 TypeScript Type Definition
```typescript
export type EnvConfig = z.infer<typeof EnvSchema>;
```

### 4.3 `IEnvService` Contract Interface
```typescript
export interface IEnvService {
  readonly nodeEnv: string;
  readonly port: number;
  readonly isProduction: boolean;
  readonly isDevelopment: boolean;
  readonly isTest: boolean;
  readonly databaseUrl: string;
  readonly databaseReplicaUrl?: string;
  readonly redisUrl: string;
  readonly jwtAccessSecret: string;
  readonly jwtRefreshSecret: string;
  readonly jwtAccessExpiration: string;
  readonly jwtRefreshExpiration: string;
  readonly aesPiiEncryptionKey: string;
  readonly hashPepper: string;
  readonly corsOrigins: string[];
  readonly slowQueryThresholdMs: number;
  readonly dbConnectRetryDelayMs: number;
  readonly awsRegion: string;
  readonly awsAccessKeyId?: string;
  readonly awsSecretAccessKey?: string;
  readonly s3BucketMedia: string;
  readonly s3BucketDeliveries: string;
  readonly stripeSecretKey?: string;
  readonly stripeWebhookSecret?: string;
  readonly dailyApiKey?: string;
}
```

---

## 5. Security & Edge Cases

1. **Fail-Fast Boot**:
   - If validation fails during bootstrap, the process logs the specific invalid fields and immediately throws an error halting application startup.
2. **Secrets Redaction in Failure Diagnostics**:
   - The logger never prints values of secret fields (e.g. `JWT_ACCESS_SECRET`, `STRIPE_SECRET_KEY`, `AES_PII_ENCRYPTION_KEY`). Only the field name and error validation code (e.g., "String must contain at least 32 character(s)") are output.
3. **AES-256-GCM Key Rigidity**:
   - `AES_PII_ENCRYPTION_KEY` must be validated with regular expression `/^[0-9a-fA-F]{64}$/` to ensure it is exactly 32 raw bytes in hexadecimal format. Any key with an incorrect byte size will immediately fail validation.
4. **CORS Origins Parsing**:
   - `corsOrigins` getter splits comma-separated strings and trims whitespace cleanly, preventing misconfigured origin headers.

---

## 6. Verification Criteria

1. **Unit Test Pass**: All schema and service unit tests pass (100% green).
2. **Fail-Fast Verification**: Confirming that omitting or providing an invalid `DATABASE_URL` or a non-64-character `AES_PII_ENCRYPTION_KEY` immediately causes validation to reject with code 1.
3. **TypeScript Strict Type-Checking**: `nest build` executes cleanly with zero type errors.
