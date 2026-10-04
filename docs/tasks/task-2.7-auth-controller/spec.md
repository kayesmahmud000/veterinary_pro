# SPEC-207: AuthController Endpoints, Swagger OpenAPI Docs & Integration Test Suite

## 1. Feature Overview & Objective
Task 2.7 is the capstone task of **Sprint 2: Authentication, Token Lifecycle & Multi-Tenant RBAC**.
With the underlying domain services, encryption engines, repositories, and guards (`AuthService`, `TokenService`, `JwtAuthGuard`, `RolesGuard`, `TenantGuard`) fully operational and verified, we need to expose the public and authenticated HTTP surface for authentication:
- `POST /api/v1/auth/register`: Public onboarding for farmers, veterinarians, and marketplace buyers.
- `POST /api/v1/auth/login`: Credential verification via email/phone and password, returning JWT access & refresh tokens.
- `POST /api/v1/auth/refresh`: Refresh token rotation (RTR) endpoint issuing new access & refresh token pairs.
- `POST /api/v1/auth/logout`: Single-session revocation given an active refresh token.
- `POST /api/v1/auth/logout-all`: Global revocation revoking all active refresh tokens for the authenticated user.
- `GET /api/v1/auth/me`: Profile endpoint returning authenticated user identity and verified status.

All endpoints must be thoroughly documented in Swagger/OpenAPI, validate incoming payloads via `class-validator` and `class-transformer`, conform to the unified `ApiResponse<T>` envelope, and include comprehensive unit and integration tests.

---

## 2. Current State vs. Proposed State

### Current State
- `AuthService` and `TokenService` implement registration, password hashing (bcrypt 12 rounds), token generation, token rotation, reuse breach detection, and session revocation.
- Domain exceptions (`EntityConflictException`, `UnauthorizedDomainException`, `ForbiddenOperationException`, `ValidationDomainException`) map to standardized HTTP error responses via `GlobalExceptionFilter`.
- `ApiResponse<T>` wraps successful responses via `ResponseInterceptor`.
- Shared DTO interfaces exist in `@vetralink/shared-types`, but concrete NestJS class-based DTOs decorated with `class-validator` and `@ApiProperty` are not yet defined in `apps/api`.
- No HTTP controller exists in `apps/api/src/modules/auth/`.
- `AuthModule` does not declare a controller.

### Proposed State
- Create `apps/api/src/modules/auth/dto/`:
  - `register.dto.ts`: Validates `email`, `password` (min 8 chars, mixed complexity), `name`, `role` (restricted to non-admin roles), `phone` (E.164 optional).
  - `login.dto.ts`: Validates `email` or `phone`, `password`, optional `rememberMe`.
  - `refresh-token.dto.ts`: Validates `refreshToken` string.
  - `logout.dto.ts`: Validates `refreshToken` string.
- Create `@ClientMeta()` parameter decorator in `apps/api/src/common/decorators/client-meta.decorator.ts` to extract client IP (`req.ip` or `x-forwarded-for`) and User-Agent (`req.headers['user-agent']`).
- Create `AuthController` (`apps/api/src/modules/auth/auth.controller.ts`):
  - Decorated with `@ApiTags('Authentication')`, `@Controller('auth')`.
  - Injects `IAuthService` via `AUTH_SERVICE` token and `IUserRepository` via `USER_REPOSITORY`.
  - Implements route handlers with proper HTTP status codes (`@HttpCode(HttpStatus.OK)` for login, refresh, logout, logout-all).
  - Uses `@ResponseMessage(...)` for standard success messages.
  - Uses `@Public()` for unauthenticated routes (`register`, `login`, `refresh`, `logout`).
  - Uses `@UseGuards(JwtAuthGuard)` and `@ApiBearerAuth()` for authenticated routes (`logout-all`, `me`).
- Register `AuthController` in `AuthModule`.
- Unit tests (`auth.controller.spec.ts`) covering all 6 endpoints, validation handling, and metadata injection.
- Integration tests (`auth.controller.int.spec.ts` / supertest) validating HTTP pipeline, ValidationPipe whitelist, response envelopes, and exception filter integration.

---

## 3. Architectural & Design Trade-offs

