import { Logger } from "@nestjs/common";
import { EventEmitter } from "node:events";
import { apiResponseLogger } from "./api-response-logger";

describe("API response completion logging", () => {
  const previousDebug = process.env.API_DEBUG;
  const previousMode = process.env.NODE_ENV;
  afterEach(() => {
    jest.restoreAllMocks();
    if (previousDebug === undefined) delete process.env.API_DEBUG;
    else process.env.API_DEBUG = previousDebug;
    if (previousMode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousMode;
  });
  it.each([200, 401, 500])(
    "logs HTTP %i without request/response secrets",
    (status) => {
      process.env.API_DEBUG = "1";
      const method = status >= 500 ? "error" : status >= 400 ? "warn" : "log";
      const log = jest
        .spyOn(Logger.prototype, method)
        .mockImplementation(() => {});
      const response = Object.assign(new EventEmitter(), {
        statusCode: status,
        locals: {
          apiErrorCode: "UNAUTHORIZED",
          privateData: "NEVER_LOG_PRIVATE_DATA",
        },
        getHeader: () => "550e8400-e29b-41d4-a716-446655440000",
      });
      const next = jest.fn();
      apiResponseLogger(
        {
          method: "POST",
          originalUrl:
            "/api/v1/farms/660e8400-e29b-41d4-a716-446655440001?password=NEVER_LOG_PRIVATE_DATA",
          body: { password: "NEVER_LOG_PRIVATE_DATA" },
        } as any,
        response as any,
        next,
      );
      expect(next).toHaveBeenCalledTimes(1);
      expect(log).not.toHaveBeenCalled();
      response.emit("finish");
      expect(log).toHaveBeenCalledWith(
        expect.objectContaining({
          status,
          path: "/api/v1/farms/:id",
          durationMs: expect.any(Number),
        }),
      );
      expect(JSON.stringify(log.mock.calls)).not.toContain(
        "NEVER_LOG_PRIVATE_DATA",
      );
    },
  );
  it("can disable logging without affecting request handling", () => {
    process.env.API_DEBUG = "0";
    const next = jest.fn(),
      response = new EventEmitter();
    apiResponseLogger({} as any, response as any, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(response.listenerCount("finish")).toBe(0);
  });
  it("requires explicit opt-in in production", () => {
    process.env.NODE_ENV = "production";
    delete process.env.API_DEBUG;
    const next = jest.fn(),
      response = new EventEmitter();
    apiResponseLogger({} as any, response as any, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(response.listenerCount("finish")).toBe(0);
  });
  it("redacts legacy playback tokens embedded in URL paths", () => {
    process.env.API_DEBUG = "1";
    const log = jest
      .spyOn(Logger.prototype, "log")
      .mockImplementation(() => {});
    for (const path of [
      "/api/v1/media/drm/key/NEVER_LOG_PRIVATE_DATA",
      "/api/v1/media/key/NEVER_LOG_PRIVATE_DATA",
    ]) {
      const response = Object.assign(new EventEmitter(), {
        statusCode: 200,
        locals: {},
        getHeader: () => undefined,
      });
      apiResponseLogger(
        { method: "GET", originalUrl: path } as any,
        response as any,
        jest.fn(),
      );
      response.emit("finish");
    }
    expect(log).toHaveBeenCalledTimes(2);
    expect(JSON.stringify(log.mock.calls)).not.toContain(
      "NEVER_LOG_PRIVATE_DATA",
    );
  });
});
