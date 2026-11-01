import { z } from "zod";
export const thumbnailConfigFields = {
  CLOUDINARY_THUMBNAILS_ENABLED: z.preprocess(
    (value) =>
      value === "true"
        ? true
        : value === "false" || value === undefined || value === ""
          ? false
          : value,
    z.boolean(),
  ),
  CLOUDINARY_CLOUD_NAME: z.string().trim().optional(),
  CLOUDINARY_API_KEY: z.string().trim().optional(),
  CLOUDINARY_API_SECRET: z.string().trim().optional(),
  CLOUDINARY_THUMBNAILS_FOLDER: z.string().trim().default("course-thumbnails"),
};
export function validateThumbnailConfig(
  data: z.infer<z.ZodObject<typeof thumbnailConfigFields>>,
  ctx: z.RefinementCtx,
) {
  if (!data.CLOUDINARY_THUMBNAILS_ENABLED) return;
  for (const key of [
    "CLOUDINARY_CLOUD_NAME",
    "CLOUDINARY_API_KEY",
    "CLOUDINARY_API_SECRET",
  ] as const)
    if (!data[key])
      ctx.addIssue({
        code: "custom",
        path: [key],
        message: "Required when thumbnail uploads are enabled",
      });
  if (
    data.CLOUDINARY_CLOUD_NAME &&
    !/^[a-zA-Z0-9_-]+$/.test(data.CLOUDINARY_CLOUD_NAME)
  )
    ctx.addIssue({
      code: "custom",
      path: ["CLOUDINARY_CLOUD_NAME"],
      message: "Invalid cloud name",
    });
  if (
    !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(
      data.CLOUDINARY_THUMBNAILS_FOLDER,
    )
  )
    ctx.addIssue({
      code: "custom",
      path: ["CLOUDINARY_THUMBNAILS_FOLDER"],
      message: "Invalid thumbnail prefix",
    });
}
