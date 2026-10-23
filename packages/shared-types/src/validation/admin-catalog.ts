import { z } from "zod";
import { ProductType, SubscriptionTier } from "../enums/index.js";
import {
  ProductContentProvider,
  courseThumbnailUrlSchema,
} from "./youtube-courses.js";
const uuid = z.string().uuid(),
  version = z.number().int().nonnegative();
const date = z
  .string()
  .datetime({ offset: true })
  .refine((v) => Number.isFinite(Date.parse(v)));
const productFields = {
  thumbnailUrl: courseThumbnailUrlSchema.nullable().optional(),
  title: z.string().trim().min(3).max(255),
  slug: z
    .string()
    .trim()
    .min(3)
    .max(200)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().min(10).max(5000),
  priceCents: z.number().int().min(0).max(2147483647),
  discountPriceCents: z.number().int().min(0).max(2147483647).nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  minSubscriptionTier: z.nativeEnum(SubscriptionTier),
};
const pricing = (v: {
  priceCents: number;
  discountPriceCents: number | null;
}) => v.discountPriceCents === null || v.discountPriceCents < v.priceCents;
export const adminProductCreateSchema = z
  .object({
    ...productFields,
    type: z.nativeEnum(ProductType),
    contentProvider: z.nativeEnum(ProductContentProvider).optional(),
  })
  .strict()
  .refine(pricing, { path: ["discountPriceCents"] })
  .refine(
    (v) =>
      v.contentProvider !== ProductContentProvider.YOUTUBE ||
      v.type === ProductType.VIDEO_COURSE,
    { path: ["contentProvider"] },
  );
export const adminProductEditSchema = z
  .object({ ...productFields, expectedVersion: version })
  .strict()
  .refine(pricing, { path: ["discountPriceCents"] });
export const adminProductActionSchema = z
  .object({
    action: z.enum(["PUBLISH", "UNPUBLISH", "DELETE"]),
    expectedVersion: version,
    reason: z.string().trim().min(10).max(500),
  })
  .strict();
export const adminAssetAttachSchema = z
  .object({ uploadId: uuid, expectedVersion: version })
  .strict();
export const adminProductSchema = z.object({
  previewImageUrl: courseThumbnailUrlSchema.nullable().optional(),
  lessonCount: z.number().int().nonnegative().optional(),
  enrollmentCount: z.number().int().nonnegative().optional(),
  contentProvider: z
    .nativeEnum(ProductContentProvider)
    .default(ProductContentProvider.INTERNAL),
  id: uuid,
  version,
  ...productFields,
  type: z.nativeEnum(ProductType),
  contentS3Key: z.string(),
  isPublished: z.boolean(),
  createdAt: date,
  updatedAt: date,
});
export const adminProductQuerySchema = z
  .object({
    contentProvider: z.nativeEnum(ProductContentProvider).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: uuid.optional(),
    search: z.string().trim().max(100).optional(),
    slug: z.string().trim().max(200).optional(),
    type: z.nativeEnum(ProductType).optional(),
    publication: z.enum(["DRAFT", "PUBLISHED"]).optional(),
  })
  .strict();
export const adminProductListSchema = z.object({
  items: z.array(adminProductSchema).max(100),
  nextCursor: uuid.nullable(),
});
export type AdminProductCreate = z.infer<typeof adminProductCreateSchema>;
export type AdminProductEdit = z.infer<typeof adminProductEditSchema>;
export type AdminProductAction = z.infer<typeof adminProductActionSchema>;
export type AdminProduct = z.infer<typeof adminProductSchema>;
export type AdminProductQuery = z.infer<typeof adminProductQuerySchema>;
const policies = {
  VIDEO_COURSE: {
    max: 10 * 1024 ** 3,
    mimes: {
      ".mp4": "video/mp4",
      ".webm": "video/webm",
      ".mov": "video/quicktime",
      ".mkv": "video/x-matroska",
    },
  },
  EBOOK: {
    max: 150 * 1024 ** 2,
    mimes: { ".pdf": "application/pdf", ".epub": "application/epub+zip" },
  },
  EXCEL_TOOL: {
    max: 50 * 1024 ** 2,
    mimes: {
      ".xlsx":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ".xls": "application/vnd.ms-excel",
    },
  },
} as const;
export function validateAdminFile(
  type: `${ProductType}`,
  filename: string,
  contentType: string,
  bytes: number,
): boolean {
  const p = policies[type],
    ext = filename.match(/\.[a-z0-9]+$/i)?.[0].toLowerCase() ?? "";
  return (
    !!p &&
    Number.isSafeInteger(bytes) &&
    bytes > 0 &&
    bytes <= p.max &&
    (p.mimes as Record<string, string>)[ext] === contentType
  );
}
export const adminUploadCreateSchema = z
  .object({
    requestId: uuid,
    productId: uuid,
    filename: z
      .string()
      .trim()
      .min(1)
      .max(255)
      .refine((v) => !/[\\/\u0000-\u001f]/.test(v)),
    contentType: z.string().max(150),
    fileSizeBytes: z
      .number()
      .int()
      .positive()
      .max(10 * 1024 ** 3),
  })
  .strict();
export const adminUploadQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(20),
    cursor: uuid.optional(),
    productId: uuid.optional(),
  })
  .strict();
export const adminPartSchema = z
  .object({ partNumber: z.number().int().min(1).max(1024) })
  .strict();
export const adminCompleteSchema = z
  .object({
    parts: z
      .array(
        z
          .object({
            partNumber: z.number().int().min(1).max(1024),
            etag: z.string().min(1).max(200),
          })
          .strict(),
      )
      .min(1)
      .max(1024),
  })
  .strict();
export const adminUrlSchema = z
  .string()
  .url()
  .refine((v) => {
    const u = new URL(v);
    return (
      ["http:", "https:"].includes(u.protocol) && !u.username && !u.password
    );
  });
export const adminPartUrlSchema = z.object({
  url: adminUrlSchema,
  partNumber: z.number().int().positive(),
});
export const adminUploadSchema = z.object({
  id: uuid,
  productId: uuid,
  ownerId: uuid,
  filename: z.string(),
  contentType: z.string(),
  fileSizeBytes: z.number().int().positive(),
  partSizeBytes: z.number().int().positive(),
  state: z.enum(["INITIALIZING", "UPLOADING", "UPLOADED", "FAILED", "ABORTED"]),
  createdAt: date,
  updatedAt: date,
  processingState: z.enum([
    "idle",
    "waiting",
    "active",
    "delayed",
    "completed",
    "failed",
    "unavailable",
    "expired",
  ]),
  progress: z.number().min(0).max(100),
  product: z.object({
    id: uuid,
    title: z.string(),
    type: z.nativeEnum(ProductType),
    version,
    isPublished: z.boolean(),
  }),
});
export const adminUploadListSchema = z.object({
  items: z.array(adminUploadSchema).max(100),
  nextCursor: uuid.nullable(),
});
export type AdminUpload = z.infer<typeof adminUploadSchema>;
export type AdminUploadCreate = z.infer<typeof adminUploadCreateSchema>;
