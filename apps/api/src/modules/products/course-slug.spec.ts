import {
  generateCourseSlug,
  decodeCourseSlugSegment,
  courseSlugSchema,
  adminProductCreateSchema,
} from "@vetralink/shared-types";
describe("editable automatic course slug", () => {
  it.each([
    ["  Animal CARE & Health / 101! ", "animal-care-health-101"],
    ["গরুর স্বাস্থ্য ও পরিচর্যা", "গরুর-স্বাস্থ্য-ও-পরিচর্যা"],
    ["Cafe\u0301 care", "café-care"],
    ["a", "a"],
    ["🐄 / !!!", "course"],
  ])("generates a safe title-based slug for %s", (title, expected) => {
    expect(generateCourseSlug(title)).toBe(expected);
    expect(courseSlugSchema.safeParse(generateCourseSlug(title)).success).toBe(
      true,
    );
  });
  it("normalizes custom input, uses title for blank/punctuation-only overrides, and bounds URL length", () => {
    expect(generateCourseSlug("Course title", " My CUSTOM slug! ")).toBe(
      "my-custom-slug",
    );
    expect(generateCourseSlug("Course title", "")).toBe("course-title");
    expect(generateCourseSlug("Course title", "!!!")).toBe("course-title");
    for (const title of [
      "long title ".repeat(100),
      "𠮷".repeat(200),
      "বাংলা ".repeat(100),
    ]) {
      const slug = generateCourseSlug(title);
      expect(slug.length).toBeLessThanOrEqual(200);
      expect(slug.endsWith("-")).toBe(false);
      expect(courseSlugSchema.safeParse(slug).success).toBe(true);
    }
  });
  it("accepts Bangla and one-character custom course slugs while rejecting path/query fragments", () => {
    const input = {
      title: "Course title",
      slug: "গরুর-স্বাস্থ্য",
      description: "Long course description",
      type: "VIDEO_COURSE",
      contentProvider: "YOUTUBE",
      priceCents: 0,
      discountPriceCents: null,
      currency: "BDT",
      minSubscriptionTier: "STARTER",
    };
    for (const slug of ["গরুর-স্বাস্থ্য", "a", "legacy-course-title"])
      expect(
        adminProductCreateSchema.safeParse({ ...input, slug }).success,
      ).toBe(true);
    for (const slug of [
      "../private",
      "foo/bar",
      "foo?admin=true",
      "foo#fragment",
      "foo\\bar",
    ])
      expect(courseSlugSchema.safeParse(slug).success).toBe(false);
  });
  it("decodes one route segment once and rejects encoded separators or malformed/double encoding", () => {
    expect(decodeCourseSlugSegment(encodeURIComponent("গরুর-স্বাস্থ্য"))).toBe(
      "গরুর-স্বাস্থ্য",
    );
    expect(decodeCourseSlugSegment("গরুর-স্বাস্থ্য")).toBe("গরুর-স্বাস্থ্য");
    for (const value of [
      "foo%2fbar",
      "%2e%2e",
      "foo%3fadmin%3dtrue",
      "foo%252fbar",
      "%",
      "%20foo%20",
      "ABC",
    ])
      expect(decodeCourseSlugSegment(value)).toBeNull();
  });
  it("retains existing non-course slug constraints", () => {
    const input = {
      title: "Ebook title",
      description: "Long ebook description",
      type: "EBOOK",
      contentProvider: "INTERNAL",
      priceCents: 0,
      discountPriceCents: null,
      currency: "BDT",
      minSubscriptionTier: "STARTER",
    };
    for (const slug of ["a", "গরুর-স্বাস্থ্য"])
      expect(
        adminProductCreateSchema.safeParse({ ...input, slug }).success,
      ).toBe(false);
  });
});
