import { Test, TestingModule } from "@nestjs/testing";
import { IdempotencyService } from "./idempotency.service";
import { MemoryIdempotencyStore } from "./stores/memory-idempotency.store";
import {
  IdempotencyStatus,
  IDEMPOTENCY_STORE,
  IIdempotencyStore,
} from "./idempotency.interface";
import {
  EntityConflictException,
  ValidationDomainException,
} from "../exceptions/domain.exception";

describe("IdempotencyService", () => {
  let service: IdempotencyService;
  let store: MemoryIdempotencyStore;

  beforeEach(async () => {
    store = new MemoryIdempotencyStore();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IdempotencyService,
        {
          provide: IDEMPOTENCY_STORE,
          useValue: store,
        },
      ],
    }).compile();

    service = module.get<IdempotencyService>(IdempotencyService);
  });

  describe("execute", () => {
    it("should execute operation and cache response on first call", async () => {
      const operation = jest.fn().mockResolvedValue({ success: true, count: 1 });

      const result = await service.execute(
        "test-key-1",
        { amount: 50 },
        86400,
        operation
      );

      expect(operation).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ success: true, count: 1 });

      // Verify stored in memory
      const cached = await store.get("test-key-1");
      expect(cached?.status).toBe(IdempotencyStatus.COMPLETED);
      expect(cached?.response).toEqual({ success: true, count: 1 });
    });

    it("should return cached response on subsequent calls without re-executing operation", async () => {
      const operation = jest.fn().mockResolvedValue({ id: "order-1" });

      const firstCall = await service.execute(
        "test-key-replay",
        { items: ["p1"] },
        86400,
        operation
      );

      const secondCall = await service.execute(
        "test-key-replay",
        { items: ["p1"] },
        86400,
        operation
      );

      expect(operation).toHaveBeenCalledTimes(1);
      expect(firstCall).toEqual({ id: "order-1" });
      expect(secondCall).toEqual({ id: "order-1" });
    });

    it("should throw ValidationDomainException when replayed with different payload", async () => {
      const operation = jest.fn().mockResolvedValue({ id: "order-1" });

      await service.execute(
        "test-key-mismatch",
        { amount: 100 },
        86400,
        operation
      );

      await expect(
        service.execute(
          "test-key-mismatch",
          { amount: 200 }, // altered payload!
          86400,
          operation
        )
      ).rejects.toThrow(ValidationDomainException);

      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should throw EntityConflictException when concurrent request is PENDING", async () => {
      await store.setPending("test-key-pending", "some-hash", 60);

      await expect(
        service.execute(
          "test-key-pending",
          { amount: 100 },
          86400,
          async () => ({ ok: true })
        )
      ).rejects.toThrow(EntityConflictException);
    });

    it("should release lock and rethrow error when operation fails", async () => {
      const failingOp = jest.fn().mockRejectedValue(new Error("Database connection lost"));

      await expect(
        service.execute("test-key-fail", { x: 1 }, 86400, failingOp)
      ).rejects.toThrow("Database connection lost");

      // Verify lock was released
      const record = await store.get("test-key-fail");
      expect(record).toBeNull();

      // Subsequent call can now succeed
      const successfulOp = jest.fn().mockResolvedValue({ recovered: true });
      const recovered = await service.execute(
        "test-key-fail",
        { x: 1 },
        86400,
        successfulOp
      );
      expect(recovered).toEqual({ recovered: true });
    });
  });

  describe("computePayloadHash", () => {
    it("should produce identical hash for objects with different key order", () => {
      const payloadA = { b: 2, a: 1, c: { y: 20, x: 10 } };
      const payloadB = { a: 1, c: { x: 10, y: 20 }, b: 2 };

      const hashA = service.computePayloadHash(payloadA);
      const hashB = service.computePayloadHash(payloadB);

      expect(hashA).toBe(hashB);
    });
  });
});
