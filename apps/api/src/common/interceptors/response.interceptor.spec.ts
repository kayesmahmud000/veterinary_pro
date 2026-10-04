import { ExecutionContext, CallHandler } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { of } from "rxjs";
import { ResponseInterceptor } from "./response.interceptor";
import { RESPONSE_MESSAGE_METADATA } from "../decorators/response-message.decorator";

describe("ResponseInterceptor (response.interceptor.ts)", () => {
  let interceptor: ResponseInterceptor<unknown>;
  let reflector: jest.Mocked<Partial<Reflector>>;

  const mockResponse = {
    statusCode: 200,
    setHeader: jest.fn(),
  };

  const mockRequest = {
    headers: {},
  };

  const mockContext = {
    switchToHttp: () => ({
      getResponse: () => mockResponse,
      getRequest: () => mockRequest,
    }),
    getHandler: () => ({}),
  } as unknown as ExecutionContext;

  beforeEach(() => {
    jest.clearAllMocks();
    reflector = {
      get: jest.fn(),
    };
    interceptor = new ResponseInterceptor(reflector as Reflector);
  });

  it("should wrap standard response in unified ApiResponse envelope", (done) => {
    const rawData = { id: "123", name: "Holstein Cow" };
    const next: CallHandler = {
      handle: () => of(rawData),
    };

    interceptor.intercept(mockContext, next).subscribe({
      next: (result) => {
        expect(result.success).toBe(true);
        expect(result.statusCode).toBe(200);
        expect(result.message).toBe("OK");
        expect(result.data).toEqual(rawData);
        expect(result.traceId).toBeDefined();
        expect(result.timestamp).toBeDefined();
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          "x-trace-id",
          result.traceId
        );
        done();
      },
    });
  });

  it("should adopt incoming x-trace-id request header", (done) => {
    const customTraceId = "trace-custom-uuid-12345";
    const customContext = {
      switchToHttp: () => ({
        getResponse: () => mockResponse,
        getRequest: () => ({
          headers: { "x-trace-id": customTraceId },
        }),
      }),
      getHandler: () => ({}),
    } as unknown as ExecutionContext;

    const next: CallHandler = {
      handle: () => of({ status: "done" }),
    };

    interceptor.intercept(customContext, next).subscribe({
      next: (result) => {
        expect(result.traceId).toBe(customTraceId);
        expect(mockResponse.setHeader).toHaveBeenCalledWith(
          "x-trace-id",
          customTraceId
        );
        done();
      },
    });
  });

  it("should honor custom semantic message from @ResponseMessage metadata", (done) => {
    reflector.get = jest
      .fn()
      .mockImplementation((metadataKey: string) => {
        if (metadataKey === RESPONSE_MESSAGE_METADATA) {
          return "Animal registered successfully";
        }
        return null;
      });

    const next: CallHandler = {
      handle: () => of({ registered: true }),
    };

    interceptor.intercept(mockContext, next).subscribe({
      next: (result) => {
        expect(result.message).toBe("Animal registered successfully");
        done();
      },
    });
  });

  it("should unwrap paginated payload into data and meta properties", (done) => {
    const paginatedPayload = {
      items: [{ id: "1" }, { id: "2" }],
      meta: {
        page: 1,
        pageSize: 10,
        total: 2,
        totalPages: 1,
      },
    };

    const next: CallHandler = {
      handle: () => of(paginatedPayload),
    };

    interceptor.intercept(mockContext, next).subscribe({
      next: (result) => {
        expect(result.data).toEqual([{ id: "1" }, { id: "2" }]);
        expect(result.meta).toEqual(paginatedPayload.meta);
        done();
      },
    });
  });
});
