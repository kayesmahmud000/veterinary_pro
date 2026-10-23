import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { Response } from "express";
import { DomainException } from "../../../common/exceptions/domain.exception";

const failures = {
  VALIDATION_FAILED: [400, "Validation failed."],
  PAYLOAD_TOO_LARGE: [413, "Request is too large."],
  RESET_LINK_INVALID: [400, "Reset link is invalid or expired."],
  RATE_LIMITED: [429, "Too many attempts. Please try again later."],
  RECOVERY_UNAVAILABLE: [503, "Account recovery is unavailable. Please retry later."],
  NOT_FOUND: [404, "Not found."],
} as const;
type RecoveryCode = keyof typeof failures;
type RecoveryField = "email" | "locale" | "token" | "newPassword";

export class AccountRecoveryException extends DomainException {
  readonly statusCode: number;
  constructor(
    readonly errorCode: RecoveryCode,
    readonly fields: RecoveryField[] = [],
  ) {
    super(failures[errorCode][1]);
    this.statusCode = failures[errorCode][0];
  }
}

// Used for parser failures too, before Nest's route filters can run.
export function sendRecoveryError(response: Response, failure: AccountRecoveryException): void {
  const traceId = randomUUID();
  const [status, message] = failures[failure.errorCode];
  response.setHeader("x-trace-id", traceId);
  response.setHeader("Cache-Control", "private, no-store");
  response.setHeader("Referrer-Policy", "no-referrer");
  if (failure.errorCode === "RATE_LIMITED") response.setHeader("Retry-After", "900");
  response.locals["apiErrorCode"] = failure.errorCode;
  response.status(status).json({
    success: false, statusCode: status, message, data: null,
    ...(failure.fields.length ? { errors: failure.fields.map((field) => ({ field, message: "Invalid field." })) } : {}),
    errorDetails: {
      type: `https://vetralink.pro/errors/${failure.errorCode.toLowerCase().replace(/_/g, "-")}`,
      title: failure.errorCode, status, detail: message,
      // Never reflect a URL/query, unknown key, exception message or header.
      instance: "/api/v1/auth/password-reset",
    },
    traceId, timestamp: new Date().toISOString(),
  });
}

@Catch()
export class AccountRecoveryExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const validation = exception instanceof HttpException && [400, 422].includes(exception.getStatus());
    sendRecoveryError(host.switchToHttp().getResponse<Response>(),
      exception instanceof AccountRecoveryException ? exception :
        new AccountRecoveryException(validation ? "VALIDATION_FAILED" : "RECOVERY_UNAVAILABLE"));
  }
}
