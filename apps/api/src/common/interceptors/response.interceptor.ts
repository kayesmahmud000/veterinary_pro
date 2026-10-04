import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Optional,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable } from "rxjs";
import { map } from "rxjs/operators";
import { randomUUID } from "node:crypto";
import { ApiResponse, PaginationMeta } from "@vetralink/shared-types";
import { Response, Request } from "express";
import { RESPONSE_MESSAGE_METADATA } from "../decorators/response-message.decorator";

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  constructor(@Optional() private readonly reflector?: Reflector) {}

  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Retrieve or generate persistent TraceId
    const traceId =
      (request.headers["x-trace-id"] as string) || randomUUID();

    // Attach traceId to outgoing response headers
    response.setHeader("x-trace-id", traceId);

    // Retrieve custom semantic message from @ResponseMessage decorator if present
    const customMessage = this.reflector?.get<string>(
      RESPONSE_MESSAGE_METADATA,
      context.getHandler()
    );

    return next.handle().pipe(
      map((result) => {
        let data: T | null = result;
        let meta: PaginationMeta | undefined = undefined;

        // Unpack standard paginated payload ({ items, meta })
        if (
          result &&
          typeof result === "object" &&
          "items" in result &&
          "meta" in result
        ) {
          const paginated = result as { items: T; meta: PaginationMeta };
          data = paginated.items;
          meta = paginated.meta;
        }

        return {
          success: true,
          statusCode: response.statusCode || 200,
          message: customMessage || "OK",
          data: data ?? null,
          meta,
          traceId,
          timestamp: new Date().toISOString(),
        };
      })
    );
  }
}
