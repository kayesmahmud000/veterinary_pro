import { CoursesService } from "./courses.service";
import { UserEntity } from "../users/entities/user.entity";
import { JwtPayload, UserRole } from "@vetralink/shared-types";
const id = "550e8400-e29b-41d4-a716-446655440001",
  lessonId = "550e8400-e29b-41d4-a716-446655440002";
const actor = {
  sub: id,
  role: UserRole.LEARNER,
  authorizationVersion: 0,
} as JwtPayload;
const row = () => ({
  id,
  title: "Course title",
  slug: "course-title",
  description: "Course description",
  courseLessons: [
    {
      id: lessonId,
      title: "Main lesson",
      summary: "",
      access: "ENROLLED",
      position: 1,
      youtubeVideoId: "PRIVATE_ID1",
    },
  ],
});
describe("YouTube learner access", () => {
  let repo: any, users: any, audit: any, service: CoursesService;
  beforeEach(() => {
    repo = {
      published: jest.fn(async () => row()),
      list: jest.fn(async () => ({ items: [row()], nextCursor: null })),
      lesson: jest.fn(async () => ({
        ...row().courseLessons[0],
        youtubeVideoId: "M7lc1UVf-VE",
      })),
      membership: jest.fn(async () => null),
      lockPublished: jest.fn(async () => row()),
      enroll: jest.fn(async () => ({
        id,
        productId: id,
        createdAt: new Date(),
      })),
    };
    const user = () =>
      UserEntity.create({
        id,
        name: "Learner",
        email: "learner@example.test",
        passwordHash: "hash",
      });
    users = {
      findById: jest.fn(async () => user()),
      lockById: jest.fn(async () => user()),
    };
    audit = { record: jest.fn() };
    service = new CoursesService(
      repo,
      users,
      { run: async (fn: any) => fn({}) } as any,
      audit,
    );
  });
  it("removes every source field from public outlines and cards", async () => {
    const detail = await service.bySlug("course-title"),
      page = await service.list({ limit: 20 });
    expect(JSON.stringify([detail, page])).not.toContain("PRIVATE_ID1");
    expect(detail.lessons[0].access).toBe("ENROLLED");
  });
  it("denies an enrolled lesson at the public demo endpoint", async () => {
    await expect(service.demoPlayback(id, lessonId)).rejects.toThrow();
  });
  it("provides no artwork for restricted-only courses", async () => {
    expect(await service.bySlug("course-title")).toHaveProperty(
      "thumbnailUrl",
      null,
    );
  });
  it("derives artwork only from a public demo without leaking restricted sources", async () => {
    repo.published.mockResolvedValue({
      ...row(),
      courseLessons: [
        ...row().courseLessons,
        {
          ...row().courseLessons[0],
          id: "550e8400-e29b-41d4-a716-446655440003",
          access: "PUBLIC_DEMO",
          youtubeVideoId: "M7lc1UVf-VE",
          position: 2,
        },
      ],
    });
    const detail = await service.bySlug("course-title");
    expect(detail).toHaveProperty(
      "thumbnailUrl",
      "https://i.ytimg.com/vi/M7lc1UVf-VE/hqdefault.jpg",
    );
    expect(JSON.stringify(detail)).not.toContain("PRIVATE_ID1");
    expect(
      detail.lessons.every((lesson) => !("youtubeVideoId" in lesson)),
    ).toBe(true);
  });
  it("serves only an explicitly public demo", async () => {
    repo.lesson.mockResolvedValue({
      ...row().courseLessons[0],
      access: "PUBLIC_DEMO",
      youtubeVideoId: "M7lc1UVf-VE",
    });
    expect((await service.demoPlayback(id, lessonId)).videoId).toBe(
      "M7lc1UVf-VE",
    );
  });
  it("requires own enrollment even for administrative roles", async () => {
    await expect(
      service.lessonPlayback({ ...actor, role: UserRole.ADMIN }, id, lessonId),
    ).rejects.toThrow();
    expect(repo.lesson).not.toHaveBeenCalled();
  });
  it("reuses existing enrollment without another write or audit", async () => {
    repo.membership.mockResolvedValue({
      id,
      productId: id,
      createdAt: new Date(),
    });
    expect((await service.enroll(actor, id)).productId).toBe(id);
    expect(repo.enroll).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
  it("checks current identity before returning member data", async () => {
    users.findById.mockResolvedValue(null);
    await expect(service.myDetail(actor, id)).rejects.toThrow();
    expect(repo.published).not.toHaveBeenCalled();
  });
  it("blocks draft, deleted or unsupported courses", async () => {
    repo.published.mockResolvedValue(null);
    repo.lockPublished.mockResolvedValue(null);
    await expect(service.bySlug("course-title")).rejects.toThrow();
    await expect(service.enroll(actor, id)).rejects.toThrow();
    expect(repo.enroll).not.toHaveBeenCalled();
  });
});
