# SPEC-205: Role-Based Access Control (RBAC) — `@Roles()`, `@Public()`, `@CurrentUser()`, `JwtAuthGuard`, and `RolesGuard`
# Status: PROPOSED (Pending Approval)
# Phase 1: Foundation, DB Migration & Auth RBAC
# Sprint 2: Authentication, Token Lifecycle & Multi-Tenant RBAC
# Task 2.5: Role-based access control: `@Roles()` decorator and `RolesGuard`
# Author: Elite Software Architect & Senior Tech Lead

---

## 1. Feature Overview & Objective

### 1.1 Problem & Context
Now that authentication and token issuance (`AuthService` and `TokenService`) are established, the platform needs an enterprise-grade **Role-Based Access Control (RBAC)** security layer to guard HTTP routes and guarantee that only authorized users with sufficient privileges can access sensitive veterinary, financial, and administrative operations.

Without a standardized guard and metadata pipeline:
- Route handlers would have to manually parse `Authorization` headers and inspect user claims, leading to duplicate, brittle, and error-prone authorization checks.
- Endpoints might accidentally be left exposed without role validation.
- Super-administrators and role hierarchies would be inconsistent across controllers.

### 1.2 Objective & Deliverables
Task 2.5 delivers:
1. **Metadata Decorators**:
   - `@Roles(...roles: UserRole[])`: Declares role requirements on controller classes or handler methods via `ROLES_KEY`.
   - `@Public()`: Explicitly marks public routes (e.g. login, register, public health probes) via `IS_PUBLIC_KEY`.
   - `@CurrentUser()`: Type-safe parameter decorator extracting `JwtPayload` from `request.user`.
2. **Authentication Guard (`JwtAuthGuard`)**:
   - Intercepts requests, checks for `@Public()` exemption.
   - Extracts Bearer token from `Authorization: Bearer <token>` header.
   - Verifies JWT integrity and expiration via `TokenService.verifyAccessToken()`.
   - Attaches verified `JwtPayload` to `request.user`.
3. **Authorization Guard (`RolesGuard`)**:
   - Inspects `@Roles()` metadata using `Reflector` across method and class levels.
   - Grants immediate access if no roles are required or if the route is `@Public()`.
   - Rejects unauthenticated requests with `UnauthorizedDomainException`.
   - Rejects suspended accounts with `ForbiddenOperationException("Account is suspended.")`.
   - Grants global bypass access to `SUPER_ADMIN`.
   - Validates user role against allowed roles; throws `ForbiddenOperationException("Insufficient role permissions...")` upon violation.
4. **Barrel Exports**:
   - `apps/api/src/common/guards/index.ts`
   - `apps/api/src/common/decorators/index.ts`
5. **Comprehensive Unit Test Suites**:
   - `roles.decorator.spec.ts`
   - `jwt-auth.guard.spec.ts`
   - `roles.guard.spec.ts`

---

## 2. Current State vs. Proposed State

| Dimension | Current State | Proposed State (Task 2.5) |
| :--- | :--- | :--- |
| **Route Protection** | No route guards exist. Routes are open. | Two-tier guard pipeline: `JwtAuthGuard` authenticates identity, `RolesGuard` enforces RBAC privileges. |
| **Role Metadata** | None. | `@Roles(UserRole.VET, UserRole.ADMIN)` declarative metadata at controller or method level. |
| **Public Endpoints** | Implicit/manual. | Declarative `@Public()` decorator bypassing auth requirements cleanly. |
| **User Injection** | No parameter decorator for request user. | `@CurrentUser()` extracting strongly typed `JwtPayload`. |
| **Super Admin Privilege** | No privilege escalation handling. | `SUPER_ADMIN` has platform-wide superuser privileges bypassing restrictive role filters. |

---

## 3. Architectural & Design Trade-offs

### 3.1 Guard Architecture: Single Monolithic Guard vs. Composed Two-Tier Guards
- **Option A: Single monolithic `AuthAndRolesGuard` that parses JWT and checks roles in one class.**
  - *Cons*: Violates the Single Responsibility Principle (SRP). Makes public route exemptions awkward and couples authentication (who you are) with authorization (what you can do).
- **Option B: Composed Two-Tier Architecture (`JwtAuthGuard` -> `RolesGuard`) (CHOSEN)**
  - *Pros*:
    1. **Single Responsibility**: `JwtAuthGuard` validates token integrity and attaches `request.user`. `RolesGuard` validates RBAC permissions on the authenticated user.
    2. **Reusability**: `JwtAuthGuard` can be used globally, while `RolesGuard` enforces RBAC only where `@Roles()` is declared.
    3. **Clean Architecture**: Decoupled, highly testable in isolation with mocked `Reflector` and `TokenService`.
  - *Justification*: Standard NestJS and enterprise architectural best practice.

### 3.2 Role Inheritance & Super Admin Superuser Mode
- If a route specifies `@Roles(UserRole.VET)`, can a `SUPER_ADMIN` access it?
  - **Decision**: Yes. `SUPER_ADMIN` has emergency and operational oversight across the entire system. `RolesGuard` grants access if `user.role === UserRole.SUPER_ADMIN` regardless of specific target roles.

### 3.3 Method vs. Class Metadata Precedence
- `Reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [context.getHandler(), context.getClass()])`
- Allows setting a default role at the controller class level (e.g. `@Roles(UserRole.FARMER)`) while allowing specific handler methods to override or narrow permissions (e.g. `@Roles(UserRole.ADMIN)`).

---

## 4. Contracts & Interfaces

### 4.1 Decorators
```typescript
// @Roles(...roles: UserRole[])
export const ROLES_KEY = "roles";
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

// @Public()
export const IS_PUBLIC_KEY = "isPublic";
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

// @CurrentUser()
export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: JwtPayload | undefined = request.user;
    return data && user ? user[data] : user;
  }
);
```

### 4.2 Guards
```typescript
@Injectable()
export class JwtAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): Promise<boolean>;
}

@Injectable()
export class RolesGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean;
}
```

---

## 5. Security & Edge Cases

1. **Missing / Tampered Authorization Header**:
   - `Authorization: Bearer <jwt>` format strictly validated.
   - Missing or non-Bearer prefix throws `UnauthorizedDomainException`.
2. **Account Suspension Verification**:
   - If a user holds a valid unexpired access token but their status in the payload is `SUSPENDED`, `RolesGuard` throws `ForbiddenOperationException("Account has been suspended.")`.
3. **Fail-Closed Principle**:
   - If a route specifies `@Roles(...)` but the request has no `request.user`, access is denied (`UnauthorizedDomainException`), preventing unauthorized access if guards are misordered.
