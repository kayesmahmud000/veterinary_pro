import { randomUUID } from "crypto";
import { WorkflowRateLimiter } from "../../common/security/workflow-rate-limiter";
const value = process.env.ENROLLMENTS_TEST_REDIS_URL;
if (value) {
  const url = new URL(value);
  if (url.hostname !== "127.0.0.1" || url.port !== "56479")
    throw new Error(
      "Explicit task-owned loopback Redis on port56479 required.",
    );
}
(value ? describe : describe.skip)(
  "Enrollment limits across Redis clients",
  () => {
    jest.setTimeout(20000);
    it("shares a single distributed budget between instances and fails closed when unavailable", async () => {
      const a = new WorkflowRateLimiter({
          redisEnabled: true,
          redisUrl: value,
        } as any),
        b = new WorkflowRateLimiter({
          redisEnabled: true,
          redisUrl: value,
        } as any);
      const unavailable = new WorkflowRateLimiter({
        redisEnabled: true,
        redisUrl: "redis://127.0.0.1:56480",
      } as any);
      try {
        const id = randomUUID(),
          result = await Promise.allSettled(
            Array.from({ length: 10 }, (_, i) =>
              (i % 2 ? a : b).hit("enrollment-integration", id, 5, 60),
            ),
          );
        expect(result.filter((r) => r.status === "fulfilled")).toHaveLength(5);
        expect(result.filter((r) => r.status === "rejected")).toHaveLength(5);
        for (const item of result)
          if (item.status === "rejected")
            expect(item.reason).toMatchObject({
              errorCode: "RATE_LIMITED",
              statusCode: 429,
            });
        await expect(
          unavailable.hit("enrollment-integration", id, 5, 60),
        ).rejects.toMatchObject({
          errorCode: "RATE_LIMIT_UNAVAILABLE",
          statusCode: 503,
        });
      } finally {
        a.onModuleDestroy();
        b.onModuleDestroy();
        unavailable.onModuleDestroy();
      }
    });
  },
);
