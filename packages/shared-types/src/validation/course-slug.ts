import { z } from "zod";
export const COURSE_SLUG_MAX_LENGTH = 200;
export const courseSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(COURSE_SLUG_MAX_LENGTH)
  .regex(/^[\p{L}\p{M}\p{N}]+(?:-[\p{L}\p{M}\p{N}]+)*$/u)
  .refine((value) => value === value.toLowerCase());
function normalizeSlug(value: string): string {
  const compact = value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
  if (!/[\p{L}\p{N}]/u.test(compact)) return "";
  let bounded = "";
  for (const character of compact) {
    if (bounded.length + character.length > COURSE_SLUG_MAX_LENGTH) break;
    bounded += character;
  }
  return bounded.replace(/-+$/, "");
}
export function generateCourseSlug(title: string, customSlug?: string): string {
  return normalizeSlug(customSlug ?? "") || normalizeSlug(title) || "course";
}

// Next route params may still be percent-encoded; accept exactly one safe segment.
export function decodeCourseSlugSegment(segment: string): string | null {
  try {
    const decoded = decodeURIComponent(segment);
    const parsed = courseSlugSchema.safeParse(decoded);
    return parsed.success && parsed.data === decoded ? decoded : null;
  } catch {
    return null;
  }
}
