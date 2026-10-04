import { BadRequestException, ExecutionContext } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { of, lastValueFrom } from "rxjs";
import { IdempotencyInterceptor } from "./idempotency.interceptor";
import { IIdempotencyService } from "../idempotency.interface";

describe("IdempotencyInterceptor", () => {
  let interceptor: IdempotencyInterceptor;
  let reflector: jest.Mocked<Reflector>;
  let idempotencyService: jest.Mocked<IIdempotencyService>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    idempotencyService = {
      execute: jest.fn(),
    };

    interceptor = new IdempotencyInterceptor(reflector, idempotencyService);
  });

  const createMockContext = (headers: Record<string, string> = {}, body: unknown = {}) => {
    return {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: () => ({
        getRequest: () => ({
          headers,
          body,
          method: "POST",
          path: "/orders/checkout",
        }),
      }),
    } as unknown as ExecutionContext;
  };

  it("should pass through directly if route is not decorated", async () => {
    reflector.getAllAndOverride.mockReturnValueOnce(undefined);

    const context = createMockContext();
    const next = { handle: () => of({ success: true }) };

    const result$ = interceptor.intercept(context, next);
    const result = await lastValueFrom(result$);

    expect(result).toEqual({ success: true });
    expect(idempotencyService.execute).not.toHaveBeenCalled();
  });

  it("should pass through directly if header is missing and not required", async () => {
    reflector.getAllAndOverride.mockReturnValueOnce({ required: false });

    const context = createMockContext();
    const next = { handle: () => of({ success: true }) };

    const result$ = interceptor.intercept(context, next);
    const result = await lastValueFrom(result$);

    expect(result).toEqual({ success: true });
    expect(idempotencyService.execute).not.toHaveBeenCalled();
  });

  it("should throw BadRequestException if header is missing and required=true", () => {
    reflector.getAllAndOverride.mockReturnValueOnce({ required: true });

    const context = createMockContext();
    const next = { handle: () => of({ success: true }) };

    expect(() => interceptor.intercept(context, next)).toThrow(
      BadRequestException
    );
  });

  it("should delegate to IdempotencyService when header is present", async () => {
    reflector.getAllAndOverride.mockReturnValueOnce({
      header: "idempotency-key",
      ttlSeconds: 86400,
    });

    const context = createMockContext(
      { "idempotency-key": "test-key-123" },
      { items: [1] }
    );
    const next = { handle: () => of({ orderId: "ord-1" }) };

    idempotencyService.execute.mockResolvedValueOnce({ orderId: "ord-1" });

    const result$ = interceptor.intercept(context, next);
    const result = await lastValueFrom(result$);

    expect(result).toEqual({ orderId: "ord-1" });
    expect(idempotencyService.execute).toHaveBeenCalledWith(
      "POST:/orders/checkout:test-key-123",
      { items: [1] },
      86400,
      expect.any(Function),
      60
    );
  });
});
