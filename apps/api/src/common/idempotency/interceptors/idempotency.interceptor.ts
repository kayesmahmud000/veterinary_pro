import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Inject,
  Injectable,
  NestInterceptor,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { Observable, from, lastValueFrom } from "rxjs";
import { Request } from "express";
import {
  IDEMPOTENCY_SERVICE,
  IIdempotencyService,
} from "../idempotency.interface";
import {
  IDEMPOTENT_KEY,
  IdempotencyOptions,
} from "../decorators/idempotent.decorator";

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    @Inject(IDEMPOTENCY_SERVICE)
    private readonly idempotencyService: IIdempotencyService
  ) {}

  public intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<unknown> {
    const options = this.reflector.getAllAndOverride<
      IdempotencyOptions | undefined
    >(IDEMPOTENT_KEY, [context.getHandler(), context.getClass()]);

    if (!options) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const headerName = (options.header ?? "idempotency-key").toLowerCase();
    const rawKey =
      (request.headers[headerName] as string | undefined) ||
      (request.headers["x-idempotency-key"] as string | undefined);

    if (!rawKey) {
      if (options.required) {
        throw new BadRequestException(
          `Missing required idempotency key header '${options.header ?? "idempotency-key"}'.`
        );
      }
      return next.handle();
    }

    const ttlSeconds = options.ttlSeconds ?? 86400;
    const lockTtlSeconds = options.lockTtlSeconds ?? 60;
    const scopedKey = `${request.method}:${request.path}:${rawKey}`;

    return from(
      this.idempotencyService.execute(
        scopedKey,
        request.body,
        ttlSeconds,
        () => lastValueFrom(next.handle()),
        lockTtlSeconds
      )
    );
  }
}
