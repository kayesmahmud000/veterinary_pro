import { CourseThumbnailUploadResult } from "@vetralink/shared-types";
export const THUMBNAIL_STORAGE = Symbol("THUMBNAIL_STORAGE");
export interface ThumbnailStorage {
  put(
    publicId: string,
    body: Buffer,
    contentType: "image/webp",
  ): Promise<CourseThumbnailUploadResult>;
}
