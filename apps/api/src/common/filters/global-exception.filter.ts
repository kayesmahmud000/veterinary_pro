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
import { Prisma } from "@prisma/client";
import {
  ApiResponse,
  ValidationErrorItem,
  ProblemDetails,
} from "@vetralink/shared-types";
import { DomainException, ValidationDomainException } from "../exceptions/domain.exception";

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const traceId =
      (request.headers["x-trace-id"] as string) || randomUUID();

    // Ensure traceId is reflected on the outgoing error response header
    response.setHeader("x-trace-id", traceId);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = "Internal server error";
    let title = "Internal Server Error";
    let typeUri = "https://vetralink.pro/errors/internal-server-error";
    let errors: ValidationErrorItem[] | undefined = undefined;

    // 1. Clean Architecture Domain Exceptions
    if (exception instanceof DomainException) {
      status = exception.statusCode;
      message = exception.message;
      title = exception.errorCode;
      typeUri = `https://vetralink.pro/errors/${exception.errorCode.toLowerCase().replace(/_/g, "-")}`;

      if (exception instanceof ValidationDomainException && exception.validationErrors) {
        errors = exception.validationErrors;
      }
    }
    // 2. Prisma ORM Known Request Errors
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapping = this.mapPrismaError(exception);
      status = mapping.status;
      message = mapping.message;
      title = mapping.title;
      typeUri = mapping.typeUri;
      errors = mapping.errors;

      this.logger.warn(
        `[TraceId: ${traceId}] Prisma error ${exception.code} on [${request.method} ${request.url}]: ${message}`
      );
    }
    // 3. NestJS Standard HttpExceptions (including ValidationPipe 400/422)
    else if (exception instanceof HttpException) {
      status = exception.getStatus();
      title = HttpStatus[status] || "Http Exception";
      typeUri = `https://vetralink.pro/errors/http-${status}`;

      const res = exception.getResponse();
      if (typeof res === "string") {
        message = res;
      } else if (typeof res === "object" && res !== null) {
        const resObj = res as Record<string, unknown>;
        const rawMessage = resObj["message"];

        if (Array.isArray(rawMessage)) {
          message = "Validation failed";
          title = "VALIDATION_FAILED";
          typeUri = "https://vetralink.pro/errors/validation-failed";
          errors = rawMessage.map((msg) => {
            const strMsg = String(msg);
            const firstWord = strMsg.split(" ")[0] || "field";
            return {
              field: firstWord,
              message: strMsg,
            };
          });
        } else {
          message = (rawMessage as string) || exception.message;
        }
      }
    }
    // 4. Unhandled Fatal Errors (Security Guardrail: Never leak stack traces)
    else if (exception instanceof Error) {
      this.logger.error(
        `[TraceId: ${traceId}] [${request.method} ${request.url}] Unhandled Error: ${exception.message}`,
        exception.stack
      );
    } else {
      this.logger.error(
        `[TraceId: ${traceId}] [${request.method} ${request.url}] Unknown Throw:`,
        JSON.stringify(exception)
      );
    }

    const problemDetails: ProblemDetails = {
      type: typeUri,
      title,
      status,
      detail: message,
      instance: request.url || "/",
    };

    const envelope: ApiResponse<null> = {
      success: false,
      statusCode: status,
      message,
      data: null,
      errors,
      errorDetails: problemDetails,
      traceId,
      timestamp: new Date().toISOString(),
    };

    response.status(status).json(envelope);
  }

  private mapPrismaError(error: Prisma.PrismaClientKnownRequestError): {
    status: number;
    message: string;
    title: string;
    typeUri: string;
    errors?: ValidationErrorItem[];
  } {
    switch (error.code) {
      case "P2002": {
        const target = Array.isArray(error.meta?.["target"])
          ? error.meta["target"].join(", ")
          : typeof error.meta?.["target"] === "string"
            ? error.meta["target"]
            : "field";

        return {
          status: HttpStatus.CONFLICT,
          message: `Unique constraint violation on ${target}.`,
          title: "ENTITY_CONFLICT",
          typeUri: "https://vetralink.pro/errors/entity-conflict",
          errors: [
            {
              field: target,
              message: `A record with this ${target} already exists.`,
            },
          ],
        };
      }

      case "P2025": {
        return {
          status: HttpStatus.NOT_FOUND,
          message: "The requested record was not found.",
          title: "ENTITY_NOT_FOUND",
          typeUri: "https://vetralink.pro/errors/entity-not-found",
        };
      }

      case "P2003": {
        const fieldName = (error.meta?.["field_name"] as string) || "foreign_key";
        return {
          status: HttpStatus.UNPROCESSABLE_ENTITY,
          message: `Referenced entity '${fieldName}' does not exist or relation is restricted.`,
          title: "FOREIGN_KEY_VIOLATION",
          typeUri: "https://vetralink.pro/errors/foreign-key-violation",
          errors: [
            {
              field: fieldName,
              message: `Invalid relation reference on ${fieldName}.`,
            },
          ],
        };
      }

      default: {
        return {
          status: HttpStatus.BAD_REQUEST,
          message: "Database query constraint violation.",
          title: "DATABASE_ERROR",
          typeUri: "https://vetralink.pro/errors/database-error",
        };
      }
    }
  }
}
