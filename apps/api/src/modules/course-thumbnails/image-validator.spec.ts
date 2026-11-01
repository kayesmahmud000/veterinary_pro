import sharp from "sharp";
import { normalizeCourseThumbnail } from "./image-validator";
import {
  courseThumbnailFileError,
  COURSE_THUMBNAIL_MAX_BYTES,
} from "@vetralink/shared-types";
describe("course thumbnail image validation", () => {
  it.each(["jpeg", "png", "webp"] as const)(
    "decodes %s, removes metadata and returns bounded WebP",
    async (format) => {
      const bytes = await sharp({
        create: { width: 2200, height: 1200, channels: 3, background: "red" },
      })
        .toFormat(format)
        .withMetadata()
        .toBuffer();
      const output = await normalizeCourseThumbnail(bytes),
        meta = await sharp(output).metadata();
      expect(meta.format).toBe("webp");
      expect(meta.width).toBeLessThanOrEqual(1920);
      expect(meta.height).toBeLessThanOrEqual(1080);
      expect(meta.exif).toBeUndefined();
      expect(output.length).toBeLessThanOrEqual(COURSE_THUMBNAIL_MAX_BYTES);
    },
  );
  it("does not enlarge small images and rejects corrupt/empty/oversized bytes", async () => {
    const input = await sharp({
      create: { width: 10, height: 10, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    expect(
      (await sharp(await normalizeCourseThumbnail(input)).metadata()).width,
    ).toBe(10);
    for (const bytes of [
      Buffer.alloc(0),
      Buffer.from("fake image"),
      Buffer.alloc(COURSE_THUMBNAIL_MAX_BYTES + 1),
    ])
      await expect(normalizeCourseThumbnail(bytes)).rejects.toBeDefined();
  });
  it("rejects unsupported decoded formats and excessive pixel count", async () => {
    const gif = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "red" },
    })
      .gif()
      .toBuffer();
    await expect(normalizeCourseThumbnail(gif)).rejects.toBeDefined();
    const huge = await sharp({
      create: { width: 7000, height: 6000, channels: 3, background: "red" },
    })
      .jpeg()
      .toBuffer();
    await expect(normalizeCourseThumbnail(huge)).rejects.toBeDefined();
  });
  it("rejects actual animated WebP frames", async () => {
    const raw = Buffer.from([
      255, 0, 0, 255, 0, 0, 255, 0, 0, 255, 0, 0, 0, 0, 255, 0, 0, 255, 0, 0,
      255, 0, 0, 255,
    ]);
    const animated = await sharp(raw, {
      raw: { width: 2, height: 4, channels: 3, pageHeight: 2 },
    })
      .webp({ delay: [100, 200], loop: 0 })
      .toBuffer();
    expect((await sharp(animated, { animated: true }).metadata()).pages).toBe(
      2,
    );
    await expect(normalizeCourseThumbnail(animated)).rejects.toBeDefined();
  });
  it("rejects APNG even when the decoder omits page metadata", async () => {
    const bytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAACGFjVEwAAAACAAAAAPONk3AAAAAaZmNUTAAAAAAAAAAQAAAAEAAAAAAAAAAAAAEACgAAY0bPJQAAABdJREFUeJxj/M9AGmAiUf2ohlENQ0gDAEAuAR9m40ZzAAAAGmZjVEwAAAABAAAAEAAAABAAAAAAAAAAAAABAAoAAPg1JfEAAAAdZmRBVAAAAAJ4nGNkYPjPQApgIkn1qIZRDUNKAwA+MAEfz7wJ2wAAAABJRU5ErkJggg==",
      "base64",
    );
    expect((await sharp(bytes, { animated: true }).metadata()).format).toBe(
      "png",
    );
    await expect(
      normalizeCourseThumbnail(bytes, "image/png"),
    ).rejects.toBeDefined();
  });
  it("accepts a static PNG containing animation-like text inside a metadata chunk", async () => {
    const bytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAOHRFWHRjb21tZW50AFRoaXMgaXMgc3RhdGljIGFjVEwgdGV4dCwgbm90IGFuIGFuaW1hdGlvbiBjaHVuazfj/lkAAAAXSURBVHicY/zPQBpgIlH9qIZRDUNIAwBALgEfZuNGcwAAAABJRU5ErkJggg==",
      "base64",
    );
    await expect(
      normalizeCourseThumbnail(bytes, "image/png"),
    ).resolves.toBeInstanceOf(Buffer);
  });
  it("matches extension/MIME and exact size boundaries", () => {
    expect(
      courseThumbnailFileError({
        name: "photo.JPG",
        type: "image/jpeg",
        size: COURSE_THUMBNAIL_MAX_BYTES,
      }),
    ).toBeNull();
    expect(
      courseThumbnailFileError({
        name: "photo.png",
        type: "image/jpeg",
        size: 2,
      }),
    ).toBe("THUMBNAIL_UNSUPPORTED");
    expect(
      courseThumbnailFileError({
        name: "photo.png",
        type: "image/png",
        size: 0,
      }),
    ).toBe("THUMBNAIL_EMPTY");
    expect(
      courseThumbnailFileError({
        name: "photo.png",
        type: "image/png",
        size: COURSE_THUMBNAIL_MAX_BYTES + 1,
      }),
    ).toBe("THUMBNAIL_TOO_LARGE");
  });
});
