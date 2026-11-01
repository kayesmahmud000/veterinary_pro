import { z } from "zod";
import { courseThumbnailUrlSchema } from "./youtube-courses.js";
export const COURSE_THUMBNAIL_MAX_BYTES = 3 * 1024 * 1024;
export const COURSE_THUMBNAIL_MAX_REQUEST_BYTES =
  COURSE_THUMBNAIL_MAX_BYTES + 64 * 1024;
export const COURSE_THUMBNAIL_TYPES: Readonly<Record<string, string>> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};
export const courseThumbnailUploadResultSchema = z
  .object({ url: courseThumbnailUrlSchema })
  .strict();
export type CourseThumbnailUploadResult = z.infer<
  typeof courseThumbnailUploadResultSchema
>;
export function courseThumbnailFileError(file: {
  name: string;
  type: string;
  size: number;
}): string | null {
  if (!file.size) return "THUMBNAIL_EMPTY";
  if (file.size > COURSE_THUMBNAIL_MAX_BYTES) return "THUMBNAIL_TOO_LARGE";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (
    !Object.hasOwn(COURSE_THUMBNAIL_TYPES, ext) ||
    COURSE_THUMBNAIL_TYPES[ext] !== file.type
  )
    return "THUMBNAIL_UNSUPPORTED";
  return null;
}