| Design Decision | Approach A | Approach B (Selected) | Rationale |
| :--- | :--- | :--- | :--- |
| **DTO Class Strategy** | Direct use of TypeScript interfaces from `@vetralink/shared-types` with custom pipe validation | Class-based DTOs in `apps/api` implementing `@vetralink/shared-types` interfaces decorated with `class-validator` and `@nestjs/swagger` | NestJS `ValidationPipe` and Swagger metadata reflection require runtime JavaScript classes with property metadata decorators. Implementing the shared interface guarantees type parity with `@vetralink/shared-types`. |
| **Client Metadata Resolution** | Accessing Express `Request` directly in controller methods (`req.ip`, `req.headers['user-agent']`) | Custom `@ClientMeta()` parameter decorator | Decouples controller logic from the underlying Express platform, avoids mocking whole `Request` objects in unit tests, and encapsulates IP normalization (handling proxy `x-forwarded-for` headers). |
| **Logout Endpoint Guarding** | Require valid JWT Bearer header (`JwtAuthGuard`) on `POST /auth/logout` | Mark `@Public()` with mandatory `refreshToken` body | When access tokens expire (15 min TTL), a client attempting to log out cannot pass `JwtAuthGuard` without first refreshing. Allowing refresh token revocation via body allows graceful logouts even after access token expiry. Global logout (`POST /auth/logout-all`) still strictly requires `JwtAuthGuard`. |
| **User Profile Resolution for `GET /auth/me`** | Return cached payload from JWT (`req.user`) | Fetch fresh user record from `IUserRepository` using `req.user.sub` | Returning only JWT payload misses changes made after token issuance (status change, verified email, updated profile). Fetching fresh data guarantees accuracy while `JwtAuthGuard` validates the signature and active token. |

---

## 4. Data Models & API Contracts

### Endpoints
```http
POST /api/v1/auth/register
Headers: Content-Type: application/json
Body:
{
  "email": "farmer@vetralink.com",
  "password": "SecurePassword123!",
  "name": "John Doe",
  "role": "FARMER",
  "phone": "+1234567890"
}
Response (201 Created):
{
  "success": true,
  "statusCode": 201,
  "message": "User registered successfully",
  "data": {
    "user": {
      "id": "uuid",
      "email": "farmer@vetralink.com",
      "name": "John Doe",
      "role": "FARMER",
      "status": "ACTIVE",
      "isEmailVerified": false,
      "maskedPhone": "+1234****90",
      "avatarUrl": null,
      "createdAt": "2026-09-05T..."
    },
    "tokens": {
      "accessToken": "ey...",
      "refreshToken": "ey...",
      "tokenType": "Bearer",
      "expiresIn": 900
    }
  },
  "traceId": "uuid",
  "timestamp": "2026-09-05T..."
}
```

```http
POST /api/v1/auth/login
Headers: Content-Type: application/json
Body:
{
  "email": "farmer@vetralink.com",
  "password": "SecurePassword123!"
}
Response (200 OK):
{
  "success": true,
  "statusCode": 200,
  "message": "Login successful",
  "data": {
    "user": { ... },
    "tokens": { ... }
  },
  "traceId": "uuid",
  "timestamp": "2026-09-05T..."
}
```

```http
POST /api/v1/auth/refresh
Headers: Content-Type: application/json
Body:
{
  "refreshToken": "ey..."
}
Response (200 OK):
{
  "success": true,
  "statusCode": 200,
  "message": "Tokens refreshed successfully",
  "data": {
    "tokens": { ... }
  },
  "traceId": "uuid",
  "timestamp": "2026-09-05T..."
}
```

```http
POST /api/v1/auth/logout
Headers: Content-Type: application/json
Body:
{
  "refreshToken": "ey..."
}
Response (200 OK):
{
  "success": true,
  "statusCode": 200,
  "message": "Logout successful",
  "data": null,
  "traceId": "uuid",
  "timestamp": "2026-09-05T..."
}
```

```http
POST /api/v1/auth/logout-all
Headers:
  Authorization: Bearer <accessToken>
Response (200 OK):
{
  "success": true,
  "statusCode": 200,
  "message": "All sessions revoked successfully",
  "data": null,
  "traceId": "uuid",
  "timestamp": "2026-09-05T..."
}
```

```http
GET /api/v1/auth/me
Headers:
  Authorization: Bearer <accessToken>
Response (200 OK):
{
  "success": true,
  "statusCode": 200,
  "message": "Profile retrieved successfully",
  "data": {
    "id": "uuid",
    "email": "farmer@vetralink.com",
    "name": "John Doe",
    "role": "FARMER",
    "status": "ACTIVE",
    "isEmailVerified": false,
    "maskedPhone": "+1234****90",
    "avatarUrl": null,
    "createdAt": "2026-09-05T..."
  },
  "traceId": "uuid",
  "timestamp": "2026-09-05T..."
}
```

---

## 5. Security & Edge Cases
1. **Administrative Role Escalation**:
   - `RegisterDto` strictly checks against `SUPER_ADMIN` and `ADMIN` roles. If submitted, `AuthService` rejects with `ForbiddenOperationException` (403).
2. **Input Sanitization & Whitelisting**:
   - `ValidationPipe` with `whitelist: true` and `forbidNonWhitelisted: true` strips or rejects unrecognized query/body properties.
3. **Password Security**:
   - Minimum 8 characters, maximum 128 characters.
4. **Token Exposure**:
   - Refresh token is never sent in URL query strings or headers; always payload-bound in JSON body.
5. **Session Invalidation**:
   - Reuse of a previously rotated refresh token invalidates all tokens for that user immediately.
6. **Graceful IP & User-Agent Parsing**:
   - Handles IPv4, IPv6, reverse proxy `x-forwarded-for` comma lists, and absent User-Agent strings.
