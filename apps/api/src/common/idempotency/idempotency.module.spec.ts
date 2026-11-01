import { Test } from "@nestjs/testing";
import Redis from "ioredis";
import { IdempotencyModule } from "./idempotency.module";
import { IDEMPOTENCY_STORE } from "./idempotency.interface";
import { MemoryIdempotencyStore } from "./stores/memory-idempotency.store";
import { EnvService } from "../../config/env.service";

// Supply a complete isolated configuration boundary; never load a local .env.
jest.mock("../../config", () => {
  const { Module, Global } = require("@nestjs/common");
  const { EnvService } = require("../../config/env.service");
  class AppConfigModule {}
  Global()(AppConfigModule);
  Module({ providers: [{ provide: EnvService, useValue: {} }], exports: [EnvService] })(AppConfigModule);
  return { AppConfigModule, EnvService };
});
jest.mock("ioredis", () => ({ __esModule: true, default: jest.fn() }));

describe("runtime idempotency store selection", () => {
  beforeEach(() => jest.clearAllMocks());
  it.each(["development", "production"])("selects one shared memory store without Redis in %s", async nodeEnv => {
    jest.mocked(Redis).mockImplementation(() => { throw new Error("Redis construction forbidden"); });
    const module = await Test.createTestingModule({ imports: [IdempotencyModule] })
      .overrideProvider(EnvService).useValue({ redisEnabled: false, nodeEnv }).compile();
    try {
      expect(module.get(IDEMPOTENCY_STORE)).toBe(module.get(MemoryIdempotencyStore));
      expect(Redis).not.toHaveBeenCalled();
      expect(await module.get<MemoryIdempotencyStore>(IDEMPOTENCY_STORE).setPending("key", "hash", 60)).toBe(true);
    } finally { await module.close(); }
  });
  it("constructs exactly one Redis store when enabled outside tests", async () => {
    jest.mocked(Redis).mockImplementation(() => ({}) as Redis);
    const module = await Test.createTestingModule({imports:[IdempotencyModule]})
      .overrideProvider(EnvService).useValue({ redisEnabled:true, nodeEnv:"production", redisUrl:"redis://localhost:6379" }).compile();
    try {
      expect(module.get(IDEMPOTENCY_STORE)).not.toBeInstanceOf(MemoryIdempotencyStore);
      expect(Redis).toHaveBeenCalledTimes(1);
    } finally { await module.close(); }
  });
});
