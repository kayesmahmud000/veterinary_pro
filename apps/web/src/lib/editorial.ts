import { z } from "zod";
import {
  publicEditorialSchema,
  publicEditorialListSchema,
  editorialKindSchema,
  editorialSlugSchema,
  communicationsQuerySchema,
  type PublicEditorial,
} from "@vetralink/shared-types";
type EditorialResult<T> = { status: number; data?: T };
export async function readEditorial<T>(
  path: string,
  schema: z.ZodType<T>,
): Promise<EditorialResult<T>> {
  const controller = new AbortController(),
    timer = setTimeout(() => controller.abort(), 3500);
  try {
    const base = new URL(
      `${(process.env.API_BASE_URL || "https://veterinary-api-mocha.vercel.app/api/v1").replace(/\/$/, "")}/`,
    );
    if (
      !["http:", "https:"].includes(base.protocol) ||
      base.username ||
      base.password ||
      base.search ||
      base.hash
    )
      return { status: 503 };
    const response = await fetch(new URL(`content/${path}`, base), {
      cache: "no-store",
      redirect: "error",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return { status: response.status === 404 ? 404 : 503 };
    const envelope: unknown = await response.json(),
      parsed = z
        .object({ success: z.literal(true), data: schema })
        .safeParse(envelope);
    return parsed.success
      ? { status: 200, data: parsed.data.data }
      : { status: 503 };
  } catch {
    return { status: 503 };
  } finally {
    clearTimeout(timer);
  }
}
export async function publishedEntry(
  kind: string,
  slug: string,
): Promise<EditorialResult<PublicEditorial>> {
  if (
    !editorialKindSchema.safeParse(kind).success ||
    !editorialSlugSchema.safeParse(slug).success
  )
    return { status: 404 };
  const r = await readEditorial(`${kind}/${slug}`, publicEditorialSchema);
  return r.data && (r.data.kind !== kind || r.data.slug !== slug)
    ? { status: 503 }
    : r;
}
export async function publishedEntries(
  kind: string,
  values: Record<string, unknown> = {},
): Promise<EditorialResult<z.infer<typeof publicEditorialListSchema>>> {
  const q = communicationsQuerySchema.safeParse(values);
  if (!editorialKindSchema.safeParse(kind).success || !q.success)
    return { status: 422 };
  const search = new URLSearchParams();
  Object.entries(q.data).forEach(([k, v]) => {
    if (v !== undefined) search.set(k, String(v));
  });
  const r = await readEditorial(`${kind}?${search}`, publicEditorialListSchema);
  return r.data && r.data.items.some((v: { kind: string }) => v.kind !== kind)
    ? { status: 503 }
    : r;
}
