import { ExecutionContext } from "@nestjs/common";
import { ROUTE_ARGS_METADATA } from "@nestjs/common/constants";
import { ClientMeta } from "./client-meta.decorator";

function getParamDecoratorFactory(decorator: Function) {
  class TestController {
    public testMethod(@decorator() _value: unknown) {}
  }
  const args = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    TestController,
    "testMethod"
  );
  return args[Object.keys(args)[0]].factory;
}

describe("@ClientMeta()", () => {
  const factory = getParamDecoratorFactory(ClientMeta);

  const createMockContext = (req: any): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as unknown as ExecutionContext);

  it("should extract ip from x-forwarded-for string and user-agent header", () => {
    const ctx = createMockContext({
      headers: {
        "x-forwarded-for": "203.0.113.195, 70.41.3.18",
        "user-agent": "Mozilla/5.0 Chrome/120.0",
      },
    });

    const result = factory(null, ctx);
    expect(result).toEqual({
      ipAddress: "203.0.113.195",
      userAgent: "Mozilla/5.0 Chrome/120.0",
    });
  });

  it("should extract ip from x-forwarded-for array if present", () => {
    const ctx = createMockContext({
      headers: {
        "x-forwarded-for": ["198.51.100.1", "198.51.100.2"],
        "user-agent": "VetralinkMobile/1.0",
      },
    });

    const result = factory(null, ctx);
    expect(result).toEqual({
      ipAddress: "198.51.100.1",
      userAgent: "VetralinkMobile/1.0",
    });
  });

  it("should fall back to req.ip if x-forwarded-for is not present", () => {
    const ctx = createMockContext({
      ip: "127.0.0.1",
      headers: {},
    });

    const result = factory(null, ctx);
    expect(result).toEqual({
      ipAddress: "127.0.0.1",
      userAgent: undefined,
    });
  });

  it("should fall back to socket.remoteAddress if req.ip is not present", () => {
    const ctx = createMockContext({
      socket: { remoteAddress: "::1" },
      headers: {},
    });

    const result = factory(null, ctx);
    expect(result).toEqual({
      ipAddress: "::1",
      userAgent: undefined,
    });
  });
});
