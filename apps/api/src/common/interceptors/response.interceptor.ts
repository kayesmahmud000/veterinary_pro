import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from "@nestjs/common";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { randomUUID } from "node:crypto";
import { ApiResponse } from "@vetralink/shared-types";
import { Response, Request } from "express";

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const traceId = (request.headers["x-trace-id"] as string) || randomUUID();

    return next.handle().pipe(
      map((result) => {
        // Handle pagination metadata if returned in payload
        let data: T | null = result;
        let meta = undefined;

        if (result && typeof result === "object" && "items" in result && "meta" in result) {
          data = result.items as T;
          meta = result.meta;
        }

        return {
          success: true,
          statusCode: response.statusCode,
          message: "OK",
          data: data ?? null,
          meta,
          traceId,
          timestamp: new Date().toISOString(),
        };
      })
    );
  }
}
