import { z } from "zod";
export enum ProductContentProvider {
  INTERNAL = "INTERNAL",
  YOUTUBE = "YOUTUBE",
}
export function normalizeYouTubeVideoId(input: string): string {
  const url = new URL(input.trim());
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.hash
  )
    throw new Error("INVALID_YOUTUBE_URL");
  let id: string | null = null;
  const parts = url.pathname.split("/").filter(Boolean);
  if (url.hostname === "youtu.be" && parts.length === 1) id = parts[0] ?? null;
  else if (
    ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(url.hostname)
  ) {
    if (url.pathname === "/watch" && url.searchParams.getAll("v").length === 1)
      id = url.searchParams.get("v");
    else if (parts.length === 2 && ["embed", "shorts"].includes(parts[0] ?? ""))
      id = parts[1] ?? null;
  } else if (
    url.hostname === "www.youtube-nocookie.com" &&
    parts.length === 2 &&
    parts[0] === "embed"
  )
    id = parts[1] ?? null;
  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id))
    throw new Error("INVALID_YOUTUBE_URL");
  return id;
}
const lessonFields = {
  title: z.string().trim().min(1).max(200),
  summary: z.string().trim().max(1000),
  access: z.enum(["PUBLIC_DEMO", "ENROLLED"]),
};
export const adminCurriculumWriteSchema = z
  .object({
    expectedVersion: z.number().int().nonnegative(),
    lessons: z
      .array(
        z
          .object({
            ...lessonFields,
            id: z.string().uuid().optional(),
            videoUrl: z
              .string()
              .trim()
              .max(2048)
              .refine((value) => {
                try {
                  normalizeYouTubeVideoId(value);
                  return true;
                } catch {
                  return false;
                }
              }, "INVALID_YOUTUBE_URL"),
          })
          .strict(),
      )
      .max(100),
  })
  .strict()
  .refine((value) => {
    const ids = value.lessons.flatMap((lesson) =>
      lesson.id ? [lesson.id] : [],
    );
    return new Set(ids).size === ids.length;
  }, "Duplicate lesson IDs");
export const adminCurriculumSchema = z.object({
  productId: z.string().uuid(),
  version: z.number().int().nonnegative(),
  isPublished: z.boolean(),
  lessons: z
    .array(
      z.object({
        ...lessonFields,
        id: z.string().uuid(),
        position: z.number().int().positive(),
        youtubeVideoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
      }),
    )
    .max(100),
});
export type AdminCurriculum = z.infer<typeof adminCurriculumSchema>;
export type AdminCurriculumWrite = z.infer<typeof adminCurriculumWriteSchema>;
export function isProductAssetReady(
  product: {
    contentProvider?: string;
    type: string;
    contentS3Key: string;
    priceCents: number;
    discountPriceCents: number | null;
  },
  enrolledLessonCount = 0,
): boolean {
  if (product.contentProvider === ProductContentProvider.YOUTUBE)
    return (
      product.type === "VIDEO_COURSE" &&
      product.priceCents === 0 &&
      product.discountPriceCents === null &&
      product.contentS3Key === "" &&
      enrolledLessonCount > 0
    );
  return (
    !!product.contentS3Key.trim() &&
    (product.type !== "VIDEO_COURSE" || product.contentS3Key.endsWith(".m3u8"))
  );
}
