import { AdminCourseCurriculumService } from "./admin-course-curriculum.service";
import { AdminProductsService } from "./admin-products.service";
import {
  JwtPayload,
  ProductContentProvider,
  ProductType,
  SubscriptionTier,
  UserRole,
} from "@vetralink/shared-types";
import { UserEntity } from "../users/entities/user.entity";
const id = "550e8400-e29b-41d4-a716-446655440001",
  lessonId = "550e8400-e29b-41d4-a716-446655440002";
const claims = {
  sub: id,
  role: UserRole.ADMIN,
  authorizationVersion: 0,
} as JwtPayload;
const product = () => ({
  id,
  version: 2,
  type: "VIDEO_COURSE",
  contentProvider: "YOUTUBE",
  priceCents: 0,
  discountPriceCents: null,
  contentS3Key: "",
  isPublished: false,
  metadata: {},
  title: "Course title",
  slug: "course-title",
  description: "Course description text",
  currency: "BDT",
  minSubscriptionTier: "STARTER",
  createdAt: new Date(),
  updatedAt: new Date(),
});
describe("Administrative YouTube curriculum", () => {
  let repo: any,
    catalog: any,
    audit: any,
    service: AdminCourseCurriculumService;
  const tx = { marker: "transaction" },
    input = {
      expectedVersion: 2,
      lessons: [
        {
          title: "First lesson",
          summary: "",
          access: "ENROLLED" as const,
          videoUrl: "https://youtu.be/M7lc1UVf-VE",
        },
      ],
    };
  beforeEach(() => {
    repo = {
      detail: jest.fn(async () => product()),
      lessons: jest.fn(async () => []),
      replaceLessons: jest.fn(async () => []),
      save: jest.fn(async () => ({ ...product(), version: 3 })),
    };
    catalog = { authorize: jest.fn(), locked: jest.fn(async () => product()) };
    audit = { record: jest.fn() };
    service = new AdminCourseCurriculumService(
      repo,
      catalog,
      { run: async (fn: any) => fn(tx) } as any,
      audit,
    );
  });
  it("normalizes sources, increments once and audits in the same transaction", async () => {
    const saved = await service.replace(claims, id, input);
    expect(repo.replaceLessons).toHaveBeenCalledWith(
      id,
      [expect.objectContaining({ youtubeVideoId: "M7lc1UVf-VE", position: 1 })],
      tx,
    );
    expect(saved.version).toBe(3);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "COURSE_CURRICULUM_UPDATED" }),
      tx,
    );
  });
  it.each([{ contentProvider: "INTERNAL" }, { isPublished: true }])(
    "rejects unsupported or published course %s",
    async (override) => {
      catalog.locked.mockResolvedValue({ ...product(), ...override });
      await expect(service.replace(claims, id, input)).rejects.toThrow();
      expect(repo.replaceLessons).not.toHaveBeenCalled();
    },
  );
  it("rejects IDs that do not belong to this active curriculum", async () => {
    await expect(
      service.replace(claims, id, {
        ...input,
        lessons: [{ ...input.lessons[0], id: lessonId }],
      }),
    ).rejects.toThrow();
    expect(repo.replaceLessons).not.toHaveBeenCalled();
  });
  it("never returns a curriculum after authorization fails", async () => {
    catalog.authorize.mockRejectedValue(new Error("Denied"));
    await expect(service.detail(claims, id)).rejects.toThrow("Denied");
    expect(repo.detail).not.toHaveBeenCalled();
  });
  it("does not write after a version conflict", async () => {
    catalog.locked.mockRejectedValue(new Error("PRODUCT_VERSION_CONFLICT"));
    await expect(service.replace(claims, id, input)).rejects.toThrow(
      "PRODUCT_VERSION_CONFLICT",
    );
    expect(repo.replaceLessons).not.toHaveBeenCalled();
  });
});
describe("YouTube product publication", () => {
  let repo: any, service: AdminProductsService;
  beforeEach(() => {
    repo = {
      lock: jest.fn(async () => product()),
      lessons: jest.fn(async () => [{ access: "ENROLLED" }]),
      save: jest.fn(async (_: string, data: any) => ({
        ...product(),
        ...data,
        version: 3,
      })),
    };
    const users = {
      lockById: async () =>
        UserEntity.create({
          id,
          name: "Admin",
          email: "admin@example.test",
          passwordHash: "hash",
          role: UserRole.ADMIN,
        }),
    };
    service = new AdminProductsService(
      repo,
      users as any,
      { run: async (fn: any) => fn({}) } as any,
      { record: jest.fn() } as any,
    );
  });
  it("publishes a free course with a saved enrolled lesson and no S3 asset", async () => {
    expect(
      (
        await service.action(claims, id, {
          action: "PUBLISH",
          expectedVersion: 2,
          reason: "Reviewed course publication",
        })
      ).isPublished,
    ).toBe(true);
  });
  it("refuses a demo-only curriculum", async () => {
    repo.lessons.mockResolvedValue([{ access: "PUBLIC_DEMO" }]);
    await expect(
      service.action(claims, id, {
        action: "PUBLISH",
        expectedVersion: 2,
        reason: "Reviewed course publication",
      }),
    ).rejects.toThrow();
    expect(repo.save).not.toHaveBeenCalled();
  });
  it("rejects charging for a YouTube course during editing", async () => {
    await expect(
      service.edit(claims, id, {
        title: "Course title",
        slug: "course-title",
        description: "Course description text",
        priceCents: 100,
        discountPriceCents: null,
        currency: "BDT",
        minSubscriptionTier: SubscriptionTier.STARTER,
        expectedVersion: 2,
      }),
    ).rejects.toThrow();
    expect(repo.save).not.toHaveBeenCalled();
  });
  it("rejects attaching an internal asset to a YouTube course", async () => {
    await expect(
      service.attach(claims, id, 2, {
        id: lessonId,
        key: "hls/master.m3u8",
        productId: id,
        type: ProductType.VIDEO_COURSE,
      }),
    ).rejects.toThrow();
    expect(repo.save).not.toHaveBeenCalled();
  });
});
