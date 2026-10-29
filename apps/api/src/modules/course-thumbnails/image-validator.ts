import sharp from "sharp";
import { COURSE_THUMBNAIL_MAX_BYTES } from "@vetralink/shared-types";
import { WorkflowException } from "../../common/exceptions/domain.exception";
// libvips can decode APNG as a single PNG frame without reporting pages.
// Walk bounded PNG chunk records, rather than searching image/metadata bytes.
function hasPngAnimation(input: Buffer): boolean {
  if (
    !input.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return false;
  let offset = 8;
  while (offset + 12 <= input.length) {
    const length = input.readUInt32BE(offset),
      end = offset + 12 + length;
    if (end > input.length) throw new Error("Truncated PNG chunk");
    const type = input.toString("ascii", offset + 4, offset + 8);
    if (["acTL", "fcTL", "fdAT"].includes(type)) return true;
    if (type === "IEND") return false;
    offset = end;
  }
  throw new Error("Incomplete PNG");
}
export async function normalizeCourseThumbnail(
  input: Buffer,
  expectedMime?: string,
): Promise<Buffer> {
  if (!input.length)
    throw new WorkflowException("THUMBNAIL_EMPTY", "Choose an image.", 422);
  if (input.length > COURSE_THUMBNAIL_MAX_BYTES)
    throw new WorkflowException(
      "THUMBNAIL_TOO_LARGE",
      "Image exceeds 3 MiB.",
      413,
    );
  try {
    if (hasPngAnimation(input)) throw new Error("Animated PNG");
    const image = sharp(input, {
      limitInputPixels: 40_000_000,
      animated: true,
      failOn: "warning",
    });
    const meta = await image.metadata();
    if (
      expectedMime &&
      (
        { jpeg: "image/jpeg", png: "image/png", webp: "image/webp" } as Record<
          string,
          string
        >
      )[meta.format ?? ""] !== expectedMime
    )
      throw new Error("Mismatched image format");
    if (
      !meta.format ||
      !["jpeg", "png", "webp"].includes(meta.format) ||
      (meta.pages ?? 1) !== 1 ||
      !meta.width ||
      !meta.height ||
      meta.width * meta.height > 40_000_000
    )
      throw new Error("Invalid image");
    const output = await image
      .rotate()
      .resize({
        width: 1920,
        height: 1080,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
    if (output.length > COURSE_THUMBNAIL_MAX_BYTES)
      throw new Error("Output too large");
    return output;
  } catch {
    throw new WorkflowException(
      "THUMBNAIL_INVALID",
      "Choose a valid, nonanimated JPEG, PNG or WebP image.",
      422,
    );
  }
}
