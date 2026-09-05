import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { ApiResponse, ValidationErrorItem } from "@vetralink/shared-types";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const traceId = (request.headers["x-trace-id"] as string) || randomUUID();
    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";
    let errors: ValidationErrorItem[] | undefined = undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === "string") {
        message = res;
      } else if (typeof res === "object" && res !== null) {
        const resObj = res as Record<string, unknown>;
        message = (resObj["message"] as string) || exception.message;

        if (Array.isArray(resObj["message"])) {
          errors = (resObj["message"] as string[]).map((msg) => ({
            field: "validation",
            message: msg,
          }));
          message = "Validation failed";
        }
      }
    } else if (exception instanceof Error) {
      this.logger.error(`[TraceId: ${traceId}] Unhandled Exception: ${exception.message}`, exception.stack);
    }

    const envelope: ApiResponse<null> = {
      success: false,
      statusCode: status,
      message,
      data: null,
      errors,
      traceId,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(envelope);
  }
}
