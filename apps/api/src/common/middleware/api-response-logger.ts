import { Logger } from "@nestjs/common";
import { STATUS_CODES } from "node:http";
import type { NextFunction, Request, Response } from "express";

const logger = new Logger("ApiResponse");
export function apiResponseLogger(
  request: Request,
  response: Response,
  next: NextFunction,
): void {
  const enabled =
    process.env["API_DEBUG"] === "1" ||
    (process.env["NODE_ENV"] !== "production" &&
      process.env["API_DEBUG"] !== "0");
  if (!enabled) {
    next();
    return;
  }
  const started = performance.now();
  response.once("finish", () => {
    const status = response.statusCode;
    const traceId = response.getHeader("x-trace-id");
    const code: unknown = response.locals["apiErrorCode"];
    const record = {
      method: request.method,
      path: request.originalUrl
        .split("?")[0]
        .replace(/(\/(?:drm\/)?key)\/[^/]+/gi, "$1/:redacted")
        .replace(/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}/gi, ":id"),
      status,
      statusText: STATUS_CODES[status],
      durationMs: Math.round(performance.now() - started),
      ...(typeof traceId === "string" && /^[0-9a-f-]{36}$/i.test(traceId)
        ? { traceId }
        : {}),
      ...(typeof code === "string" && /^[A-Z][A-Z0-9_]{0,79}$/.test(code)
        ? { errorCode: code }
        : {}),
    };
    if (status >= 500) logger.error(record);
    else if (status >= 400) logger.warn(record);
    else logger.log(record);
  });
  next();
}
