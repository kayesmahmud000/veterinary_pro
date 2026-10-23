import { NestExpressApplication } from "@nestjs/platform-express";
import { json, NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { AccountRecoveryException, sendRecoveryError } from "./account-recovery.errors";
import { passwordResetCompleteSchema, passwordResetRequestSchema } from "@vetralink/shared-types";
import { RecoveryValidationPipe } from "./account-recovery.dto";

export function isAccountRecoveryRequest(request: Pick<Request, "url" | "headers">): boolean {
  return [request.url, request.headers["x-matched-path"]].some((value) =>
    typeof value === "string" && /^\/api\/v1\/auth\/password-reset(?:[/?]|$)/i.test(value));
}

export function configureAccountRecoveryTransport(app: NestExpressApplication): void {
  const parser = json({ limit: 8192, strict: false, inflate: false });
  // Must run before the application's general JSON parser, in both entry points.
  app.use((request: Request, response: Response, next: NextFunction) => {
    if (!/^\/api\/v1\/auth\/password-reset\/(request|complete)\/?$/i.test(request.path)) return next();
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    // The global success envelope reflects this header; never echo caller text.
    request.headers["x-trace-id"] = randomUUID();
    if (request.method !== "POST") {
      sendRecoveryError(response, new AccountRecoveryException("NOT_FOUND"));
      return;
    }
    if (request.originalUrl.includes("?") || !request.is("application/json")) {
      sendRecoveryError(response, new AccountRecoveryException("VALIDATION_FAILED"));
      return;
    }
    parser(request, response, (error?: unknown) => {
      if (error) {
        const oversized = typeof error === "object" && error !== null &&
          "type" in error && error.type === "entity.too.large";
        sendRecoveryError(response, new AccountRecoveryException(oversized ? "PAYLOAD_TOO_LARGE" : "VALIDATION_FAILED"));
        return;
      }
      try {
        // Validate original keys before class-transformer discards constructor /
        // __proto__. Strictness must apply to received JSON, not a projection.
        const complete = /\/complete\/?$/i.test(request.path);
        request.body = complete
          ? new RecoveryValidationPipe(passwordResetCompleteSchema).transform(request.body)
          : new RecoveryValidationPipe(passwordResetRequestSchema).transform(request.body);
      } catch (failure) {
        sendRecoveryError(response, failure instanceof AccountRecoveryException
          ? failure : new AccountRecoveryException("RECOVERY_UNAVAILABLE"));
        return;
      }
      next();
    });
  });
}
