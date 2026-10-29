import { EnvSchema } from "./env.schema";
import { EnvService } from "./env.service";
const base = { DATABASE_URL: "postgresql://test:test@localhost:5432/test" };
const ready = {
  ...base,
  CLOUDINARY_THUMBNAILS_ENABLED: "true",
  CLOUDINARY_CLOUD_NAME: "test-cloud",
  CLOUDINARY_API_KEY: "123456789",
  CLOUDINARY_API_SECRET: "synthetic-secret",
  CLOUDINARY_THUMBNAILS_FOLDER: "course-thumbnails",
};
describe("course thumbnail configuration", () => {
  it("defaults disabled and parses explicit false without requiring credentials", () => {
    const result = EnvSchema.parse({
      ...base,
      CLOUDINARY_THUMBNAILS_ENABLED: "false",
    }) as any;
    expect(result.CLOUDINARY_THUMBNAILS_ENABLED).toBe(false);
    expect((EnvSchema.parse(base) as any).CLOUDINARY_THUMBNAILS_ENABLED).toBe(
      false,
    );
  });
  it("requires credentials when enabled, even with the Vercel bypass", () => {
    const previous = process.env.VERCEL;
    process.env.VERCEL = "1";
    try {
      for (const key of [
        "CLOUDINARY_CLOUD_NAME",
        "CLOUDINARY_API_KEY",
        "CLOUDINARY_API_SECRET",
      ])
        expect(EnvSchema.safeParse({ ...ready, [key]: "" }).success).toBe(
          false,
        );
    } finally {
      if (previous === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = previous;
    }
  });
  it("rejects unsafe configuration and nonboolean flags", () => {
    for (const folder of [
      "../images",
      "a//b",
      "/images",
      "https://example.test/images",
      "a/./b",
      "a/",
    ])
      expect(
        EnvSchema.safeParse({ ...ready, CLOUDINARY_THUMBNAILS_FOLDER: folder })
          .success,
      ).toBe(false);
    expect(
      EnvSchema.safeParse({ ...ready, CLOUDINARY_CLOUD_NAME: "cloud/other" })
        .success,
    ).toBe(false);
    expect(
      EnvSchema.safeParse({ ...ready, CLOUDINARY_THUMBNAILS_ENABLED: "yes" })
        .success,
    ).toBe(false);
  });
  it("exposes typed credentials only through backend configuration", () => {
    const config = EnvSchema.parse(ready);
    const service = new EnvService({
      get: (key: keyof typeof config) => config[key],
    } as any) as any;
    expect(service.cloudinaryThumbnailsEnabled).toBe(true);
    expect(service.cloudinaryCloudName).toBe("test-cloud");
    expect(service.cloudinaryApiKey).toBe("123456789");
    expect(service.cloudinaryApiSecret).toBe("synthetic-secret");
    expect(service.cloudinaryThumbnailsFolder).toBe("course-thumbnails");
  });
});
