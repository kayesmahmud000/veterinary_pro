import { MemoryIdempotencyStore } from "./memory-idempotency.store";
describe("memory idempotency atomic claims", () => {
  it("admits exactly one concurrent claimant", async () => {
    const store = new MemoryIdempotencyStore();
    const results = await Promise.all(Array.from({length:20}, () => store.setPending("key", "hash", 60)));
    expect(results.filter(Boolean)).toHaveLength(1);
  });
  it("releases a claim at the TTL boundary and replays completed responses", async () => {
    jest.useFakeTimers();
    try {
      const store = new MemoryIdempotencyStore();
      await store.setPending("key", "hash", 60);
      jest.advanceTimersByTime(60000);
      expect(await store.setPending("key", "hash", 60)).toBe(true);
      await store.setCompleted("key", "hash", { id: "result" }, 60);
      expect(await store.get("key")).toMatchObject({ response: {id:"result"} });
    } finally { jest.useRealTimers(); }
  });
});
