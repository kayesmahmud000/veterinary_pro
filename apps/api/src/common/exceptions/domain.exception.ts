import { HttpStatus } from "@nestjs/common";
import { SubscriptionQuotaType, SubscriptionTier } from "@vetralink/shared-types";

export abstract class DomainException extends Error {
  abstract readonly statusCode: number;
  abstract readonly errorCode: string;

  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace?.(this, this.constructor);
  }
}

export class EntityNotFoundException extends DomainException {
  readonly statusCode = HttpStatus.NOT_FOUND;
  readonly errorCode = "ENTITY_NOT_FOUND";

  constructor(entityName: string, identifier?: string | number) {
    super(
      identifier
        ? `${entityName} with identifier '${identifier}' was not found.`
        : `${entityName} was not found.`
    );
  }
}

export class EntityConflictException extends DomainException {
  readonly statusCode = HttpStatus.CONFLICT;
  readonly errorCode = "ENTITY_CONFLICT";

  constructor(message: string, public readonly conflictField?: string) {
    super(message);
  }
}

export class ValidationDomainException extends DomainException {
  readonly statusCode = HttpStatus.UNPROCESSABLE_ENTITY;
  readonly errorCode = "VALIDATION_FAILED";

  constructor(
    message: string,
    public readonly validationErrors?: Array<{ field: string; message: string }>
  ) {
    super(message);
  }
}

export class ForbiddenOperationException extends DomainException {
  readonly statusCode = HttpStatus.FORBIDDEN;
  readonly errorCode = "FORBIDDEN_OPERATION";

  constructor(message = "You do not have permission to perform this operation.") {
    super(message);
  }
}

export class UnauthorizedDomainException extends DomainException {
  readonly statusCode = HttpStatus.UNAUTHORIZED;
  readonly errorCode = "UNAUTHORIZED";

  constructor(message = "Authentication is required to access this resource.") {
    super(message);
  }
}

export interface QuotaExceededDetails {
  quotaType: SubscriptionQuotaType;
  currentUsage: number;
  limit: number;
  planTier: SubscriptionTier;
  upgradeTier?: SubscriptionTier | null;
}

export class QuotaExceededDomainException extends DomainException {
  readonly statusCode = HttpStatus.FORBIDDEN;
  readonly errorCode = "QUOTA_EXCEEDED";

  constructor(
    message: string,
    public override readonly details?: QuotaExceededDetails
  ) {
    super(message, details);
  }
}

export interface SubscriptionReadOnlyDetails {
  subscriptionId: string;
  accessMode: string;
  daysPastDue: number;
  gracePeriodExpiredAt?: string;
  portalUrl?: string;
}

export class SubscriptionReadOnlyException extends DomainException {
  readonly statusCode = HttpStatus.FORBIDDEN;
  readonly errorCode = "SUBSCRIPTION_READ_ONLY";

  constructor(
    message = "Your subscription is past due and the grace period has expired. Your account has been restricted to read-only mode. Please update your payment method to restore write access.",
    public override readonly details?: SubscriptionReadOnlyDetails
  ) {
    super(message, details);
  }
}

export interface SubscriptionSuspendedDetails {
  subscriptionId: string;
  accessMode: string;
  daysPastDue: number;
  suspendedAt?: string;
  portalUrl?: string;
}

export class SubscriptionSuspendedException extends DomainException {
  readonly statusCode = HttpStatus.FORBIDDEN;
  readonly errorCode = "SUBSCRIPTION_SUSPENDED";

  constructor(
    message = "Your subscription has been suspended due to overdue payment. Please settle your outstanding balance on the billing portal to reactivate your account.",
    public override readonly details?: SubscriptionSuspendedDetails
  ) {
    super(message, details);
  }
}

