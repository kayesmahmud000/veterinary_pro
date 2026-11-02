import { CourseEnrollmentWriter } from "./course-enrollment-writer.service";
const courseId = "11111111-1111-4111-8111-111111111111",
  userId = "22222222-2222-4222-8222-222222222222";
const product = {
  id: courseId,
  deletedAt: null,
  type: "VIDEO_COURSE",
  contentProvider: "YOUTUBE",
  isPublished: true,
  priceCents: 0,
  discountPriceCents: null,
};
const row = {
  id: userId,
  userId,
  productId: courseId,
  status: "REVOKED",
  version: 2,
  source: "ADMIN",
  createdAt: new Date(),
  activatedAt: new Date(),
  revokedAt: new Date(),
  revokedById: courseId,
};
describe("Course enrollment transition writer", () => {
  const writer = new CourseEnrollmentWriter();
  it.each(["SELF", "ADD"] as const)(
    "never restores a revoked pair through %s",
    async (mode) => {
      await expect(
        writer.activateLocked(
          { product, membership: row, userId, productId: courseId } as any,
          mode,
          mode === "ADD" ? null : undefined,
          {} as any,
        ),
      ).rejects.toMatchObject({
        errorCode:
          mode === "SELF"
            ? "COURSE_ENROLLMENT_REVOKED"
            : "ENROLLMENT_VERSION_CONFLICT",
      });
    },
  );
  it("rejects stale restore before touching persistence", async () => {
    await expect(
      writer.activateLocked(
        { product, membership: row, userId, productId: courseId } as any,
        "RESTORE",
        1,
        {} as any,
      ),
    ).rejects.toMatchObject({ errorCode: "ENROLLMENT_VERSION_CONFLICT" });
  });
  it("does not permit paid or unpublished activation", async () => {
    await expect(
      writer.activateLocked(
        {
          product: { ...product, priceCents: 1 },
          membership: null,
          userId,
          productId: courseId,
        } as any,
        "ADD",
        null,
        {} as any,
      ),
    ).rejects.toMatchObject({ errorCode: "COURSE_NOT_ENROLLABLE" });
  });
  it("only explicit versioned restore clears revocation and retains identity", async () => {
    const tx = {
      $queryRaw: async () => [{ now: new Date() }],
      courseEnrollment: {
        update: async (q: any) => ({ ...row, ...q.data, version: 3 }),
      },
    };
    const result = await writer.activateLocked(
      { product, membership: row, userId, productId: courseId } as any,
      "RESTORE",
      2,
      tx as any,
    );
    expect(result.changed).toBe(true);
    expect(result.enrollment).toMatchObject({
      id: userId,
      status: "ACTIVE",
      revokedAt: null,
      revokedById: null,
      version: 3,
    });
  });
});
