import {
  courseSchema,
  normalizeYouTubeVideoId,
  adminCurriculumWriteSchema,
  adminProductCreateSchema,
  ProductType,
  SubscriptionTier,
} from "@vetralink/shared-types";
const videoId = "M7lc1UVf-VE";
describe("YouTube course contracts", () => {
  it.each([
    `https://www.youtube.com/watch?v=${videoId}&si=tracking`,
    `https://youtu.be/${videoId}`,
    `https://www.youtube-nocookie.com/embed/${videoId}`,
    `https://m.youtube.com/shorts/${videoId}`,
  ])("normalizes approved URL %s", (url) =>
    expect(normalizeYouTubeVideoId(url)).toBe(videoId),
  );
  it.each([
    `https://youtube.com.evil.test/watch?v=${videoId}`,
    `https://user@youtube.com/watch?v=${videoId}`,
    `http://youtu.be/${videoId}`,
    `https://youtube.com/watch?v=${videoId}&v=${videoId}`,
    "https://youtube.com/playlist?list=PL123",
    '<iframe src="youtube.com"></iframe>',
    `https://youtu.be/${videoId}#fragment`,
    "https://youtu.be/invalid",
  ])("rejects unsafe or ambiguous URL %s", (url) =>
    expect(() => normalizeYouTubeVideoId(url)).toThrow(),
  );
  it("rejects duplicate lesson IDs and over-limit curricula", () => {
    const lesson = {
      id: "550e8400-e29b-41d4-a716-446655440001",
      title: "Lesson one",
      summary: "",
      access: "ENROLLED",
      videoUrl: `https://youtu.be/${videoId}`,
    };
    expect(
      adminCurriculumWriteSchema.safeParse({
        expectedVersion: 0,
        lessons: [lesson, lesson],
      }).success,
    ).toBe(false);
    expect(
      adminCurriculumWriteSchema.safeParse({
        expectedVersion: 0,
        lessons: Array.from({ length: 101 }, () => ({
          ...lesson,
          id: undefined,
        })),
      }).success,
    ).toBe(false);
  });
  it("accepts video-only YouTube drafts including future paid pricing", () => {
    const input = {
      title: "Course title",
      slug: "course-title",
      description: "Long course description",
      type: ProductType.VIDEO_COURSE,
      contentProvider: "YOUTUBE",
      priceCents: 0,
      discountPriceCents: null,
      currency: "BDT",
      minSubscriptionTier: SubscriptionTier.STARTER,
    };
    expect(adminProductCreateSchema.safeParse(input).success).toBe(true);
    expect(
      adminProductCreateSchema.safeParse({ ...input, type: ProductType.EBOOK })
        .success,
    ).toBe(false);
    expect(
      adminProductCreateSchema.safeParse({ ...input, priceCents: 100 }).success,
    ).toBe(true);
  });
});

describe("Duration read compatibility", () => {
  const id = "550e8400-e29b-41d4-a716-446655440001";
  const lesson = {
    id,
    title: "Lesson",
    summary: "",
    position: 1,
    access: "ENROLLED",
  };
  const course = {
    id,
    title: "Course",
    slug: "course",
    description: "Description",
    provider: "YOUTUBE",
    access: "FREE_ENROLLMENT",
    lessonCount: 1,
    demoCount: 0,
    firstLessonId: id,
    lessons: [lesson],
  };
  it("preserves positive durations while stripping private metadata", () => {
    expect(
      courseSchema.parse({
        ...course,
        lessons: [
          {
            ...lesson,
            durationSeconds: 755,
            youtubeVideoId: "PRIVATE_ID1",
            apiKey: "secret",
          },
        ],
      }).lessons[0],
    ).toEqual({ ...lesson, durationSeconds: 755 });
  });
  it.each([0, -1, 1.5, 2147483648])(
    "rejects invalid duration %s",
    (durationSeconds) => {
      expect(
        courseSchema.safeParse({
          ...course,
          lessons: [{ ...lesson, durationSeconds }],
        }).success,
      ).toBe(false);
    },
  );
  it("accepts legacy absence and null and rejects client-written durations", () => {
    expect(courseSchema.safeParse(course).success).toBe(true);
    expect(
      courseSchema.safeParse({
        ...course,
        lessons: [{ ...lesson, durationSeconds: null }],
      }).success,
    ).toBe(true);
    expect(
      adminCurriculumWriteSchema.safeParse({
        expectedVersion: 0,
        lessons: [
          {
            ...lesson,
            videoUrl: `https://youtu.be/${videoId}`,
            durationSeconds: 755,
          },
        ],
      }).success,
    ).toBe(false);
  });
});
