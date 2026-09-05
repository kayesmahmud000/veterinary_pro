# PLAN-207: AuthController Endpoints, OpenAPI Docs & Integration Tests Plan
# Phase 1: Foundation, DB Migration & Auth RBAC
# Sprint 2: Authentication, Token Lifecycle & Multi-Tenant RBAC
# Task 2.7: AuthController endpoints, Swagger OpenAPI docs, and integration test suite
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Prerequisites
- [x] Task 2.1: User entity schema, encryption, and blind indexing.
- [x] Task 2.2: Auth DTOs and contracts in `@vetralink/shared-types`.
- [x] Task 2.3: `UserRepository` and `RefreshTokenRepository`.
- [x] Task 2.4: `AuthService`, `TokenService`, and RTR mechanism.
- [x] Task 2.5: Role-based access control (`@Roles()`, `RolesGuard`, `JwtAuthGuard`).
- [x] Task 2.6: Multi-tenant protection (`TenantGuard`).

---

## 2. Granular Implementation Steps

### Step 1: Input Validation DTOs with Swagger Annotations
- [x] Create `apps/api/src/modules/auth/dto/register.dto.ts`:
  - Implements `RegisterRequestDto`.
  - Fields: `email` (`@IsEmail`), `password` (`@IsString`, `@MinLength(8)`), `name` (`@IsString`, `@MinLength(2)`), `role` (`@IsOptional`, `@IsEnum(UserRole)`), `phone` (`@IsOptional`, `@IsString`).
  - Decorated with `@ApiProperty` and `@ApiPropertyOptional`.
- [x] Create `apps/api/src/modules/auth/dto/login.dto.ts`:
  - Implements `LoginRequestDto`.
  - Fields: `email` (`@IsEmail`), `password` (`@IsString`, `@MinLength(1)`), `phone` (`@IsOptional`, `@IsString`), `rememberMe` (`@IsOptional`, `@IsBoolean`).
- [x] Create `apps/api/src/modules/auth/dto/refresh-token.dto.ts`:
  - Implements `RefreshTokenRequestDto`.
  - Fields: `refreshToken` (`@IsString`, `@IsNotEmpty`).
- [x] Create `apps/api/src/modules/auth/dto/logout.dto.ts`:
  - Fields: `refreshToken` (`@IsString`, `@IsNotEmpty`).
- [x] Create `apps/api/src/modules/auth/dto/index.ts` barrel export.

### Step 2: Client Metadata Parameter Decorator
- [x] Create `apps/api/src/common/decorators/client-meta.decorator.ts`:
  - Custom param decorator extracting `ipAddress` (resolving `x-forwarded-for` or `req.ip`) and `userAgent` (`req.headers['user-agent']`).
  - Unit tests in `client-meta.decorator.spec.ts`.
- [x] Export `@ClientMeta()` from `apps/api/src/common/decorators/index.ts`.

### Step 3: `AuthController` Implementation
- [x] Create `apps/api/src/modules/auth/auth.controller.ts`:
  - `@ApiTags("Authentication")`
  - `@Controller("auth")`
  - Endpoints:
    - `POST /register`: `@Public()`, 201, `@ResponseMessage("User registration successful")`.
    - `POST /login`: `@Public()`, `@HttpCode(HttpStatus.OK)`, `@ResponseMessage("Login successful")`.
    - `POST /refresh`: `@Public()`, `@HttpCode(HttpStatus.OK)`, `@ResponseMessage("Tokens refreshed successfully")`.
    - `POST /logout`: `@Public()`, `@HttpCode(HttpStatus.OK)`, `@ResponseMessage("Logout successful")`.
    - `POST /logout-all`: `@UseGuards(JwtAuthGuard)`, `@ApiBearerAuth()`, `@HttpCode(HttpStatus.OK)`, `@ResponseMessage("All sessions revoked successfully")`.
    - `GET /me`: `@UseGuards(JwtAuthGuard)`, `@ApiBearerAuth()`, `@HttpCode(HttpStatus.OK)`, `@ResponseMessage("Profile retrieved successfully")`.
  - Inject `IAuthService` via `@Inject(AUTH_SERVICE)` and `IUserRepository` via `@Inject(USER_REPOSITORY)`.

### Step 4: Wire Controller into `AuthModule`
- [x] Update `apps/api/src/modules/auth/auth.module.ts`:
  - Add `controllers: [AuthController]`.
  - Ensure `UsersModule` is imported to provide `USER_REPOSITORY`.
- [x] Update `apps/api/src/modules/auth/index.ts` to export `AuthController` and DTOs.

### Step 5: Unit & Integration Tests
- [x] Create `apps/api/src/modules/auth/auth.controller.spec.ts`:
  - Comprehensive unit tests mocking `IAuthService` and `IUserRepository`.
  - Validate each route handler delegating accurately with metadata and DTOs.
  - Verify error propagation when services throw domain exceptions.
- [x] Create `apps/api/src/modules/auth/auth.controller.int.spec.ts`:
  - Integration tests spinning up NestJS test module with `ValidationPipe`, `ResponseInterceptor`, and `GlobalExceptionFilter`.
  - Verify HTTP status codes: 201 for register, 200 for login/refresh/logout/me.
  - Verify 422/400 validation error formatting for malformed payloads.
  - Verify `ApiResponse<T>` envelope wrapping.

### Step 6: Verification & Sprint 2 Completion
- [x] Run test suite: `pnpm --filter @vetralink/api test`.
- [x] Run build: `pnpm --filter @vetralink/api build`.
- [x] Check off all tasks in this plan and mark Task 2.7 complete in `ROADMAP.md`.
- [x] Mark Sprint 2 as Complete (`🟢 Complete`) in `ROADMAP.md`.

---

## 3. Acceptance Criteria
1. **Full Auth Lifecycle**: Register -> Login -> Refresh -> Me -> Logout -> LogoutAll covered by endpoints.
2. **Standard API Envelope**: Responses adhere strictly to `{ success, statusCode, message, data, traceId, timestamp }`.
3. **OpenAPI Compliance**: All endpoints, request bodies, and responses decorated with complete Swagger schema documentation.
4. **Security Enforced**: Administrative role signups rejected; protected routes guarded by `JwtAuthGuard`.
5. **100% Test Pass Rate**: Zero regressions across the entire `@vetralink/api` test suite.
